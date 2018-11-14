const Web3 = require("web3");
const dbfactory = require("./db/dbfactory");
const BlockChainEventHandler = require("./blockchainEventHandler");
const MessageHandler = require("./messageHandler");
const BlockchainProxy = require('./blockchainProxy');
const EventManager = require('./eventManager');
const Ecsign = require('./utils/ecsign');
const MessageGenerator = require('./utils/messageGenerator');
const MessageValidator = require('./utils/messageValidator');
const RandomUtil = require('./utils/random');
const Constants = require('./Constants');
const GameRule = require('./gameRule');

const paymentContractAddress = '0x5167553b547973487Aeaf2413B68f290d5266FE0';
const paymentContractAbi = require('./Payment_ETH.json')
const gameContractAddress = '0xE44C8bA910A179A801267442224F9B7f3065E0ec';
const gameContractAbi = require('./Dice_SC.json')

// console.log(paymentContractAbi);

class SCClient {

  constructor(wsUrl, dbprovider, fromAddress, privateKey) {

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
    this.dbprovider = dbprovider;

    this.eventList = {};

    this.web3 = new Web3(Web3.givenProvider || wsUrl);

    this.autoRespondA = true;
    this.autoRespondB = true;
    

    // 启动blockchainEventHandler 
    this.blockchainProxy = new BlockchainProxy(this.web3, this.contractInfo);
    this.messageGenerator = new MessageGenerator(this.web3, fromAddress, privateKey, gameContractAddress, paymentContractAddress);
    this.messageValidator = new MessageValidator(this.web3, gameContractAddress, paymentContractAddress);

  }

  setAutoRespond(autoRespondA, autoRespondB) {

    this.autoRespondA = autoRespondA;
    this.autoRespondB = autoRespondB;

  }

  initMessageHandler(socket){
    this.socket = socket;
    new MessageHandler(socket, this).start();
  }

  async init() {
    this.dbhelper = await dbfactory.initDBHelper(this.dbprovider);

    this.eventManager = new EventManager(this.eventList);
    new BlockChainEventHandler(this.web3, this.contractInfo, this).start();

    console.log("db init finished");

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
      console.error('channel not exist in db');
      return;
    }
    console.timeEnd('startBet');

    let lastBet = await this.dbhelper.getBetByChannel({channelId: channelIdentifier});
    if(lastBet != null && lastBet.status != Constants.BET_FINISH){
      console.log("There are unfinished bet, can not start new bet");
      return false;
    } 

    let round = await this.dbhelper.getLatestRound(channelIdentifier);

    console.log('new Round is ', round);

    //generate Random from seed
    let ra = RandomUtil.generateRandomFromSeed(randomSeed);
    let hashRa = this.web3.utils.sha3(ra);
    //generate BetRequest Message
    let betRequestMessage = this.messageGenerator.generateBetRequest(channelIdentifier, round, betMask, modulo, this.from, partnerAddress, hashRa);
    betRequestMessage.value = betValue;

    console.log('betRequestMessage', betRequestMessage);


    console.time('addBet');
    let winAmount = GameRule.getPossibleWinAmount(betMask, modulo, betValue);
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

    //fetch channel Hash
    let balanceHash = '';
    let nonce = '';
    let signature = '';

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
      console.error("channel not exist or channel is not open");
      return;
    }

    let localBalance = channel.localBalance;
    let remoteBalance = channel.remoteBalance;
    
    let cooperativeSettleRequestMessage = this.messageGenerator.genreateCooperativeSettleRequest(channelIdentifier, this.from, localBalance, partnerAddress,  remoteBalance);
    this.socket.emit("CooperativeSettleRequest", cooperativeSettleRequestMessage);

    return true;

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

    console.log("onEvent set event now", event, callback);

    this.eventList[event] = callback; 
    return this;

  }

};

module.exports = SCClient;