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


class MessageHandler {
  constructor(socket, scclient) {
    this.socket = socket;
    this.eventManager = scclient.eventManager;
    this.scclient = scclient;
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


    //save bet to database
    //send LockedTransfer to opposite

    const lockedTransfer = MessageGenerator.generateLockedTransfer();
    this.socket.emit('LockedTransfer', lockedTransfer);



  }

  async onLockedTransfer(message) {
    // 检测是否符合条件, 如果符合条件 给对方发送LockedTransferR
    console.log('LockedTransfer Received: ', message);

    //check LockedTransfer

    //update Bet in database


    //send LockedR to opposite
    const lockedR= MessageGenerator.generateLockedTransferR();
    this.socket.emit('LockedTransfer', lockedR);


  }

  async onLockedTransferR(message) {
    // 检测是否符合条件
    // 发送BetResponse
    console.log('LockedTransferR Received: ', message);

    //check LockedTransferR

    //update Bet in database



    //send BetResponse to opposite
    const betResponse = MessageGenerator.generateBetResponse();
    this.socket.emit('BetResponse', betResponse);



  }

  async onBetResponse(message) {
    // 检测是否符合条件
    // 判断输赢 赢：发送Preimage， 输：发送Preimage+DirectTransfer
    console.log('BetResponse Received: ', message);

    // check BetResponse


    // update Bet in database


    // check Win or Lose

    // send Preimage to opposite
    const preimageMessage = MessageGenerator.generatePreimage();
    this.socket.emit('Preimage', preimageMessage);

    // If lose send DirectTransfer to opposite
    const directTransfer = MessageGenerator.generateDirectTransfer();
    this.socket.emit('DirectTransfer', directTransfer);

  }

  async onPreimage(message) {
    // 检测是否符合条件
    // 判断输赢 赢：doNothing 设置timeout(如果一直未改变，关闭通道) 输：DirectTransfer
    console.log('Preimage Received: ', message);

    // check Preimage

    // update Bet in database

    // check Win or Lose

    // If lose send DirectTransfer to opposite

    const directTransfer = MessageGenerator.generateDirectTransfer();
    this.socket.emit('DirectTransfer', directTransfer);

  }

  async onDirectTransfer(message) {
    // 检测是否符合条件
    // 更新数据库
    console.log('DirectTransfer Received: ', message);
    // do nothing
    //check DirectTransfer

    // update Bet in database, do nothing.



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
