const Web3 = require("web3");
const dbfactory = require("./db/dbfactory");
const BlockChainEventHandler = require("./blockchainEventHandler");
const MessageHandler = require("./messageHandler");
const BlockchainProxy = require('./blockchainProxy');
const EventManager = require('./eventManager');

const paymentContractAddress = '0x0754E5a91e892a8331C402937372B6659148a3b3';
const paymentContractAbi = require('./Payment_ETH.json')
const gameContractAddress = '0xe5885F56b47137cB245168Ca3077270Bb55E127d';
const gameContractAbi = require('./Dice_SC.json')

// console.log(paymentContractAbi);

class SCClient {

  constructor(wsUrl, dbprovider, fromAddress, privateKey) {

    const contractInfo = {
      fromAddress,
      privateKey,
      paymentContractAddress,
      paymentContractAbi: paymentContractAbi.abi,
      gameContractAddress,
      gameContractAbi: gameContractAbi.abi
    }

    this.eventList = {};
    this.eventManager = new EventManager(this.eventList);

    this.web3 = new Web3(Web3.givenProvider || wsUrl);
    this.dbhelper = dbfactory.initDBHelper(dbprovider);
    this.blockchainProxy = new BlockchainProxy(this.web3, contractInfo);
    

    // 启动blockchainEventHandler 
    new BlockChainEventHandler(this.web3, contractInfo, this).start();

  }

  initMessageHandler(socket){
    new MessageHandler(socket, this).start();
  }


  findPartnerSocket(partnerAddress) {
    return "http://localhost";
  }

  /**
   * 开通道操作，只能由用户端调用，用户主动与服务器开通道
   * @param  partnerAddress 对方地址
   * @param  depositAmount  预存到通道的金额
   */
  openChannel(partnerAddress, depositAmount) {
    //send openchannel request to blockchain

    //Connect socket to the server.

    return new Promise((resolve, reject) => {});
  }

  /**
   * 往通道中增加存款
   * @param  partnerAddress 对方地址
   * @param  depositAmount  存款金额
   */
  deposit(partnerAddress, depositAmount) {
    return new Promise((resolve, reject) => {});
  }

  /**
   * 开始赌局 由客户端发起
   * @param  partnerAddress 对方地址
   * @param  betMask        下注内容
   * @param  modulo         游戏总类
   * @param  betValue       下注金额
   * @param  randomSeed     选择随机数
   */
  startBet(partnerAddress, betMask, modulo, betValue, randomSeed = "") {
    return new Promise((resolve, reject) => {});
  }

  /**
   * 关闭通道
   * @param partnerAddress 对方地址
   */
  closeChannel(partnerAddress) {
    return new Promise((resolve, reject) => {});
  }

  
  async getAllChannels() {
    return await this.dbhelper.getChannels();
  }

  getChannel(partnerAddress) {
    return {};
  }

  getAllBets(condition, offset, limit) {
    return [];
  }

  getBetById(betId) {
    return {};
  }

  on(event, callback){
    this.eventList[event] = callback; 

    return this;

  }

};

module.exports = SCClient;