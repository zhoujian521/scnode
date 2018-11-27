/**
 * 状态通道类
 * 1. 提供了相关接口供外部调用
 * 2. eventList来存储所有的事件监听器
 */
const BlockChainEventHandler = require("./blockchainEventHandler");
const MessageHandler = require("./messageHandler");
const BlockchainProxy = require('./blockchainProxy');
const BlockchainQuery = require('./blockchainQuery');
const EventManager = require('./eventManager');
const Ecsign = require('./utils/ecsign');
const MessageGenerator = require('./utils/messageGenerator');
const MessageValidator = require('./utils/messageValidator');
const ProofGenerator = require('./utils/proofGenerator');
const Constants = require('./Constants');
const GameRule = require('./gameRule');
const SyncBlockchain = require("./syncBlockchain");

//基础配置信息，通道合约和游戏合约地址 以及相应的ABI文件
const paymentContractAddress = '0x4B70A4d4d885cb397E2bD5b0A77DA9bD3EEb033e';
const paymentContractAbi = require('./Payment_ETH.json')
const gameContractAddress = '0x2ec9B713cCa3f42fd7E263D91B46e86E6fe7ea4B';
const gameContractAbi = require('./Dice_SC.json')

/**
 * 基础信息日志
 * @param  {...any} params 
 */
function logInfo(params){
  console.log(params);
}

/**
 * 基础错误日志
 * @param  {...any} params 
 */
function logError(params){
  console.log('---------------------------', params);
}
//设置日志函数为全局函数
global.logInfo = logInfo;
global.logError = logError;


class SCClient {

  constructor(wsweb3, dbhelper, cryptohelper, fromAddress) {

    //合约相关信息
    this.contractInfo = {
      fromAddress,
      paymentContractAddress,
      paymentContractAbi: paymentContractAbi.abi,
      gameContractAddress,
      gameContractAbi: gameContractAbi.abi
    }

    this.from = fromAddress;         //本地钱包地址
    this.dbhelper = dbhelper ;       //数据库操作类
    this.cryptohelper = cryptohelper;  //加密数据操作类

    this.eventList = {};             //外部监听事件处理列表

    this.web3 = wsweb3;              //全局web3

    //钱包未解锁时，不自动回复消息
    this.autoRespondBetRequest = false;         //自动回复BetRequest消息
    this.autoRespondLockedTransfer = false;     //自动回复LockedTransfer消息
    this.autoRespondLockedTransferR = false;    //自动回复LockedTransferR消息
    this.autoRespondBetResponse = false;        //自动回复BetResponse消息
    this.autoRespondPreimage = false;           //自动回复Preimage消息
    this.autoRespondDirectTransfer = false;     //自动回复DirectTransfer消息
    this.autoRespondDirectTransferR = false;    //自动回复DirectTransferR消息

    this.walletUnlocked = false;

    //P2P消息验证类
    this.messageValidator = new MessageValidator(this.web3, gameContractAddress, paymentContractAddress);
    //强关proof生成器
    this.proofGenerator= new ProofGenerator(this);

    //外部事件发送器
    this.eventManager = new EventManager(this.eventList);

    //区块链查询类
    this.blockchainQuery = new BlockchainQuery(this.web3, this.contractInfo);

    this.syncBlockchain = new SyncBlockchain(this);

  }

  /**
   * 初始化P2P消息处理期
   * @param socket socket.io实例
   */
  initMessageHandler(socket){
    this.socket = socket;
    new MessageHandler(socket, this).start();
  }

  initWeb3(web3){
    this.web3 = web3;

    this.blockchainQuery = new BlockchainQuery(this.web3, this.contractInfo);
    if(this.walletUnlocked){

      this.blockchainProxy = new BlockchainProxy(this.web3, this.contractInfo);
       // 启动blockchainEventHandler 
      new BlockChainEventHandler(this.web3, this.contractInfo, this).start();
    }
  }


  initRedis(redis) {
    // this.redis = redis;
    this.blockchainProxy.setRedis(redis); 
  }

  unlockWallet(privateKey){

    this.privateKey = privateKey;    //本地钱包私钥
    this.contractInfo.privateKey = privateKey;
    this.walletUnlocked = true;

    this.autoRespondBetRequest = true;         //自动回复BetRequest消息
    this.autoRespondLockedTransfer = true;     //自动回复LockedTransfer消息
    this.autoRespondLockedTransferR = true;    //自动回复LockedTransferR消息
    this.autoRespondBetResponse = true;        //自动回复BetResponse消息
    this.autoRespondPreimage = true;           //自动回复Preimage消息
    this.autoRespondDirectTransfer = true;     //自动回复DirectTransfer消息
    this.autoRespondDirectTransferR = true;    //自动回复DirectTransferR消息

    //区块链操作类
    this.blockchainProxy = new BlockchainProxy(this.web3, this.contractInfo);
    //P2P消息生成类
    this.messageGenerator = new MessageGenerator(this.web3, this.from, privateKey, this.contractInfo.gameContractAddress, this.contractInfo.paymentContractAddress);
    // 启动blockchainEventHandler 
    new BlockChainEventHandler(this.web3, this.contractInfo, this).start();

  }

  async sync(partnerAddress){
    
    return await this.syncBlockchain.doSync(partnerAddress);

  }




  /**
   * 开通道操作，只能由用户端调用，用户主动与服务器开通道
   * @param  partnerAddress 对方地址
   * @param  depositAmount  预存到通道的金额
   * @returns {String} 开通通道交易hash
   */
  async openChannel(partnerAddress, depositAmount) {
    if (!this.walletUnlocked) return false;
    //send openchannel request to blockchain
    let settle_window = 6;
    return await this.blockchainProxy.openChannel(this.from, partnerAddress, settle_window, depositAmount);

  }

  /**
   * 往通道中增加存款
   * @param  partnerAddress 对方地址
   * @param  depositAmount  存款金额
   * @returns {String} 交易hash
   */
  async deposit(partnerAddress, depositAmount) {
    if (!this.walletUnlocked) return false;
    return await this.blockchainProxy.deposit(this.from, partnerAddress, depositAmount);
  }

  /**
   * 开始赌局 由客户端发起
   * @param  partnerAddress 对方地址
   * @param  betMask        下注内容
   * @param  modulo         游戏总类
   * @param  betValue       下注金额
   * @param  randomSeed     选择随机数
   * @returns {Boolean}     发起下注成功Or失败
   */
  async startBet(channelIdentifier, partnerAddress, betMask, modulo, betValue, randomSeed = "") {

    if (!this.walletUnlocked) return false;
    //检测通道状态
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    if (!channel || channel.status != Constants.CHANNEL_OPENED) {
      logError('channel not exist in db');
      return;
    }

    //检测当前是否有未完成的赌局
    let lastBet = await this.dbhelper.getBetByChannel({channelId: channelIdentifier, round: channel.currentRound});
    if(lastBet != null && lastBet.status != Constants.BET_FINISH){
      logInfo("There are unfinished bet, can not start new bet");
      return false;
    } 
    let round = channel.currentRound == null ? 1 : channel.currentRound + 1;

    logInfo('new Round is ', round);

    //generate Random from seed
    let ra = await this.cryptohelper.generateRandomHex(randomSeed);
    let hashRa = this.web3.utils.soliditySha3(ra);
    //generate BetRequest Message
    let betRequestMessage = this.messageGenerator.generateBetRequest(channelIdentifier, round, betMask, modulo, this.from, partnerAddress, hashRa);
    betRequestMessage.value = betValue;

    logInfo('betRequestMessage', betRequestMessage);


    let winAmount = GameRule.getPossibleWinAmount(betMask, modulo, betValue);

    //检测通道两端的余额是否够完成赌局
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
    return true;
  }

  /**
   * 强制关闭通道
   * @param partnerAddress 对方地址
   * @returns {String} 交易hash
   */
  async closeChannel(partnerAddress) {

    if (!this.walletUnlocked) return false;
    let channelIdentifier = await this.blockchainQuery.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    //检测通道状态
    if (channel.status != Constants.CHANNEL_OPENED) {
      logError("Channel is not open now");
      return false;
    }

    let closeData = await this.proofGenerator.getCloseData(channel);
    let { balanceHash, nonce, signature } = closeData;

    //强制关
    return await this.blockchainProxy.closeChannel(partnerAddress, balanceHash, nonce, signature);

  }

  /**
   * 协商关闭通道
   * @param partnerAddress 
   * @returns {Boolean} 协商关闭请求是否发送成功
   */
  async closeChannelCooperative(partnerAddress){

    if (!this.walletUnlocked) return false;
    let channelIdentifier = await this.blockchainQuery.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    if(!channel || channel.status != Constants.CHANNEL_OPENED){
      logError("channel not exist or channel is not open");
      return false;
    }

    let localBalance = this.web3.utils.toBN(channel.localBalance).add(this.web3.utils.toBN(channel.localLockedAmount)).toString(10);
    let remoteBalance = this.web3.utils.toBN(channel.remoteBalance).add(this.web3.utils.toBN(channel.remoteLockedAmount)).toString(10);
    
    let cooperativeSettleRequestMessage = this.messageGenerator.genreateCooperativeSettleRequest(channelIdentifier, this.from, localBalance, partnerAddress, remoteBalance);
    cooperativeSettleRequestMessage.p1Signature = cooperativeSettleRequestMessage.signature;

    this.socket.emit("CooperativeSettleRequest", cooperativeSettleRequestMessage);

    return true;

  }

  /**
   * 通道清算
   * @param partnerAddress 
   * @returns 交易hash
   */
  async settleChannel(partnerAddress){
    //refresh channel status
    if (!this.walletUnlocked) return false;
    let channelIdentifier = await this.blockchainQuery.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    if (!channel || (channel.status != Constants.CHANNEL_CLOSED && channel.status != Constants.CHANNEL_UPDATEBALANCEPROOF)) {
      logError("channel not exist or channel status is not in (Closed, UpdateBalanceProof)");
      return false;
    }
    
    let settleData = await this.proofGenerator.getSettleData(channel, channel.localCloseBalanceHash, channel.remoteCloseBalanceHash);
    let { participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id } = settleData;
    return await this.blockchainProxy.settle(participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id);
  }


  /**
   * 解锁通道锁定部分资金
   * @param channelId 通道ID
   * @param lockIdentifier 锁定ID
   * @returns 交易hash 
   */
  async unlockChannel(partnerAddress, lockIdentifier){
    if (!this.walletUnlocked) return false;
    await this.blockchainProxy.unlock(this.from, partnerAddress, lockIdentifier);
  }

  /**
   * 玩家提交游戏仲裁证据
   * @param channelIdentifier 通道ID
   * @param betId 游戏轮数ID
   * @returns 交易hash
   */
  async initiatorSettle(channelIdentifier, betId){
    if (!this.walletUnlocked) return false;
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    let bet = await this.dbhelper.getBet(betId);

    if (!channel || (channel.status != Constants.CHANNEL_CLOSED && channel.status != Constants.CHANNEL_UPDATEBALANCEPROOF)) {
      logError("channel not exist or channel status is not in (Closed, UpdateBalanceProof)");
      return false;
    }

    if(!bet || bet.status < Constants.BET_START || bet.status == Constants.BET_FINISH){
      logError("bet not exist or bet status is not correct"); 
      return false;
    }

    let initiatorSettleData = await this.proofGenerator.getInitiatorSettleData(channel, bet);
    return await this.blockchainProxy.initiatorSettle(initiatorSettleData.channelIdentifier, initiatorSettleData.round, parseInt(initiatorSettleData.betMask), initiatorSettleData.modulo, initiatorSettleData.positive, initiatorSettleData.negative, initiatorSettleData.initiatorHashR, initiatorSettleData.initiatorSignature, initiatorSettleData.acceptorR, initiatorSettleData.acceptorSignature, initiatorSettleData.initiatorR);
  }

  
  /**
   * 返回所有通道信息
   * @returns {List} 通道列表
   */
  async getAllChannels(condition, offset, limit) {
    return await this.dbhelper.getChannels(condition, offset, limit);
  }

  /**
   * 返回单个通道信息
   * @param partnerAddress 对方地址
   * @returns {Object} 单个通道信息
   */
  async getChannel(partnerAddress) {
    let channelIdentifier = await this.blockchainQuery.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);
    return channel;
  }

  /**
   * 获取赌局信息
   * @param condition 条件
   * @param offset 起始位置
   * @param limit 数据条数
   * @returns {List} 赌局列表信息
   */
  async getAllBets(condition, offset, limit) {
    return await this.dbhelper.getBets(condition, offset, limit);
  }

  /**
   * 获取单个赌局信息
   * @param betId 赌局ID
   * @returns {Object} bet
   */
  async getBetById(betId) {
    return await this.dbhelper.getBet(betId)
  }

  async getPayments(condition, offset, limit){
    return await this.dbhelper.getPayments(condition, offset, limit);
  }







  /**
   * 设置事件监听callback
   * @param event 事件名称
   * @param callback 回调函数
   * @returns {Object} this
   */
  on(event, callback){

    logInfo("onEvent set event now", event, callback);

    this.eventList[event] = callback; 
    return this;

  }

};

module.exports = SCClient;