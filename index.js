const Web3 = require("web3");
const BlockChainEventHandler = require("./blockchainEventHandler");
const MessageHandler = require("./messageHandler");
const BlockchainProxy = require('./blockchainProxy');
const EventManager = require('./eventManager');
const Ecsign = require('./utils/ecsign');
const MessageGenerator = require('./utils/messageGenerator');
const MessageValidator = require('./utils/messageValidator');
const ProofGenerator = require('./utils/proofGenerator');
const RandomUtil = require('./utils/random');
const Constants = require('./Constants');
const GameRule = require('./gameRule');

const paymentContractAddress = '0x86364E2a57C4040d94Ab1440E48693c6e7483c30';
const paymentContractAbi = require('./Payment_ETH.json')
const gameContractAddress = '0x406a9aCC62d488f7396e24750767aa8E665252C2';
const gameContractAbi = require('./Dice_SC.json')

// logInfo(paymentContractAbi);
function logInfo(...params){
  console.log(params);
}
function logError(...params){
  console.log('---------------------------', params);
}

global.logInfo = logInfo;
global.logError = logError;


class SCClient {

  constructor(wsweb3, dbhelper, fromAddress, privateKey) {

    this.contractInfo = {
      fromAddress,
      privateKey,
      paymentContractAddress,
      paymentContractAbi: paymentContractAbi.abi,
      gameContractAddress,
      gameContractAbi: gameContractAbi.abi
    }

    this.from = fromAddress;
    this.privateKey = privateKey;
    this.dbhelper = dbhelper ;

    this.eventList = {};

    this.web3 = wsweb3;

    this.autoRespondBetRequest = true;
    this.autoRespondLockedTransfer = true;
    this.autoRespondLockedTransferR = true;
    this.autoRespondBetResponse = true;
    this.autoRespondPreimage = true;
    this.autoRespondDirectTransfer = true;
    this.autoRespondDirectTransferR = true;

    // 启动blockchainEventHandler 
    this.blockchainProxy = new BlockchainProxy(this.web3, this.contractInfo);
    this.messageGenerator = new MessageGenerator(this.web3, fromAddress, privateKey, gameContractAddress, paymentContractAddress);
    this.messageValidator = new MessageValidator(this.web3, gameContractAddress, paymentContractAddress);
    this.proofGenerator= new ProofGenerator(this);

    this.eventManager = new EventManager(this.eventList);
    new BlockChainEventHandler(this.web3, this.contractInfo, this).start();




  }

  // setAutoRespond(autoRespondA, autoRespondB) {

  //   this.autoRespondA = autoRespondA;
  //   this.autoRespondB = autoRespondB;

  // }

  initMessageHandler(socket){
    this.socket = socket;
    new MessageHandler(socket, this).start();
  }

  async init() {


  }


  /**
   * 开通道操作，只能由用户端调用，用户主动与服务器开通道
   * @param  partnerAddress 对方地址
   * @param  depositAmount  预存到通道的金额
   */
  async openChannel(partnerAddress, depositAmount) {
    //send openchannel request to blockchain
    let settle_window = 6;
    return await this.blockchainProxy.openChannel(this.from, partnerAddress, settle_window, depositAmount);

  }

  /**
   * 往通道中增加存款
   * @param  partnerAddress 对方地址
   * @param  depositAmount  存款金额
   */
  async deposit(partnerAddress, depositAmount) {
    return await this.blockchainProxy.deposit(this.from, partnerAddress, depositAmount);
  }

  /**
   * 开始赌局 由客户端发起
   * @param  partnerAddress 对方地址
   * @param  betMask        下注内容
   * @param  modulo         游戏总类
   * @param  betValue       下注金额
   * @param  randomSeed     选择随机数
   */
  async startBet(channelIdentifier, partnerAddress, betMask, modulo, betValue, randomSeed = "") {

    // let channelIdentifier = await this.blockchainProxy.getChannelIdentifier(partnerAddress);
    // let channelIdentifier = '0xdd825b249141facccd6f96c23cc033abc045dbd44046f386b585e9c7900e82cd';

    console.time('startBet');
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) {
      logError('channel not exist in db');
      return;
    }
    console.timeEnd('startBet');

    let lastBet = await this.dbhelper.getBetByChannel({channelId: channelIdentifier, round: channel.currentRound});
    if(lastBet != null && lastBet.status != Constants.BET_FINISH){
      logInfo("There are unfinished bet, can not start new bet");
      return false;
    } 
    let round = channel.currentRound == null ? 1 : channel.currentRound + 1;

    logInfo('new Round is ', round);

    //generate Random from seed
    let ra = RandomUtil.generateRandomFromSeed2(this.web3, randomSeed);
    let hashRa = this.web3.utils.soliditySha3(ra);
    //generate BetRequest Message
    let betRequestMessage = this.messageGenerator.generateBetRequest(channelIdentifier, round, betMask, modulo, this.from, partnerAddress, hashRa);
    betRequestMessage.value = betValue;

    logInfo('betRequestMessage', betRequestMessage);


    console.time('addBet');
    let winAmount = GameRule.getPossibleWinAmount(betMask, modulo, betValue);

    if (parseInt(channel.remoteBalance) - parseInt(winAmount) < 0 || parseInt(channel.localBalance) - parseInt(betValue) < 0) {
      logError("insufficient balance to bet localBalance", channel.localBalance, "betValue", betValue, "remoteBalance", channel.remoteBalance, "winAmount", winAmount);
      return false;
    }


    //save Bet to Database
    await this.dbhelper.addBet({
      gameContractAddress: betRequestMessage.gameContractAddress,
      channelId: channelIdentifier,
      round: round,
      betMask,
      modulo,
      value: betValue,
      winAmount,
      positiveA: this.from,
      hashRa,
      ra,
      signatureA: betRequestMessage.signatureA,
      negativeB: betRequestMessage.negativeB,
      status: Constants.BET_INIT
    });
    await this.dbhelper.updateChannel(channelIdentifier, { currentRound: round });

    // then send BetRequest to partner
    await this.socket.emit('BetRequest', betRequestMessage);
    console.timeEnd('addBet');
    return true;
  }

  /**
   * 强制关闭通道
   * @param partnerAddress 对方地址
   */
  async closeChannel(partnerAddress) {

    let channelIdentifier = await this.blockchainProxy.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    if (channel.status != Constants.CHANNEL_OPENED) {
      logError("Channel is not open now");
      return;
    }

    let closeData = await this.proofGenerator.getCloseData(channel);
    let { balanceHash, nonce, signature } = closeData;

    //强制关
    return await this.blockchainProxy.closeChannel(partnerAddress, balanceHash, nonce, signature);

  }

  /**
   * 协商关闭通道
   * @param partnerAddress 
   */
  async closeChannelCooperative(partnerAddress){

    let channelIdentifier = await this.blockchainProxy.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    if(!channel || channel.status != Constants.CHANNEL_OPENED){
      logError("channel not exist or channel is not open");
      return;
    }

    let localBalance = channel.localBalance;
    let remoteBalance = channel.remoteBalance;
    
    let cooperativeSettleRequestMessage = this.messageGenerator.genreateCooperativeSettleRequest(channelIdentifier, this.from, localBalance, partnerAddress,  remoteBalance);
    this.socket.emit("CooperativeSettleRequest", cooperativeSettleRequestMessage);

    return true;

  }

  /**
   * 通道清算
   * @param partnerAddress 
   */
  async settleChannel(partnerAddress){
    //refresh channel status
    let channelIdentifier = await this.blockchainProxy.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    let settleData = await this.proofGenerator.getSettleData(channel, channel.localCloseBalanceHash, channel.remoteCloseBalanceHash);
    let { participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id } = settleData;
    return await this.blockchainProxy.settle(participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id);
  }


  /**
   * 解锁通道锁定部分资金
   * @param channelId 
   * @param lockIdentifier 
   */
  async unlockChannel(partnerAddress, lockIdentifier){
    await this.blockchainProxy.unlock(this.from, partnerAddress, lockIdentifier);
  }

  async initiatorSettle(channelIdentifier, betId){
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    let bet = await this.dbhelper.getBet(betId);

    let initiatorSettleData = await this.proofGenerator.getInitiatorSettleData(channel, bet);

    await this.blockchainProxy.initiatorSettle(initiatorSettleData.channelIdentifier, initiatorSettleData.round, parseInt(initiatorSettleData.betMask), initiatorSettleData.modulo, initiatorSettleData.positive, initiatorSettleData.negative, initiatorSettleData.initiatorHashR, initiatorSettleData.initiatorSignature, initiatorSettleData.acceptorR, initiatorSettleData.acceptorSignature, initiatorSettleData.initiatorR);

  }

  
  async getAllChannels() {
    return await this.dbhelper.getChannels();
  }

  async getChannel(partnerAddress) {
    return {};
  }

  async getAllBets(condition, offset, limit) {
    return await this.dbhelper.getBets();
  }

  async getBetById(betId) {
    return await this.dbhelper.getBet(betId)
  }

  on(event, callback){

    logInfo("onEvent set event now", event, callback);

    this.eventList[event] = callback; 
    return this;

  }

};

module.exports = SCClient;