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
    
    this.paymentContract = new web3.eth.Contract(paymentContractAbi, paymentContractAddress);
    this.gameContract = new web3.eth.Contract(gameContractAbi, gameContractAddress);
  }

  /**
   * 开始监听处理区块链消息
   */
  start(){

    //Payment Contract Events
    this.paymentContract.events.ChannelOpened({}, this.onChannelOpen);
    this.paymentContract.events.ChannelNewDeposit({}, this.onChannelDeposit);
    this.paymentContract.events.ChannelClosed({}, this.onChannelClose);
    this.paymentContract.events.NonclosingUpdateBalanceProof({}, this.onChannelUpdateBalanceProof);
    this.paymentContract.events.ChannelSettled({}, this.onChannelSettle);
    this.paymentContract.events.ChannelLockedSent({}, this.onChannelLockedSent);
    this.paymentContract.events.ChannelLockedReturn({}, this.onChannelLockedReturn);
    this.paymentContract.events.CooperativeSettled({}, this.onCooperativeSettle);


    //Game Contract Events
    this.gameContract.events.InitiatorSettled({}, this.onGameInitiatorSettled);
    this.gameContract.events.AcceptorSettled({}, this.onGameAcceptorSettled);
    this.gameContract.events.InitiatorRevealed({}, this.onGameInitiatorRevealed);

  }

  async onChannelOpen(error, event) {
    // query channel status
    if(error){
      console.log('onChannelOpen error', error);
      return;
    }
    let { participant1, participant2, channel_identifier, settle_timeout } = event.returnValues.Result;

    if(participant1 != this.fromAddress && participant2 != this.fromAddress){
      return;
    }

    //find channel from database
    let channel = await this.dbHelper.getChannel(channel_identifier);

    if(!channel){
      // init channel here
      channel = {
        channelId: channel_identifier,
        partner: participant1 == this.from? participant2 : participant1,
        totalDeposit: 0,
        partnerTotalDeposit: 0,
        localBalance: 0,
        remoteBalance: 0,
        status: Constants.CHANNEL_OPENED
      };

      await this.dbHelper.addChannel(channel);

    }
    this.eventManager.sendChannelOpen(channel);

  }

  async onChannelDeposit(error, event) {
    // 查询合约，更新通道双方deposit和余额
    if(error){
      console.log('onChannelDeposit error', error);
      return;
    }
    let { channel_identifier, participant, total_deposit } = event.returnValues.Result;

    let channel = await this.dbHelper.getChannel(channel_identifier);
    if (!channel) return;

    let newAttr = {};
    if(participant == this.from){
      let delta = total_deposit - channel.totalDeposit;
      newAttr = {
        totalDeposit: total_deposit,
        localBalance: channel.localBalance + delta
      }

    }else{
      let delta = total_deposit - channel.partnerTotalDeposit;
      newAttr = {
        partnerTotalDeposit: total_deposit,
        localBalance: channel.remoteBalance + delta
      }
    }

    await this.dbHelper.updateChannel(channel_identifier, newAttr);
    
  }

  async onChannelClose(error, event) {
    // 查询合约和本地数据库
    // 决定是否提交BalanceProof
    if(error){
      console.log('onChannelClose error', error);
      return;
    }
    let { channel_identifier, closing, balanceHash } = event.returnValues.Result;
    let channel = await this.dbHelper.getChannel(channel_identifier);
    if(!channel) return;

    let status = Constants.CHANNEL_CLOSED;
    await this.dbHelper.updateChannel(channel_identifier, {status});

    let closedBySelf = closing == this.from;

    if(closedBySelf){
      // submit balance proof to blockchain, get BalanceProof from local DB
      let remoteBalanceProof = '';
      await this.blockChainProxy.updateBalanceProof(remoteBalanceProof);
    }else{
      //update database here.

    }

    // 判断是否提交GameContract相关逻辑



  }

  async onChannelUpdateBalanceProof(error, event) {
    // 查询合约，提交settle
    if(error){
      console.log('onChannelUpdateBalanceProof error', error);
      return;
    }

    let { channel_identifier, nonclosing, balanceHash } = event.returnValues.Result;
    let channel = await this.dbHelper.getChannel(channel_identifier);
    if (!channel) return;
    
    let status = Constants.CHANNEL_UPDATEBALANCEPROOF;
    await this.dbHelper.updateChannel(channel_identifier, {status});

    // 判断是否提交GameContract相关逻辑

  }

  async onChannelSettle(error, event) {
    // 查询合约，关闭通道，并更新结果
    if(error){
      console.log('onChannelSettle error', error);
      return;
    }
    let { channel_identifier, lockedIdentifier, participant, transferToParticipantAmount } = event.returnValues.Result;
    let channel = await this.dbHelper.getChannel(channel_identifier);
    if (!channel) return;
    if (participant != this.from) return;

    let status = Constants.ChannelSettled;
    await this.dbHelper.updateChannel(channel_identifier, {status});

    //TODO check locked amount, query blockchain to get lock amount
    let lockedAmount = 10;

    if(lockedAmount > 0){
      await this.blockChainProxy.unlock();
    }else{
      let status = 6;
      await this.dbHelper.updateChannel(channel_identifier, {status});
    }
  }

  async onChannelLockedSent(error, event){

    if(error){
      console.log('onChannelLockedSent error', error);
      return;
    }
    let { channel_identifier, beneficiary, amount } = event.returnValues.Result;
    let channel = await this.dbHelper.getChannel(channel_identifier);
    if (!channel) return;
    if (participant != this.from) return;

      let status = Constants.CHANNEL_UNLOCKFINISHED;
      await this.dbHelper.updateChannel(channel_identifier, {status});
  }

  async onChannelLockedReturn(error, event){

    if(error){
      console.log('onChannelLockedReturn error', error);
      return;
    }
    let { channel_identifier, beneficiary, amount } = event.returnValues.Result;

    let status = Constants.CHANNEL_UNLOCKFINISHED;
    await this.dbHelper.updateChannel(channel_identifier, {status});
  }

  async onCooperativeSettle(error, event){
    if(error){
      console.log('onChannelLockedReturn error', error);
      return;
    }
    let { channel_identifier, participant1_balance, participant2_balance } = event.returnValues.Result;

      let status = Constants.CHANNEL_UNLOCKFINISHED;
      await this.dbHelper.updateChannel(channel_identifier, {status});
  }



  async onGameInitiatorSettled(error, event){
    if (error) {
      console.log("onGameInitiatorSettled error", error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, winner } = event.returnValues.Result;

  }
  async onGameAcceptorSettled(error, event){
    if(error){
      console.log('onGameAcceptorSettled error', error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, lastRevealBlock } = event.returnValues.Result;

  }
  async onGameInitiatorRevealed(error, event){
    if(error){
      console.log('onGameInitiatorRevealed error', error);
      return;
    }
    let { initiator, acceptor, roundIdentifier, winner } = event.returnValues.Result;

  }

}

module.exports = BlockChainEventHandler;
