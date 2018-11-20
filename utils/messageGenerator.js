/**
 * P2P消息生成类
 * 主要负责以下7类消息的生成
 * 1. BetRequest
 * 2. LockedTransfer
 * 3. LockedTransferR
 * 4. BetResponse
 * 5. Preimage
 * 6. DirectTransfer
 * 7. DirectTransferR
 * 
 */
const Ecsign = require("./ecsign");

class messageGenerator {
  constructor(
    web3,
    address,
    privateKey,
    gameContractAddress,
    paymentContractAddress
  ) {
    this.web3 = web3;
    this.from = address;
    this.privateKeyBuffer = new Buffer(privateKey, "hex");
    this.gameContractAddress = gameContractAddress;
    this.paymentContractAddress = paymentContractAddress;
  }

  /**
   * 
   * @param channelIdentifier 通道ID
   * @param round 当前轮数
   * @param betMask 下注内容
   * @param modulo 游戏种类 2硬币 6骰子 36两个骰子 100Etheroll
   * @param positiveA 玩家地址
   * @param negativeB 庄家地址
   * @param hashRa 玩家随机数Hash
   * @returns {Object} BetRequest消息体
   */
  generateBetRequest(
    channelIdentifier,
    round,
    betMask,
    modulo,
    positiveA,
    negativeB,
    hashRa
  ) {
    let messagehash = this.web3.utils.soliditySha3(
      this.gameContractAddress,
      channelIdentifier,
      round,
      betMask,
      modulo,
      positiveA,
      negativeB,
      hashRa
    );
    messagehash = new Buffer(messagehash.substr(2), "hex");
    let signatureA = Ecsign.myEcsignToHex(
      this.web3,
      messagehash,
      this.privateKeyBuffer
    );
    return {
      gameContractAddress: this.gameContractAddress,
      channelIdentifier,
      round,
      betMask,
      modulo,
      positiveA,
      negativeB,
      hashRa,
      signatureA
    };
  }

  /**
   * 生成LockedTransfer消息体
   * 备注：LockedTransfer和LockedTransferR消息体格式一下，socket发送时发送的事件类型不一样，分别为LockedTransfer和LockedTransferR 
   * @param channelIdentifier 通道ID 
   * @param balanceHash 余额状态Hash
   * @param nonce Tranfer序号 
   * @returns {Object} LockedTransfer消息体
   */
  generateLockedTransfer(channelIdentifier, balanceHash, nonce) {
    let messagehash = this.web3.utils.soliditySha3(
      this.paymentContractAddress,
      channelIdentifier,
      balanceHash,
      nonce
    );
    messagehash = new Buffer(messagehash.substr(2), "hex");
    let signature = Ecsign.myEcsignToHex(
      this.web3,
      messagehash,
      this.privateKeyBuffer
    );
    return {
      paymentContractAddress: this.paymentContractAddress,
      channelIdentifier: channelIdentifier,
      balanceHash: balanceHash,
      nonce: nonce,
      signature
    };
  }

  /**
   * 生成BetResponse消息 
   * @param channelIdentifier 通道ID
   * @param round 赌局轮数
   * @param betMask 下注内容
   * @param modulo 游戏种类 2硬币 6骰子 36两个骰子 100Etheroll 
   * @param positiveA 玩家地址
   * @param negativeB 庄家地址
   * @param hashRa 玩家Hash
   * @param signatureA 玩家签名
   * @param Rb 庄家随机数
   * @readonly {Object} BetResponse消息体
   */
  generateBetResponse(
    channelIdentifier,
    round,
    betMask,
    modulo,
    positiveA,
    negativeB,
    hashRa,
    signatureA,
    Rb
  ) {
    let messagehash = this.web3.utils.soliditySha3(
      this.gameContractAddress,
      channelIdentifier,
      round,
      betMask,
      modulo,
      positiveA,
      negativeB,
      hashRa,
      {t:'bytes', v:signatureA},
      Rb
    );

    messagehash = new Buffer(messagehash.substr(2), "hex");
    let signatureB = Ecsign.myEcsignToHex(
      this.web3,
      messagehash,
      this.privateKeyBuffer
    );

    return {
      gameContractAddress: this.gameContractAddress,
      channelIdentifier,
      round,
      betMask,
      modulo,
      positiveA,
      negativeB,
      hashRa,
      signatureA,
      Rb,
      signatureB
    };
  }

  /**
   * 生成Preimage消息体 
   * @param channelIdentifier 通道ID
   * @param round 游戏轮数
   * @param ra 玩家随机数
   * @returns {Object} Preimage消息体
   */
  generatePreimage(channelIdentifier, round, ra) {
    return {
      channelIdentifier,
      round,
      ra
    };
  }

  /**
   * 生成CooperativeSettleRequest消息体 
   * @param channelIdentifier 通道ID
   * @param positiveA 玩家地址
   * @param balanceA 玩家余额
   * @param negativeB 庄家地址
   * @param balanceB 庄家余额
   * @returns {Object} CooperativeSettleRequest消息体
   */
  genreateCooperativeSettleRequest(channelIdentifier, positiveA, balanceA, negativeB, balanceB){
    let messagehash = this.web3.utils.soliditySha3(
      this.paymentContractAddress,
      channelIdentifier,
      positiveA,
      balanceA,
      negativeB,
      balanceB
    );

    logInfo("genreateCooperativeSettleRequest messagehash is ", messagehash);

    messagehash = new Buffer(messagehash.substr(2), "hex");
    let signature = Ecsign.myEcsignToHex(
      this.web3,
      messagehash,
      this.privateKeyBuffer
    ); 

    return {
      paymentContractAddress: this.paymentContractAddress,
      channelIdentifier,
      p1: positiveA,
      p1Balance: balanceA,
      p2: negativeB,
      p2Balance: balanceB,
      signature: signature
    };
  }
}

module.exports = messageGenerator;