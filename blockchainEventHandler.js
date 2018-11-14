// subscribe all events from contract
/**
 * 1. channelOpen
 * 2. channelDeposit
 * 3. channelClose
 * 4. channelUpdateBalanceProof
 * 5. channelSettle
 */
const Constants = require('./Constants');


class BlockChainEventHandler {

  constructor(web3, config, scclient) {
    
    let { paymentContractAddress, paymentContractAbi, gameContractAddress, gameContractAbi, fromAddress } = config;

    this.web3 = web3;
    this.from = fromAddress;

    this.eventManager = scclient.eventManager;
    this.dbhelper = scclient.dbhelper;
    
    this.paymentContract = new web3.eth.Contract(paymentContractAbi, paymentContractAddress);
    this.gameContract = new web3.eth.Contract(gameContractAbi, gameContractAddress);
    console.log('BlockChainEventHandler constructor', this.from);
  }

  /**
   * 开始监听处理区块链消息
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

  async onChannelOpen(error, event) {
    console.log('onChannelOpen', event);
    // query channel status
    if(error){
      console.log('onChannelOpen error', error);
      return;
    }
    let { participant1, participant2, channelIdentifier, settle_timeout, amount } = event.returnValues;

    console.log('BlockChainEventHandler constructor', this.from, participant1, participant2);

    if (participant1 != this.from && participant2 != this.from) {
      return;
    }

    //find channel from database
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    let openedBySelf = participant1 == this.from;

    if(!channel){
      // init channel here
      if(openedBySelf){
        channel = {
          channelId: channelIdentifier,
          partner: participant2,
          settleTimeout: settle_timeout,
          totalDeposit: amount,
          partnerTotalDeposit: 0,
          localBalance: amount,
          remoteBalance: 0,
          localLockedAmount: 0,
          remoteLockedAmount: 0,
          status: Constants.CHANNEL_OPENED
        };

      }else{
        channel = {
          channelId: channelIdentifier,
          partner: participant1,
          settleTimeout: settle_timeout,
          totalDeposit: 0,
          partnerTotalDeposit: amount,
          localBalance: 0,
          remoteBalance: amount,
          localLockedAmount: 0,
          remoteLockedAmount: 0,
          status: Constants.CHANNEL_OPENED
        };
      }
      await this.dbhelper.addChannel(channel);
    }
    this.eventManager.sendChannelOpen(channel);

  }

  async onChannelDeposit(error, event) {
    console.log('onChannelDeposit', event);
    // 查询合约，更新通道双方deposit和余额
    if(error){
      console.log('onChannelDeposit error', error);
      return;
    }
    let { channel_identifier, participant, total_deposit } = event.returnValues;

    let channel = await this.dbhelper.getChannel(channel_identifier);
    if (!channel) return;

    // query blockchain to verify event

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
    
  }

  async onChannelClose(error, event) {
    // 查询合约和本地数据库
    // 决定是否提交BalanceProof
    console.log('onChannelClose', event);
    if(error){
      console.log('onChannelClose error', error);
      return;
    }
    let { channel_identifier, closing, balanceHash } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channel_identifier);
    if(!channel) return;

    let status = Constants.CHANNEL_CLOSED;
    await this.dbhelper.updateChannel(channel_identifier, {status});

    let closedBySelf = closing == this.from;

    if(!closedBySelf){
      // submit balance proof to blockchain, get BalanceProof from local DB
      let remoteBalanceProof = await this.dbhelper.getCurrentTransfer(channel_identifier);
      await this.blockChainProxy.updateBalanceProof(remoteBalanceProof);
    }else{
      //update database here.

    }

    // 判断是否提交GameContract相关逻辑



  }

  async onChannelUpdateBalanceProof(error, event) {
    console.log('onChannelUpdateBalanceProof', event);
    // 查询合约，提交settle
    if(error){
      console.log('onChannelUpdateBalanceProof error', error);
      return;
    }

    let { channel_identifier, nonclosing, balanceHash } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channel_identifier);
    if (!channel) return;
    
    let status = Constants.CHANNEL_UPDATEBALANCEPROOF;
    await this.dbhelper.updateChannel(channel_identifier, {status});

    // 判断是否提交GameContract相关逻辑

  }

  async onChannelSettle(error, event) {
    console.log('onChannelSettle', event);
    // 查询合约，关闭通道，并更新结果
    if(error){
      console.log('onChannelSettle error', error);
      return;
    }
    let { channel_identifier, lockedIdentifier, participant, transferToParticipantAmount } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channel_identifier);
    if (!channel) return;
    if (participant != this.from) return;

    let status = Constants.ChannelSettled;
    await this.dbhelper.updateChannel(channel_identifier, {status});

    //TODO check locked amount, query blockchain to get lock amount
    let lockedAmount = 10;

    if(lockedAmount > 0){
      await this.blockChainProxy.unlock();
    }else{
      let status = 6;
      await this.dbhelper.updateChannel(channel_identifier, {status});
    }
  }

  async onChannelLockedSent(error, event){

    console.log('onChannelLockedSent', event);
    if(error){
      console.log('onChannelLockedSent error', error);
      return;
    }
    let { channel_identifier, beneficiary, amount } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channel_identifier);
    if (!channel) return;
    if (participant != this.from) return;

      let status = Constants.CHANNEL_UNLOCKFINISHED;
      await this.dbhelper.updateChannel(channel_identifier, {status});
  }

  async onChannelLockedReturn(error, event){

    console.log('onChannelLockedReturn', event);
    if(error){
      console.log('onChannelLockedReturn error', error);
      return;
    }
    let { channel_identifier, beneficiary, amount } = event.returnValues;

    let status = Constants.CHANNEL_UNLOCKFINISHED;
    await this.dbhelper.updateChannel(channel_identifier, {status});
  }

  async onCooperativeSettle(error, event){

    console.log('onCooperativeSettle', event);
    if(error){
      console.log('onCooperativeSettle error', error);
      return;
    }
    let { channelIdentifier, participant1_balance, participant2_balance } = event.returnValues;
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    let status = Constants.CHANNEL_UNLOCKFINISHED;
    console.log("after cooperativesettle, will update channel");
    await this.dbhelper.updateChannel(channelIdentifier, { status });

    this.eventManager.sendCooperativeSettled(channel);
  }



  async onGameInitiatorSettled(error, event){
    console.log('onGameInitiatorSettled', event);
    if (error) {
      console.log("onGameInitiatorSettled error", error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, winner } = event.returnValues;

  }
  async onGameAcceptorSettled(error, event){
    console.log('onGameAcceptorSettled', event);
    if(error){
      console.log('onGameAcceptorSettled error', error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, lastRevealBlock } = event.returnValues;

  }
  async onGameInitiatorRevealed(error, event){
    console.log('onGameInitiatorRevealed', event);
    if(error){
      console.log('onGameInitiatorRevealed error', error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, winner } = event.returnValues;

  }

}

module.exports = BlockChainEventHandler;
