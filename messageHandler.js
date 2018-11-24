/**
 * P2P消息处理类
 * 
 * Bet消息收发顺序    
 * 1. A ----------BetRequest------------> B
 * 2. A <---------LockedTransfer--------- B
 * 3. A ----------LockedTransferR-------> B
 * 4. A <---------BetResponse------------ B
 * 5. A ----------Preimage--------------> B
 * 6. A <---------DirectTransfer--------- B
 * 7. A ----------DirectTransferR-------> B
 * 8. A <---------BetSettle-------------- B
 *
 * 
 * CooperativeSettle消息收发顺序
 * 1. A ----CooperativeSettleRequest----> B
 * 
 */


const Ecsign = require('./utils/ecsign');
const MessageGenerator = require('./utils/messageGenerator');
const GameRule = require('./gameRule')
const Constants = require('./Constants');


class MessageHandler {
  constructor(socket, scclient) {
    this.socket = socket;
    this.eventManager = scclient.eventManager;
    this.scclient = scclient;
    this.web3 = scclient.web3;
    this.messageValidator = scclient.messageValidator;
  }

  /**
   * 开始处理通道另一方发来的消息
   */
  start() {
    this.socket
      .on("BetRequest", this.onBetRequest.bind(this))
      .on("LockedTransfer", this.onLockedTransfer.bind(this))
      .on("LockedTransferR", this.onLockedTransferR.bind(this))
      .on("BetResponse", this.onBetResponse.bind(this))
      .on("Preimage", this.onPreimage.bind(this))
      .on("DirectTransfer", this.onDirectTransfer.bind(this))
      .on("DirectTransferR", this.onDirectTransferR.bind(this))
      .on("BetSettle", this.onBetSettle.bind(this))
      .on("CooperativeSettleRequest", this.onCooperativeSettle.bind(this))
      .on("CooperativeSettleResponse", this.onCooperativeSettleResponse.bind(this));
  }

  /**
   * Handler for accept message BetRequest
   * 1. 检查消息合法性
   * 2. 将Bet信息存入数据库
   * 3. 自动同意BetRequest，构造LockedTransfer消息回复对方
   * @param message 
   */
  async onBetRequest(message) {
    // 检测本地数据 和 BetRequest进行比对
    // 如果符合条件，给对方发送LockedTransfer
    logInfo('BetRequest Received: ', message);

    //check BetRequest
    let { gameContractAddress, channelIdentifier, round, betMask, modulo, value, positiveA, hashRa, signatureA } = message;
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    if(!this.messageValidator.checkBetRequest(message, channel.partner)){
      logInfo("check Message BetRequest failed");
      return;
    }
    

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier, round: channel.currentRound });
    if (bet != null && bet.status != Constants.BET_FINISH) {
      logInfo("There are unfinished bet, can not start new bet");
      return;
    }

    let winAmount = GameRule.getPossibleWinAmount(betMask, modulo, value);

    if (parseInt(channel.remoteBalance) - parseInt(winAmount) < 0 || parseInt(channel.localBalance) - parseInt(value) < 0) {
      logError("insufficient balance to bet localBalance", channel.localBalance, "winAmount", winAmount, "betValue", value, "remoteBalance", channel.remoteBalance);
      return false;
    }
    //save bet to database
    bet = { gameContractAddress, channelId: channelIdentifier, round, betMask, modulo, value, positiveA, negativeB: this.scclient.from, hashRa, signatureA, winAmount, status: Constants.BET_INIT };
    await this.scclient.dbhelper.addBet(bet);
    await this.scclient.dbhelper.updateChannel(channelIdentifier, { currentRound: round });


    if (this.scclient.autoRespondBetRequest) {
      let lockedTransfer = await this.getLockedTransfer(channelIdentifier, winAmount, round, channel.localNonce);

      //send LockedTransfer to opposite

      bet = await this.scclient.dbhelper.getBetByChannel({
        channelId: channelIdentifier,
        round
      });
      await this.scclient.dbhelper.updateBet(bet.betId, {
        status: Constants.BET_LOCK_ONE
      });
      this.socket.emit("LockedTransfer", lockedTransfer);
    }

  }


  /**
   * 构造LockedTransfer消息
   * @param channelIdentifier 通道ID
   * @param winAmount 赢取金额
   * @param round 轮数
   * @param lastNonce 上一个nonce 
   * @returns 返回LockedTransfer消息
   */
  async getLockedTransfer(channelIdentifier, winAmount, round, lastNonce) {
    //generate LockedTransfer
    let currentTransfer = await this.scclient.dbhelper.getLatestTransfer({ channelId: channelIdentifier, nonce: lastNonce, owned: 0 });
    let current_transfferred_amount = currentTransfer ? currentTransfer.transferred_amount : 0;
    let current_locked_amount = currentTransfer ? currentTransfer.locked_amount : 0;
    let current_nonce = currentTransfer ? currentTransfer.nonce : 0;

    let locked_amount = this.web3.utils.toBN(current_locked_amount).add(this.web3.utils.toBN(winAmount)).toString(10); //TODO for multi locks
    let transferred_amount = current_transfferred_amount;
    let balanceHash = this.scclient.web3.utils.soliditySha3(transferred_amount, locked_amount, round);
    let nonce = parseInt(current_nonce) + 1;
    const lockedTransfer = this.scclient.messageGenerator.generateLockedTransfer(channelIdentifier, balanceHash, nonce);

    //save LockedTransfer to DB
    let transfer = { channelId: channelIdentifier, balanceHash, transferred_amount, locked_amount, round, nonce, owned: 0, signature: lockedTransfer.signature };
    await this.scclient.dbhelper.addTransfer(transfer);
    await this.updateBalance(channelIdentifier, 0, winAmount, { localNonce: nonce }, true);

    return lockedTransfer;

  }


  /**
   * 构造DirectTransfer消息
   * @param channelIdentifier 通道ID
   * @param sendAmount        发送金额
   * @param cancelLockedAmount 取消锁定金额
   * @param round              轮数
   * @param lastNonce          上一个nonce
   * @returns DirectTransfer消息
   */
  async getDirectTransfer(channelIdentifier, sendAmount, cancelLockedAmount, round, lastNonce){

    //generate LockedTransfer
    let currentTransfer = await this.scclient.dbhelper.getLatestTransfer({ channelId: channelIdentifier, nonce: lastNonce, owned: 0 });
    let current_transfferred_amount = currentTransfer ? currentTransfer.transferred_amount : 0;
    let current_locked_amount = currentTransfer ? currentTransfer.locked_amount : 0;
    let current_nonce = currentTransfer ? currentTransfer.nonce : 0;

    let locked_amount = 0; //TODO for multi locks
    let transferred_amount = this.web3.utils.toBN(current_transfferred_amount).add(this.web3.utils.toBN(sendAmount)).toString(10);
    let balanceHash = this.scclient.web3.utils.soliditySha3(transferred_amount, locked_amount, 0);
    let nonce = parseInt(current_nonce) + 1;
    const lockedTransfer = this.scclient.messageGenerator.generateLockedTransfer(channelIdentifier, balanceHash, nonce);

    //save LockedTransfer to DB
    let transfer = { channelId: channelIdentifier, balanceHash, transferred_amount, locked_amount, round, nonce, owned: 0, signature: lockedTransfer.signature };
    await this.scclient.dbhelper.addTransfer(transfer);
    await this.updateBalance(channelIdentifier, sendAmount, -1 * parseInt(cancelLockedAmount), { localNonce: nonce }, true);

    return lockedTransfer;

  }

  /**
   * 根据本地状态检测对方发送的balanceHash是否合法
   * @param channelIdentifier 通道ID
   * @param balanceHash       对方余额hash
   * @param deltaTransferAmount 应该转的金额
   * @param deltaLockedAmount   应该锁定的金额
   * @param round               轮数
   * @param lastNonce           上一个nonce
   * @returns {Object} 是否合法，已经新的转出金额 和 新的锁定金额
   */
  async checkBalanceHash(channelIdentifier, balanceHash, deltaTransferAmount, deltaLockedAmount, round, lastNonce) {    
    let currentTransfer = await this.scclient.dbhelper.getLatestTransfer({ channelId: channelIdentifier, nonce: lastNonce, owned: 1 });

    let current_transferred_amount = currentTransfer ? currentTransfer.transferred_amount : 0;
    let current_locked_amount = currentTransfer ? currentTransfer.locked_amount : 0;
    let transferred_amount = this.web3.utils.toBN(current_transferred_amount).add(this.web3.utils.toBN(deltaTransferAmount)).toString(10);
    let locked_amount = this.web3.utils.toBN(current_locked_amount).add(this.web3.utils.toBN(deltaLockedAmount)).toString(10);

    logInfo("check BalanceHash", transferred_amount, locked_amount, round, balanceHash);
    let newBalanceHash = this.web3.utils.soliditySha3(transferred_amount, locked_amount, round);
    logInfo("check newBalanceHash", newBalanceHash);

    let isValidBalanceHash = false;
    if(newBalanceHash == balanceHash){
      isValidBalanceHash = true;
    }
    return { isValidBalanceHash, transferred_amount, locked_amount };
  }

  
  /**
   * 更新通道余额
   * @param channelId           通道ID
   * @param deltaTransferAmount 新增转出金额
   * @param deltaLockedAmount   新增锁定金额
   * @param nonceData           己方nonce/对方nonce
   * @param localOrRemote       更新己方余额 或者对方余额
   * @returns null
   */
  async updateBalance(channelId, deltaTransferAmount, deltaLockedAmount, nonceData, localOrRemote) {

    logInfo("UPDATE CHANNEL BALANCE: ", channelId, deltaTransferAmount, deltaLockedAmount, localOrRemote);

    let channel = await this.scclient.dbhelper.getChannel(channelId);

    let localBalance = 0;
    let remoteBalance = 0;
    let localLockedAmount = 0;
    let remoteLockedAmount = 0;

    if(localOrRemote){
      localBalance = this.web3.utils
        .toBN(channel.localBalance)
        .sub(this.web3.utils.toBN(deltaTransferAmount))
        .sub(this.web3.utils.toBN(deltaLockedAmount))
        .toString(10);
      remoteBalance = this.web3.utils
        .toBN(channel.remoteBalance)
        .add(this.web3.utils.toBN(deltaTransferAmount))
        .toString(10);
      localLockedAmount = this.web3.utils
        .toBN(channel.localLockedAmount)
        .add(this.web3.utils.toBN(deltaLockedAmount))
        .toString(10);
      remoteLockedAmount = channel.remoteLockedAmount;

    }else{
      remoteBalance = this.web3.utils
        .toBN(channel.remoteBalance)
        .sub(this.web3.utils.toBN(deltaTransferAmount))
        .sub(this.web3.utils.toBN(deltaLockedAmount))
        .toString(10);
      localBalance = this.web3.utils
        .toBN(channel.localBalance)
        .add(this.web3.utils.toBN(deltaTransferAmount))
        .toString(10);
      localLockedAmount = channel.localLockedAmount;
      remoteLockedAmount = this.web3.utils
        .toBN(channel.remoteLockedAmount)
        .add(this.web3.utils.toBN(deltaLockedAmount))
        .toString(10);
    }
    let data = Object.assign({ localBalance, remoteBalance, localLockedAmount, remoteLockedAmount }, nonceData);
    await this.scclient.dbhelper.updateChannel(channelId, data);

  }

  /**
   * Handler for accept LockedTransfer message
   * 1. 检查消息合法性
   * 2. 更新通道余额和transfer数据
   * 3. 生成LockedTransferR，发送给对方
   * @param message LockedTransfer消息
   */
  async onLockedTransfer(message) {
    // 检测是否符合条件, 如果符合条件 给对方发送LockedTransferR
    logInfo('LockedTransfer Received: ', message);

    let {channelIdentifier, balanceHash, nonce, signature } = message;

    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier, round: channel.currentRound });
    if (!bet || bet.status != Constants.BET_INIT) return;

    logInfo('bet is', bet);

    if(bet.positiveA != this.scclient.from){
      return;
    }
    let round = bet.round;

    if(!this.messageValidator.checkLockedTransfer(message, channel.partner)){
      logError("check Message LockedTransfer failed");
      return;
    }
    // check Balance Hash
    let { isValidBalanceHash, transferred_amount, locked_amount } = await this.checkBalanceHash(channelIdentifier, balanceHash, 0, bet.winAmount, round, channel.remoteNonce);
    if (!isValidBalanceHash){
      logError("check balanceHash failed");
      return;
    } 


    // save received transfer to db
    let oppositeTransfer = { channelId: channelIdentifier, balanceHash, transferred_amount, locked_amount, round, nonce, signature, owned: 1 };
    await this.scclient.dbhelper.addTransfer(oppositeTransfer);
    await this.updateBalance(channelIdentifier, 0, bet.winAmount, { remoteNonce: nonce }, false);

    await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_LOCK_ONE });

    if (this.scclient.autoRespondLockedTransfer) {
      //generate LockedTransfer
      let lockedTransfer = await this.getLockedTransfer(channelIdentifier, bet.value, round, channel.localNonce);
      //send LockedR to opposite
      await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_LOCK_TWO });
      this.socket.emit('LockedTransferR', lockedTransfer);
    }

  }

  /**
   * Handler for accept LockedTransferR消息
   * 1. 检查消息合法性
   * 2. 更新通道余额和transfer数据
   * 3. 生成BetResponse消息，发送给对方
   * @param message LockedTranferR消息体
   */
  async onLockedTransferR(message) {
    // 检测是否符合条件
    // 发送BetResponse
    logInfo('LockedTransferR Received: ', message);

    //check LockedTransferR
    let {channelIdentifier, balanceHash, nonce, signature } = message;

    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier, round: channel.currentRound });
    logInfo('bet is ', bet);
    if (!bet || bet.status != Constants.BET_LOCK_ONE) return;

    if(bet.negativeB != this.scclient.from){
      return;
    }


    if (!this.messageValidator.checkLockedTransfer(message, channel.partner)) {
      logInfo("check Message LockedTransferR failed");
      return;
    }

    let round = bet.round;

    // check Balance Hash
    let { isValidBalanceHash, transferred_amount, locked_amount } = await this.checkBalanceHash(channelIdentifier, balanceHash, 0, bet.value, round, channel.remoteNonce);
    if (!isValidBalanceHash){
      logError("check balanceHash failed");
      return;
    } 

    // save received transfer to db
    let oppositeTransfer = { channelId: channelIdentifier, balanceHash, transferred_amount, locked_amount, round, nonce, signature, owned: 1 };
    await this.scclient.dbhelper.addTransfer(oppositeTransfer);
    await this.updateBalance(channelIdentifier, 0, bet.value, { remoteNonce: nonce }, false);
    await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_LOCK_TWO });
      

    if(this.scclient.autoRespondLockedTransferR){
      //generate Rb 
      let rb = await this.scclient.cryptohelper.generateRandomHex("hello");
      const betResponse = this.scclient.messageGenerator.generateBetResponse(channelIdentifier, round, bet.betMask, bet.modulo, bet.positiveA, bet.negativeB, bet.hashRa, bet.signatureA, rb);
      // update bet info
      await this.scclient.dbhelper.updateBet(bet.betId, { rb, signatureB: betResponse.signatureB, status: Constants.BET_LOCK_TWO });
      //send BetResponse to opposite
      await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_START });
      logInfo(this.eventManager.sendBetPlaced);
      this.eventManager.sendBetPlaced(channel, bet);
      this.socket.emit('BetResponse', betResponse);
    }

  }

  /**
   * Handler for accepte BetResponse消息
   * 1. 检查消息合法性
   * 2. 判断输赢，更新赌局
   * 3. 发送BetPlaced消息给外部监听器
   * 4. 生成Preimage消息发送给对方
   * @param message BetResponse消息体
   */
  async onBetResponse(message) {
    // 检测是否符合条件
    // 判断输赢 赢：发送Preimage， 输：发送Preimage+DirectTransfer
    logInfo('BetResponse Received: ', message);

    // check BetResponse
    let { channelIdentifier, round, Rb: rb, betMask, modulo, positiveA, negativeB, hashRa, signatureA, signatureB } = message;

    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({
      channelId: channelIdentifier,
      round,
      betMask,
      modulo,
      positiveA,
      negativeB,
      hashRa,
      signatureA
    });
    if (!bet || bet.status != Constants.BET_LOCK_TWO) return;

    if (bet.positiveA != this.scclient.from) { return; }

    if (!this.messageValidator.checkBetResponse(message, channel.partner)) {
      logInfo("check Message BetResponse failed");
      return;
    }

    logInfo("bet is", bet);
    // check Win or Lose
    let isWinner = GameRule.winOrLose(this.web3, betMask, modulo, bet.ra, rb, true);

    // update Bet in database
    await this.scclient.dbhelper.updateBet(bet.betId, { rb, signatureB, winner: isWinner, status: Constants.BET_START });
    logInfo(this.eventManager.sendBetPlaced);
    this.eventManager.sendBetPlaced(channel, bet);

    if (this.scclient.autoRespondBetResponse) {
    // send Preimage to opposite
      const preimageMessage = this.scclient.messageGenerator.generatePreimage(channelIdentifier, round, bet.ra);
      await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_PREIMAGE });
      await this.socket.emit('Preimage', preimageMessage);

    }

  }

  /**
   * Handler for accept Preimage
   * 1. 检验消息合法性
   * 2. 计算输赢，更新赌局
   * 3. 生成DirectTransfer，发送给对方
   * @param message Preimage消息体
   */
  async onPreimage(message) {
    // 检测是否符合条件
    // 判断输赢 赢：doNothing 设置timeout(如果一直未改变，关闭通道) 输：DirectTransfer
    logInfo('Preimage Received: ', message);

    let { channelIdentifier, ra, round } = message;
    // check Preimage

    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    // update Bet in database
    let bet = await this.scclient.dbhelper.getBetByChannel({channelId: channelIdentifier, round});
    if (!bet || bet.status != Constants.BET_START) return; 

    if (this.scclient.from != bet.negativeB) return;

    if (!this.messageValidator.checkPreimage(message, bet.hashRa)) {
      logError("check Preimage hash failed");
      return;
    }


    // check Win or Lose
    let isWinner = GameRule.winOrLose(this.web3, bet.betMask, bet.modulo, ra, bet.rb, false);
    await this.scclient.dbhelper.updateBet(bet.betId, {
      ra,
      winner: isWinner,
      status: Constants.BET_PREIMAGE
    });



    if (this.scclient.autoRespondPreimage) {
      // If lose send DirectTransfer to opposite
      await this.scclient.dbhelper.updateBet(bet.betId, {
        status: Constants.BET_DIRECT_TRANSFER
      });
      if (!isWinner) {
        const directTransfer = await this.getDirectTransfer(channelIdentifier, bet.winAmount, bet.winAmount, round, channel.localNonce);
        logInfo("Lose the bet, will send direct transfer to oppsoite", directTransfer);
        await this.scclient.dbhelper.addPayment({
          betId: bet.betId,
          fromAddr: this.scclient.from,
          toAddr: channel.partner,
          value: bet.winAmount
        });
        this.socket.emit("DirectTransfer", directTransfer);
      } else {
        const directTransfer = await this.getDirectTransfer(channelIdentifier, 0, bet.winAmount, round, channel.localNonce);
        logInfo("Win the bet, will cancel locked transfer", directTransfer);
        this.socket.emit("DirectTransfer", directTransfer);
      }
    }

  }

  /**
   * Handler for accept DirectTransfer
   * 1. 检查消息合法性
   * 2. 更新通道余额和Tranfer
   * 3. 记录Payment到数据库， 发送PaymentReceived消息给外部
   * 4. 生成DirectTransferR，发送给对方
   * 5. 
   * @param message DirectTransfer消息体
   */
  async onDirectTransfer(message) {
    // 检测是否符合条件
    // 更新数据库
    logInfo('DirectTransfer Received: ', message);
    // do nothing
    //check DirectTransfer
    let {channelIdentifier, balanceHash, nonce, signature } = message;

    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier, round: channel.currentRound });
    if (!bet || bet.status != Constants.BET_PREIMAGE) return;

    if (this.scclient.from != bet.positiveA) return;

    let round = bet.round;

    // check Balance Hash
    let deltaTransferAmount = 0;
    let deltaLockedAmount = 0;

    if(this.scclient.from == bet.positiveA){
      deltaTransferAmount = bet.winner == 1 ? bet.winAmount: 0;
      deltaLockedAmount = -1 * parseInt(bet.winAmount);
    } else {
      deltaTransferAmount = bet.winner == 1 ? bet.value : 0;
      deltaLockedAmount = -1 * parseInt(bet.value);
    }
    let { isValidBalanceHash, transferred_amount, locked_amount } = await this.checkBalanceHash(channelIdentifier, balanceHash, deltaTransferAmount, deltaLockedAmount, 0, channel.remoteNonce);
    if (!isValidBalanceHash){
      logError("check balanceHash failed");
      return;
    } 

    // save received transfer to db
    let oppositeTransfer = { channelId: channelIdentifier, balanceHash, transferred_amount, locked_amount, round, nonce, signature, owned: 1 }
    await this.scclient.dbhelper.addTransfer(oppositeTransfer);
    await this.updateBalance(channelIdentifier, deltaTransferAmount, deltaLockedAmount, { remoteNonce: nonce }, false);
    await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_DIRECT_TRANSFER });



    if (this.scclient.autoRespondDirectTransfer) {
      // If lose send DirectTransferR to opposite
      let directTransfer = null;
      if (bet.winner != 1) {
        directTransfer = await this.getDirectTransfer(channelIdentifier, bet.value, bet.value, round, channel.localNonce);
        logInfo("Lose the bet, will send direct transfer to oppsoite", directTransfer);
        await this.scclient.dbhelper.addPayment({
          betId: bet.betId,
          fromAddr: this.scclient.from,
          toAddr: channel.partner,
          value: bet.value
        });
      } else {
        directTransfer = await this.getDirectTransfer(channelIdentifier, 0, bet.value, round, channel.localNonce);
        logInfo("Win the bet, will cancel locked transfer", directTransfer);
      }
      // await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_DIRECT_TRANSFER });

      // update bet status to finished
      if (deltaTransferAmount > 0) {
        await this.scclient.dbhelper.addPayment({
          betId: bet.betId,
          fromAddr: channel.partner,
          toAddr: this.scclient.from,
          value: deltaTransferAmount
        });
        this.eventManager.sendPaymentReceived(channel, bet);
      }

      await this.scclient.dbhelper.updateBet(bet.betId, {
        status: Constants.BET_DIRECT_TRANSFER_TWO
      });

      this.socket.emit("DirectTransferR", directTransfer);
    }

  }

  /**
   * Handler for accept DirectTransferR mesage
   * 1. 检查消息合法性
   * 2. 更新通道余额和transfer
   * 3. 更新Bet数据
   * 4. 发送BetSettled事件给外部监听器
   * 5. 生成BettleSettle消息，发送给对方
   * @param message DirectTransferR消息体
   */
  async onDirectTransferR(message){
 // 检测是否符合条件
    // 更新数据库
    logInfo("DirectTransferR Received: ", message);
    // do nothing
    //check DirectTransfer
    let {channelIdentifier, balanceHash, nonce, signature } = message;

    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier, round: channel.currentRound });
    if (!bet || bet.status != Constants.BET_DIRECT_TRANSFER) return;

    if(this.scclient.from != bet.negativeB) return;

    let round = bet.round;

    // check Balance Hash
    let deltaTransferAmount =  bet.winner == 1 ? bet.value : 0;
    let deltaLockedAmount = -1 * parseInt(bet.value);

    let { isValidBalanceHash, transferred_amount, locked_amount } = await this.checkBalanceHash(channelIdentifier, balanceHash, deltaTransferAmount, deltaLockedAmount, 0, channel.remoteNonce);
    if (!isValidBalanceHash){
      logError("check balanceHash failed");
      return;
    } 

    // save received transfer to db
    let oppositeTransfer = { channelId: channelIdentifier, balanceHash, transferred_amount, locked_amount, round, nonce, signature, owned: 1 }
    await this.scclient.dbhelper.addTransfer(oppositeTransfer);
    await this.updateBalance(channelIdentifier, deltaTransferAmount, deltaLockedAmount, { remoteNonce: nonce }, false);

    // await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_DIRECT_TRANSFER });

    // update bet status to finished
    if (deltaTransferAmount > 0){
      await this.scclient.dbhelper.addPayment({ betId: bet.betId, fromAddr: channel.partner, toAddr: this.scclient.from, value: deltaTransferAmount });
      this.eventManager.sendPaymentReceived(channel, bet);
    }

    await this.scclient.dbhelper.updateBet(bet.betId, {
      status: Constants.BET_FINISH
    });

    this.socket.emit('BetSettle', { channelIdentifier, round });

    logInfo('eventManager', this.eventManage);
    this.eventManager.sendBetSettled(channel, bet);

  }

  /**
   * Handler for accept BetSettle message
   * 1. 检查消息合法性
   * 2. 更新bet
   * 3. 发送BetSettled消息给外部事件监听器
   * @param  message 
   */
  async onBetSettle(message){
    logInfo("BetSettle Received: ", message);
    // do nothing
    //check DirectTransfer
    let { channelIdentifier, round } = message; 
    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier, round: channel.currentRound });
    if (!bet || bet.status != Constants.BET_DIRECT_TRANSFER_TWO) return;

    if (this.scclient.from != bet.positiveA) return;

    await this.scclient.dbhelper.updateBet(bet.betId, {
      status: Constants.BET_FINISH
    });

    logInfo('eventManager', this.eventManager);
    this.eventManager.sendBetSettled(channel, bet);

  }



  /**
   * Handler for accept CooperativeSettleRequest message
   * 1. 检查消息合法性：余额/签名
   * 2. 构造CooperativeSettle完整消息，发送给区块链以关闭通道
   * @param message CooperativeSettleRequest message body 
   */
  async onCooperativeSettle(message){

    logInfo('CooperativeSettleRequest Received: ', message);
    let { paymentContract, channelIdentifier, p1, p1Balance, p2, p2Balance, p1Signature } = message;

    // check balance
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return; 

    await this.scclient.sync(channel.partner);

    if(p1 != channel.partner
      || p2 != this.scclient.from
      ||p1Balance != channel.remoteBalance 
      || p2Balance != channel.localBalance
      ){
        logError('balance is not correct');
        return;
      }
    // check partner signature

    if(!this.scclient.messageValidator.checkCooperativeSettleRequest(message, p1)){
      logError("invalid signature for cooperativeSettleRequest");
      return;
    }

    // sign Message, then submit to blockchain
    let cooperativeSettleRequest = this.scclient.messageGenerator.genreateCooperativeSettleRequest(channelIdentifier, p1, p1Balance, p2, p2Balance);
    let p2Signature = cooperativeSettleRequest.signature;

    cooperativeSettleRequest.p1Signature = p1Signature;
    cooperativeSettleRequest.p2Signature = p2Signature;

    this.socket.emit("CooperativeSettleResponse", cooperativeSettleRequest);

    // await this.scclient.blockchainProxy.cooperativeSettle(p1, p1Balance, p2, p2Balance, this.web3.utils.hexToBytes(p1Signature), this.web3.utils.hexToBytes(p2Signature));
  }

  async onCooperativeSettleResponse(message){

    logInfo('CooperativeSettleResponse Received: ', message);
    let { paymentContract, channelIdentifier, p1, p1Balance, p2, p2Balance, p1Signature, p2Signature } = message;
    // check balance
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) return; 

    if(p2 != channel.partner
      || p1 != this.scclient.from
      ||p2Balance != channel.remoteBalance 
      || p1Balance != channel.localBalance
      ){
        logError('balance is not correct');
        return;
      }
    // check partner signature

    if(!this.scclient.messageValidator.checkCooperativeSettleRequest(message, p1, p2)){
      logError("invalid signature for cooperativeSettleRequest");
      return;
    }

    await this.scclient.blockchainProxy.cooperativeSettle(p1, p1Balance, p2, p2Balance, this.web3.utils.hexToBytes(p1Signature), this.web3.utils.hexToBytes(p2Signature));
  }




}

module.exports = MessageHandler;
