/**
 * 1. BetRequest
 * 2. LockedTransfer
 * 3. LockedTransferR
 * 4. BetResponse
 * 5. Preimage/DirectTransfer
 * 6. DirectTransfer
 *
 */

const MessageGenerator = require('./utils/messageGenerator');


class MessageHandler {
  constructor(socket, scclient) {
    this.socket = socket;
    this.eventManager = scclient.eventManager;
  }

  /**
   * 开始处理通道另一方发来的消息
   */
  start() {
    this.socket
      .on("betRequest", this.onBetRequest)
      .on("lockedTransfer", this.onLockedTransfer)
      .on("lockedTransferR", this.onLockedTransferR)
      .on("betResponse", this.onBetResponse)
      .on("preimage", this.onPreimage)
      .on("DirectTransfer", this.onDirectTransfer);
  }

  onBetRequest(message) {
    // 检测本地数据 和 BetRequest进行比对
    // 如果符合条件，给对方发送LockedTransfer
    console.log('BetRequest Received: ', message);

    //check BetRequest


    //save bet to database
    //send LockedTransfer to opposite

    const lockedTransfer = MessageGenerator.generateLockedTransfer();
    this.socket.emit('lockedTransfer', lockedTransfer);



  }

  onLockedTransfer(message) {
    // 检测是否符合条件, 如果符合条件 给对方发送LockedTransferR
    console.log('LockedTransfer Received: ', message);

    //check LockedTransfer

    //update Bet in database


    //send LockedR to opposite
    const lockedR= MessageGenerator.generateLockedTransferR();
    this.socket.emit('lockedTransfer', lockedR);


  }

  onLockedTransferR(message) {
    // 检测是否符合条件
    // 发送BetResponse
    console.log('LockedTransferR Received: ', message);

    //check LockedTransferR

    //update Bet in database



    //send BetResponse to opposite
    const betResponse = MessageGenerator.generateBetResponse();
    this.socket.emit('betResponse', betResponse);



  }

  onBetResponse(message) {
    // 检测是否符合条件
    // 判断输赢 赢：发送Preimage， 输：发送Preimage+DirectTransfer
    console.log('BetResponse Received: ', message);

    // check BetResponse


    // update Bet in database


    // check Win or Lose

    // send Preimage to opposite
    const preimageMessage = MessageGenerator.generatePreimage();
    this.socket.emit('preimage', preimageMessage);

    // If lose send DirectTransfer to opposite
    const directTransfer = MessageGenerator.generateDirectTransfer();
    this.socket.emit('directTransfer', directTransfer);


  }

  onPreimage(message) {
    // 检测是否符合条件
    // 判断输赢 赢：doNothing 设置timeout(如果一直未改变，关闭通道) 输：DirectTransfer
    console.log('Preimage Received: ', message);

    // check Preimage

    // update Bet in database

    // check Win or Lose

    // If lose send DirectTransfer to opposite

    const directTransfer = MessageGenerator.generateDirectTransfer();
    this.socket.emit('directTransfer', directTransfer);



  }

  onDirectTransfer(message) {
    // 检测是否符合条件
    // 更新数据库
    console.log('DirectTransfer Received: ', message);
    // do nothing
    //check DirectTransfer

    // update Bet in database, do nothing.


  }
}

module.exports = MessageHandler;
