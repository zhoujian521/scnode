const Web3 = require("web3");
const dbfactory = require("./db/dbfactory");
const BlockChainEventHandler = require("./blockchainEventHandler");
const MessageHandler = require("./messageHandler");
const BlockchainProxy = require('./blockchainProxy');
const EventManager = require('./eventManager');
const Ecsign = require('./utils/ecsign');

const paymentContractAddress = '0x5167553b547973487Aeaf2413B68f290d5266FE0';
const paymentContractAbi = require('./Payment_ETH.json')
const gameContractAddress = '0xE44C8bA910A179A801267442224F9B7f3065E0ec';
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

    this.from = fromAddress;
    this.privateKey = privateKey;

    this.eventList = {};
    this.eventManager = new EventManager(this.eventList);

    this.web3 = new Web3(Web3.givenProvider || wsUrl);
    this.dbhelper = dbfactory.initDBHelper(dbprovider);
    this.blockchainProxy = new BlockchainProxy(this.web3, contractInfo);
    

    // 启动blockchainEventHandler 
    new BlockChainEventHandler(this.web3, contractInfo, this).start();

  }

  initMessageHandler(socket){
    this.socket = socket;
    new MessageHandler(socket, this).start();
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
  async startBet(partnerAddress, betMask, modulo, betValue, randomSeed = "") {

    //generate BetRequest Message

    // find socket by partnerAddress

    // then send BetRequest to partner
    
    return new Promise((resolve, reject) => {});
  }

  /**
   * 关闭通道
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

  async closeChannelCooperative(partnerAddress){


    let channelIdentifier = await this.blockchainProxy.getChannelIdentifier(partnerAddress);
    let channel = await this.dbhelper.getChannel(channelIdentifier);

    let localBalance = channel.localBalance;
    let remoteBalance = channel.remoteBalance;
    
    let shaMessage = Ecsign.mySha3(this.web3, paymentContractAddress, channelIdentifier, this.from, localBalance, partnerAddress, remoteBalance);
    let signature = Ecsign.myEcsign(this.web3, shaMessage, this.privateKey);
    
    this.socket.emit('CooperativeSettleRequest', {
      paymentContract: paymentContractAddress,
      channelIdentifier,
      p1: this.from,
      p1Balance: localBalance,
      p2: partnerAddress,
      p2Balance: remoteBalance,
      p1Signature: signature
    });

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
    this.eventList[event] = callback; 
    return this;

  }

};

module.exports = SCClient;