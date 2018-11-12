/**
 * 1. BetRequest
 * 2. LockedTransfer
 * 3. LockedTransferR
 * 4. BetResponse
 * 5. Preimage/DirectTransfer
 * 6. DirectTransfer
 *
 */


const Ecsign = require('./utils/ecsign');
const MessageGenerator = require('./utils/messageGenerator');
const RandomUtil = require('./utils/random');
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
      .on("CooperativeSettleRequest", this.onCooperativeSettle.bind(this));
  }

  async onBetRequest(message) {
    // 检测本地数据 和 BetRequest进行比对
    // 如果符合条件，给对方发送LockedTransfer
    console.log('BetRequest Received: ', message);

    //check BetRequest
    let { gameContractAddress, channelIdentifier, round, betMask, modulo, value, positiveA, hashRa, signatureA } = message;
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if(!channel) return;

    if(!this.messageValidator.checkBetRequest(message, channel.parter)){
      console.log("check Message BetRequest failed");
      return;
    }
    

    let bet = await this.scclient.dbhelper.getBetByChannel({channelId: channelIdentifier, round})
    if(bet){
      console.error('receive betRequest on exist round again');
      return;
    }
  

    let winAmount = GameRule.getPossibleWinAmount(betMask, modulo, value);
    //save bet to database
    bet = { gameContractAddress, channelId: channelIdentifier, round, betMask, modulo, value, positiveA, negativeB: this.scclient.from, hashRa, signatureA, winAmount, status: Constants.BET_INIT };
    await this.scclient.dbhelper.addBet(bet);

    let lockedTransfer = await this.getLockedTransfer(channelIdentifier, winAmount, round);

    //send LockedTransfer to opposite
    this.socket.emit('LockedTransfer', lockedTransfer);

  }


  async getLockedTransfer(channelIdentifier, winAmount, round) {
    //generate LockedTransfer
    let currentTransfer = await this.scclient.dbhelper.getLatestTransfer(channelIdentifier, 0);
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

    return lockedTransfer;

  }


  async getDirectTransfer(channelIdentifier, sendAmount, round){

    //generate LockedTransfer
    let currentTransfer = await this.scclient.dbhelper.getLatestTransfer(channelIdentifier, 0);
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

    return lockedTransfer;

  }

  async checkBalanceHash(balanceHash, deltaTransferAmount, deltaLockedAmount, round){

    return true;
  }



  async onLockedTransfer(message) {
    // 检测是否符合条件, 如果符合条件 给对方发送LockedTransferR
    console.log('LockedTransfer Received: ', message);

    let {channelIdentifier, balanceHash, nonce, signature } = message;

    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if(!channel) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier });
    if(!bet) return;

    console.log('bet is', bet);

    if(bet.positiveA != this.scclient.from){
      return;
    }
    let round = bet.round;

    if(!this.messageValidator.checkLockedTransfer(message, channel.parter)){
      console.error("check Message LockedTransfer failed");
      return;
    }
    // check Balance Hash
    let isValidBalanceHash = await this.checkBalanceHash(balanceHash, 0, bet.winAmount);
    if (!isValidBalanceHash){
      console.error("check balanceHash failed");
      return;
    } 


    // save received transfer to db
    let oppositeTransfer = { channelId: channelIdentifier, balanceHash, round, nonce, signature, owned: 1 }
    await this.scclient.dbhelper.addTransfer(oppositeTransfer);

    await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_LOCK_ONE });

    //generate LockedTransfer
    let lockedTransfer = await this.getLockedTransfer(channelIdentifier, bet.value, round);
    
    //send LockedR to opposite
    this.socket.emit('LockedTransferR', lockedTransfer);


  }

  async onLockedTransferR(message) {
    // 检测是否符合条件
    // 发送BetResponse
    console.log('LockedTransferR Received: ', message);

    //check LockedTransferR
    let {channelIdentifier, balanceHash, nonce, signature } = message;

    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if(!channel) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier });
    console.log('bet is ', bet);
    if(!bet) return;

    if(bet.negativeB != this.scclient.from){
      return;
    }

    if(!this.messageValidator.checkLockedTransfer(message, channel.parter)){
      console.log("check Message LockedTransferR failed");
      return;
    }

    // check Balance Hash
    let isValidBalanceHash = await this.checkBalanceHash(balanceHash, 0, bet.value);
    if (!isValidBalanceHash){
      console.error("check balanceHash failed");
      return;
    } 

    let round = bet.round;
    // save received transfer to db
    let oppositeTransfer = { channelId: channelIdentifier, balanceHash, round, nonce, signature, owned: 1 };
    await this.scclient.dbhelper.addTransfer(oppositeTransfer);

    //generate Rb 
    let rb = RandomUtil.generateRandomFromSeed("hello");
    const betResponse = this.scclient.messageGenerator.generateBetResponse(channelIdentifier, round, bet.betMask, bet.modulo, bet.positiveA, bet.negativeB, bet.hashRa, bet.signatureA, rb);

    // update bet info
    await this.scclient.dbhelper.updateBet(bet.betId, { rb, signatureB: betResponse.signatureB, status: Constants.BET_LOCK_TWO });

    //send BetResponse to opposite
    this.socket.emit('BetResponse', betResponse);

  }

  async onBetResponse(message) {
    // 检测是否符合条件
    // 判断输赢 赢：发送Preimage， 输：发送Preimage+DirectTransfer
    console.log('BetResponse Received: ', message);

    // check BetResponse
    let { channelIdentifier, round, Rb: rb, betMask, modulo, positiveA, negativeB, hashRa, signatureA, signatureB } = message;

    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if(!channel) return;

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
    if(!bet) return;

    if ( bet.positiveA != this.scclient.from) {
      return;
    }

    if (!this.messageValidator.checkBetResponse(message, channel.parter)) {
      console.log("check Message BetResponse failed");
      return;
    }

    console.log("bet is", bet);
    // check Win or Lose
    let isWinner = GameRule.winOrLose(betMask, modulo, bet.ra, rb, true);

    // send Preimage to opposite
    const preimageMessage = this.scclient.messageGenerator.generatePreimage(channelIdentifier, round, bet.ra);
    await this.socket.emit('Preimage', preimageMessage);

    // update Bet in database
    await this.scclient.dbhelper.updateBet(bet.betId, {
      rb,
      signatureB,
      winner: isWinner,
      status: Constants.BET_START
    });

    // If lose send DirectTransfer to opposite
    if(!isWinner){
      const directTransfer = await this.getDirectTransfer(channelIdentifier, bet.value, round);
      console.log('Lose the bet, will send direct transfer to oppsoite', directTransfer);
      this.socket.emit('DirectTransfer', directTransfer);
      await this.scclient.dbhelper.addPayment({
        betId: bet.betId,
        from: this.scclient.from,
        to: channel.parter,
        value: bet.value
      });
    } else {
      const directTransfer = await this.getDirectTransfer(channelIdentifier, 0, round);
      console.log('Win the bet, will cancel locked transfer', directTransfer);
      this.socket.emit('DirectTransfer', directTransfer);
    }


  }

  async onPreimage(message) {
    // 检测是否符合条件
    // 判断输赢 赢：doNothing 设置timeout(如果一直未改变，关闭通道) 输：DirectTransfer
    console.log('Preimage Received: ', message);

    let { channelIdentifier, ra, round } = message;
    // check Preimage

    // update Bet in database
    let bet = await this.scclient.dbhelper.getBetByChannel({channelId: channelIdentifier, round});

    // check Win or Lose
    let isWinner = GameRule.winOrLose(bet.betMask, bet.modulo, ra, bet.rb, false);
    await this.scclient.dbhelper.updateBet(bet.betId, {
      ra,
      winner: isWinner,
      status: Constants.BET_PREIMAGE
    });

    // If lose send DirectTransfer to opposite
    if(!isWinner){
      const directTransfer = await this.getDirectTransfer(channelIdentifier, bet.winAmount, round);
      console.log('Lose the bet, will send direct transfer to oppsoite', directTransfer);
      this.socket.emit('DirectTransfer', directTransfer);
      await this.scclient.dbhelper.addPayment({
        betId: bet.betId,
        from: this.scclient.from,
        to: channel.parter,
        value: winAmount
      });
    } else {
      const directTransfer = await this.getDirectTransfer(channelIdentifier, 0, round);
      console.log('Win the bet, will cancel locked transfer', directTransfer);
      this.socket.emit('DirectTransfer', directTransfer);
    }

  }

  async onDirectTransfer(message) {
    // 检测是否符合条件
    // 更新数据库
    console.log('DirectTransfer Received: ', message);
    // do nothing
    //check DirectTransfer
    let {channelIdentifier, balanceHash, nonce, signature } = message;

    //check LockedTransfer
    let channel = await this.scclient.dbhelper.getChannel(channelIdentifier);
    if(!channel) return;

    let bet = await this.scclient.dbhelper.getBetByChannel({ channelId: channelIdentifier });
    if(!bet) return;

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
    let isValidBalanceHash = await this.checkBalanceHash(balanceHash, deltaTransferAmount, deltaLockedAmount);
    if (!isValidBalanceHash){
      console.error("check balanceHash failed");
      return;
    } 

    let round = bet.round;
    // save received transfer to db
    let oppositeTransfer = { channelId: channelIdentifier, balanceHash, round, nonce, signature, owned: 1 }
    await this.scclient.dbhelper.addTransfer(oppositeTransfer);

    // update bet status to finished
    await this.scclient.dbhelper.updateBet(bet.betId, { status: Constants.BET_FINISH });
    if (deltaTransferAmount > 0){
      await this.scclient.dbhelper.addPayment({ betId: bet.betId, from: channel.partner, to: this.scclient.from, value: deltaTransferAmount });
    }

  }

  async onCooperativeSettle(message){

    console.log('CooperativeSettleRequest Received: ', message);
    // check balance

    // check partner signature

    // sign Message, then submit to blockchain

    let { paymentContract, channelIdentifier, p1, p1Balance, p2, p2Balance, p1Signature } = message;
    let shaMessage = Ecsign.mySha3(this.scclient.web3, paymentContract, channelIdentifier, p1, p1Balance, p2, p2Balance);
    console.log('shaMessage', shaMessage);
    let p2Signature = Ecsign.myEcsign(this.scclient.web3, shaMessage, this.scclient.privateKey);
    console.log('p2Signature', p2Signature);

    await this.scclient.blockchainProxy.cooperativeSettle(p1, p1Balance, p2, p2Balance, p1Signature, p2Signature);
  }
}

module.exports = MessageHandler;
