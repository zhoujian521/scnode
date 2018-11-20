// subscribe all events from contract
/**
 * 监控链上支付合约和游戏合约返回的各种事件，并做响应的处理
 * 处理事件列表
 * PaymentContract:
 * 1. ChannelOpened
 * 2. ChannelNewDeposit
 * 3. CooperativeSettled
 * 4. ChannelClosed
 * 5. NonclosingUpdateBalanceProof
 * 6. ChannelSettled
 * 7. ChannelLockedSent
 * 8. ChannelLockedReturn
 * 
 * GameContract:
 * 1. InitiatorSettled
 * 2. AcceptorSettled
 * 3. InitiatorRevealed
 */
const Constants = require('./Constants');
const ProofGenerator = require("./utils/proofGenerator");


class BlockChainEventHandler {

  constructor(web3, config, scclient) {
    
    let { paymentContractAddress, paymentContractAbi, gameContractAddress, gameContractAbi, fromAddress } = config;

    this.web3 = web3;
    this.from = fromAddress;

    this.eventManager = scclient.eventManager;
    this.dbhelper = scclient.dbhelper;
    this.blockchainProxy = scclient.blockchainProxy;
    this.proofGenerator = new ProofGenerator(scclient);
    
    this.paymentContract = new web3.eth.Contract(paymentContractAbi, paymentContractAddress);
    this.gameContract = new web3.eth.Contract(gameContractAbi, gameContractAddress);
    logInfo('BlockChainEventHandler constructor', this.from);
  }

  /**
   * 开启监听处理区块链消息
   */
  start(){

    //Payment Contract Events
    this.paymentContract.events.ChannelOpened({}, this.onChannelOpen.bind(this));
    this.paymentContract.events.ChannelNewDeposit({}, this.onChannelDeposit.bind(this));
    this.paymentContract.events.ChannelClosed({}, this.onChannelClose.bind(this));
    this.paymentContract.events.NonclosingUpdateBalanceProof({}, this.onChannelUpdateBalanceProof.bind(this));
    this.paymentContract.events.ChannelSettled({}, this.onChannelSettle.bind(this));
    this.paymentContract.events.ChannelLockedSent({}, this.onChannelLockedSent.bind(this));
    this.paymentContract.events.ChannelLockedReturn({}, this.onChannelLockedReturn.bind(this));
    this.paymentContract.events.CooperativeSettled({}, this.onCooperativeSettle.bind(this));


    //Game Contract Events
    this.gameContract.events.InitiatorSettled({}, this.onGameInitiatorSettled.bind(this));
    this.gameContract.events.AcceptorSettled({}, this.onGameAcceptorSettled.bind(this));
    this.gameContract.events.InitiatorRevealed({}, this.onGameInitiatorRevealed.bind(this));

  }

  /**
   * handler for event ChannelOpen
   * 1. 数据库添加通道信息到本地
   * 2. 对外抛出ChannelOpen消息
   * @param  error 
   * @param  event 
   */
  async onChannelOpen(error, event) {
    logInfo('onChannelOpen', event);

    // 检查消息是否合法
    if(error){
      logInfo('onChannelOpen error', error);
      return;
    }
    let { participant1, participant2, channelIdentifier, settle_timeout, amount } = event.returnValues;

    logInfo('BlockChainEventHandler constructor', this.from, participant1, participant2)
    if (participant1 != this.from && participant2 != this.from) {
      return;
    }

    //find channel from database
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    let openedBySelf = participant1 == this.from;

    if(!channel){
      // init channel here
        channel = {
          channelId: channelIdentifier,
          partner: '',
          settleTimeout: settle_timeout,
          totalDeposit: 0,
          partnerTotalDeposit: 0,
          localBalance: 0,
          remoteBalance: 0,
          localLockedAmount: 0,
          remoteLockedAmount: 0,
          currentRound: 0,
          localNonce: 0,
          remoteNonce: 0,
          status: Constants.CHANNEL_OPENED
        };
      if(openedBySelf){
        channel = Object.assign(channel, { partner: participant2, totalDeposit: amount, localBalance: amount });
      }else{
        channel = Object.assign(channel, { partner: participant1, partnerTotalDeposit: amount, remoteBalance: amount });
      }

      // add channel to db
      await this.dbhelper.addChannel(channel);
    }

    //emit channel open event
    this.eventManager.sendChannelOpen(channel);

  }

  /**
   * Handler for event ChannelDeposit
   * 1. 更新数据库中通道信息 totalDeposit, localBalance, partnerTotalDeposti, remoteBalance
   * @param  error 
   * @param  event 
   */
  async onChannelDeposit(error, event) {
    logInfo('onChannelDeposit', event);
    // 查询合约，更新通道双方deposit和余额
    if(error){
      logInfo('onChannelDeposit error', error);
      return;
    }
    let { channel_identifier, participant, total_deposit } = event.returnValues;

    let channel = await this.dbhelper.getChannel(channel_identifier);
    if (!channel) return;

    // query blockchain to verify event

    // update channel balance
    let newAttr = {};
    if(participant == this.from){
      let delta = this.web3.utils.toBN(total_deposit)
        .sub(this.web3.utils.toBN(channel.totalDeposit));
      newAttr = {
        totalDeposit: total_deposit,
        localBalance: this.web3.utils.toBN(channel.localBalance).add(delta).toString(10)
      }

    }else{
      let delta = this.web3.utils.toBN(total_deposit)
        .sub(this.web3.utils.toBN(channel.partnerTotalDeposit));
      newAttr = {
        partnerTotalDeposit: total_deposit,
        remoteBalance:  this.web3.utils.toBN(channel.remoteBalance).add(delta).toString(10)
      }
    }

    await this.dbhelper.updateChannel(channel_identifier, newAttr);

    //TODO emit channel Desposit event
    
  }

  /**
   * Handler for event ChannelClose
   * 
   * 1. 更新通道状态和相关数据 status, localCloseBalanceHash, remoteCloseBalanceHash
   * 2. 设置结算通道的定时器，此处设置为120s，TODO: 可能会更改
   * 3. 如果是己方提交的强关请求
   *     a. 如果自己是玩家，提交initiatorSettleData到游戏合约
   *     b. 如果自己是庄家，需要提交acceptorSettleData到游戏合约（TODO)
   * 4. 如果不是己方提交的强关请求，提交相应的balanceProof到通道合约
   * 
   * @param  error 
   * @param  event 
   */
  async onChannelClose(error, event) {
    // 查询合约和本地数据库
    // 决定是否提交BalanceProof
    logInfo('onChannelClose', event);
    if(error){
      logInfo('onChannelClose error', error);
      return;
    }
    let { channel_identifier, closing, balanceHash } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channel_identifier);
    if(!channel) return;

    let closedBySelf = closing == this.from;
    // update channel status
    let status = Constants.CHANNEL_CLOSED;
    let channelData = { closeType: Constants.CLOSE_FORCE, status, closedBySelf };
    if (closedBySelf) {
      channelData.localCloseBalanceHash = balanceHash;
    } else {
      channelData.remoteCloseBalanceHash = balanceHash;
    };
    await this.dbhelper.updateChannel(channel_identifier, channelData);

    //设置settleChannel定时器
    setTimeout(async () => {
      await this.settleChannel(channel_identifier);
    }, 120000);

    let bet = await this.dbhelper.getBetByChannel({ channelId: channel.channelId, round: channel.currentRound });
    if(!closedBySelf){
      if (!bet) return;
      // 非强关方提交相关余额证据
      let remoteBalanceProof = await this.proofGenerator.getBalanceProof(channel);
      await this.blockchainProxy.updateBalanceProof(remoteBalanceProof.closing, remoteBalanceProof.balanceHash, remoteBalanceProof.nonce, remoteBalanceProof.signature);
    }else{
      if (!bet) return;
      // 强关方是玩家
      if (bet.positiveA == this.from) {
        //提交initiatorSettle
        if (bet.status >= Constants.BET_START && bet.status != Constants.BET_FINISH) {
          let initiatorSettleData = await this.proofGenerator.getInitiatorSettleData(channel, bet);

          await this.blockchainProxy.initiatorSettle(initiatorSettleData.channelIdentifier, initiatorSettleData.round, initiatorSettleData.betMask, initiatorSettleData.modulo, initiatorSettleData.positive, initiatorSettleData.negative, initiatorSettleData.initiatorHashR, initiatorSettleData.initiatorSignature, initiatorSettleData.acceptorR, initiatorSettleData.acceptorSignature, initiatorSettleData.initiatorR);

        }else{
          // 其他状态不认为赌局已开始，不提交游戏仲裁
        }

      }else{
        //强关方是庄家
        if(bet.status >= Constants.BET_START && bet.status != Constants.BET_FINISH){
          let acceptorSettleData = await this.proofGenerator.getAcceptorSettleData(channel, bet);
          await this.blockchainProxy.acceptorSettle(acceptorSettleData.channelIdentifier, acceptorSettleData.round, acceptorSettleData.betMask, acceptorSettleData.modulo, acceptorSettleData.positive, acceptorSettleData.negative, acceptorSettleData.initiatorHashR, acceptorSettleData.initiatorSignature, acceptorSettleData.acceptorR);
        }else{
          //其他状态不认为赌局已经开始, 不提交游戏仲裁
        }
      }
    }
  }

  /**
   * 提交结算通道请求
   * @param channelId 通道ID
   * @returns 返回区块链提交结果
   */
  async settleChannel(channelId){
    //refresh channel status
    let channel = await this.dbhelper.getChannel(channelId);
    let settleData = await this.proofGenerator.getSettleData(channel, channel.localCloseBalanceHash, channel.remoteCloseBalanceHash);
    let { participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id } = settleData;
    return await this.blockchainProxy.settle(participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id);
  }

  /**
   * Handler for ChannelUpdateBalanceProof 
   * 1. 更新通道相关数据 status, remoteCloseBalanceHash/localCloseBalanceHash
   * @param  error 
   * @param  event 
   */
  async onChannelUpdateBalanceProof(error, event) {
    logInfo('onChannelUpdateBalanceProof', event);
    // 查询合约，提交settle
    if(error){
      logInfo('onChannelUpdateBalanceProof error', error);
      return;
    }

    let { channel_identifier, nonclosing, balanceHash } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channel_identifier);
    if (!channel) return;
    
    let updateData = { status: Constants.CHANNEL_UPDATEBALANCEPROOF };
    let closedBySelf = channel.closedBySelf;
    if(closedBySelf){
      updateData.remoteCloseBalanceHash = balanceHash;
    }else{
      updateData.localCloseBalanceHash= balanceHash;
    }
    await this.dbhelper.updateChannel(channel_identifier, updateData);


  }

  /**
   * Handler for ChannelSettled 
   * 1. 更新通道相关数据 status localSettleBalance remoteSettleBalance closeLockIdentifier
   * 2. 设置定时器 解锁通道锁定余额 此处设置时间为30s TODO: 可能会修改
   * @param error 
   * @param event 
   */
  async onChannelSettle(error, event) {
    logInfo('onChannelSettle', event);
    // 查询合约，关闭通道，并更新结果
    if(error){
      logInfo('onChannelSettle error', error);
      return;
    }
    let { channelIdentifier, participant1, participant2, lockedIdentifier, transferToParticipant1Amount, transferToParticipant2Amount } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    if (!channel) return;
    if (participant1 != this.from && participant2 != this.from) return;
    await this.dbhelper.updateChannel(channelIdentifier, {
      status: Constants.ChannelSettled,
      localSettleBalance: participant1 == this.from? transferToParticipant1Amount: transferToParticipant2Amount,
      remoteSettleBalance: participant1 == this.from? transferToParticipant2Amount: transferToParticipant1Amount,
      closeLockIdentifier: lockedIdentifier,
    });

    // will unlock channel
    setTimeout(async () => {
      await this.blockchainProxy.unlock(participant1, participant2, lockedIdentifier);
    }, 30000);
  }

  /**
   * Handler for event ChannelLockedSent 
   * 1. 更新通道状态 status remoteLockedSentAmount/localLockedSentAmount
   * @param error 
   * @param event 
   */
  async onChannelLockedSent(error, event){

    logInfo('onChannelLockedSent', event);
    if(error){
      logInfo('onChannelLockedSent error', error);
      return;
    }
    let { channelIdentifier, beneficiary, amount } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    if (!channel) return;

    let updateData = { status: Constants.CHANNEL_UNLOCKFINISHED };
    if(this.from == beneficiary){
      updateData.remoteLockedSentAmount = amount;
    }else{
      updateData.localLockedSentAmount = amount;
    }
    await this.dbhelper.updateChannel(channelIdentifier, updateData);

  }

  /**
   * Handler for event ChannelLockedReturn 
   * 1. 更新通道状态 status localLockedReturnAmount/remoteLockedReturnAmount
   * @param error 
   * @param event 
   */
  async onChannelLockedReturn(error, event){

    logInfo('onChannelLockedReturn', event);
    if(error){
      logInfo('onChannelLockedReturn error', error);
      return;
    }
    let { channelIdentifier, beneficiary, amount } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    if (!channel) return;

    let updateData = { status: Constants.CHANNEL_UNLOCKFINISHED };
    if(this.from == beneficiary){
      updateData.localLockedReturnAmount = amount;
    }else{
      updateData.remoteLockedReturnAmount = amount;
    }
    await this.dbhelper.updateChannel(channelIdentifier, updateData);
  }



  /**
   * Handler for event GameInitiatorSettled
   * 1. Do nothing
   * @param error 
   * @param event 
   */
  async onGameInitiatorSettled(error, event){
    logInfo('onGameInitiatorSettled', event);
    if (error) {
      logInfo("onGameInitiatorSettled error", error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, winner } = event.returnValues;

  }

  /**
   * Handler for event GameAcceptorSettled
   * 1. 如果是玩家，提交initiatorRevealData到游戏合约进行仲裁 
   * @param error 
   * @param event 
   */
  async onGameAcceptorSettled(error, event){
    logInfo('onGameAcceptorSettled', event);
    if(error){
      logInfo('onGameAcceptorSettled error', error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, lastRevealBlock } = event.returnValues;

    // initiator reveal ra
    if(this.from == initiator){
      let channelIdentifier = await this.blockchainProxy.getChannelIdentifier(acceptor);
      let diceInfo = await this.blockchainProxy.getRoundIdentifier_to_diceInfo(roundIdentifier);
      let bet = await this.dbhelper.getBetByChannel({channelId: channelIdentifier, hashRa: diceInfo.initiatorHashR});
      await this.blockchainProxy.initiatorReveal(channelIdentifier, bet.round, bet.ra);
    }

  }

  /**
   * Handler for GameInitiatorRevealed Event
   * 1. Do nothing
   * @param error 
   * @param event 
   */
  async onGameInitiatorRevealed(error, event){
    logInfo('onGameInitiatorRevealed', event);
    if(error){
      logInfo('onGameInitiatorRevealed error', error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, winner } = event.returnValues;
  }

  /**
   * Handler for event CooperativeSettle
   * 1. 更新通道状态 status localSettleBalance remoteSettleBalance
   * 2. 发送CooperativeSettled事件给前端
   * @param error 
   * @param event
   */
  async onCooperativeSettle(error, event){

    logInfo('onCooperativeSettle', event);
    if(error){
      logInfo('onCooperativeSettle error', error);
      return;
    }
    let { channelIdentifier, participant1_balance, participant2_balance } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    let updateData = { status: Constants.CHANNEL_UNLOCKFINISHED, closeType: Constants.CLOSE_COOPERATIVE, localSettleBalance: participant1_balance, remoteSettleBalance: participant2_balance };
    logInfo("after cooperativesettle, will update channel");
    await this.dbhelper.updateChannel(channelIdentifier, updateData);

    this.eventManager.sendCooperativeSettled(channel);
  }
}

module.exports = BlockChainEventHandler;
