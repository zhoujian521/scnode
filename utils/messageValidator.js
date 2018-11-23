/**
 * MessageValidator类
 * 验证P2P消息的签名是否正确
 * 主要包括以下几类消息：
 * 1. BetRequest
 * 2. LockedTransfer
 * 3. BetResponse
 * 4. CooperativeSettleRequest
 */
const Ecsign = require("./ecsign");

class MessageValidator {
  constructor(web3, gameContractAddress, paymentContractAddress) {
    this.web3 = web3;
    this.gameContractAddress = gameContractAddress;
    this.paymentContractAddress = paymentContractAddress;
  }

  /**
   * 检测BetRequest签名 
   * @param message BetRequest消息体
   * @param addressA 用户地址
   * @returns {boolean} 检查结果
   */
  checkBetRequest(message, addressA) {
    let {
      channelIdentifier,
      round,
      betMask,
      modulo,
      positiveA,
      negativeB,
      hashRa,
      signatureA
    } = message;

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

    let isValid = Ecsign.checkSignature(messagehash, signatureA, addressA);
    return isValid;
  }

  /**
   * 检查LockedTransfer消息签名是否正确
   * @param message LockedTransfer类型消息，主要可以处理四种消息：LockedTransfer/LockedTranferR/DirectTransfer/DirectTransferR
   * @param address 签名用户地址
   * @returns {Boolean} 检查结果
   */
  checkLockedTransfer(message, address) {
    let { channelIdentifier, balanceHash, nonce, signature } = message;
    let messagehash = this.web3.utils.soliditySha3(
      this.paymentContractAddress,
      channelIdentifier,
      balanceHash,
      nonce
    );

    let isValid = Ecsign.checkSignature(messagehash, signature, address);
    return isValid;
  }

  /**
   * 检查BetResponse消息签名是否正确 
   * @param message BetResponse消息体
   * @param addressB 签名用户地址
   * @returns {Boolean} 签名结果
   */
  checkBetResponse(message, addressB) {
    let {
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
    } = message;
    let messagehash = this.web3.utils.soliditySha3(
      this.gameContractAddress,
      channelIdentifier,
      round,
      betMask,
      modulo,
      positiveA,
      negativeB,
      hashRa,
      signatureA,
      Rb
    );

    let isValid = Ecsign.checkSignature(messagehash, signatureB, addressB);
    return isValid;
  }

  /**
   * 检查Preimage消息, 判断用户给出的随机数是否与BetRequest中提供的hashRa匹配 
   * @param message Preimage消息
   * @param hashRa BetRequest中玩家提供的hashRa 
   * @returns {Boolean} 检查结果
   */
  checkPreimage(message, hashRa) {
    let { channelIdentifier, round, ra } = message;
    let newHashRa = this.web3.utils.soliditySha3(ra);
    let isValid = newHashRa == hashRa;
    logInfo("checkPreimage", hashRa, newHashRa);
    return isValid;
  }

  /**
   * 检查CooperativeSettleRequest消息体签名是否正确 
   * @param message CooperativeSettleRequest消息体
   * @param address 签名用户的地址
   * @returns {Boolean} 签名检查结果
   */
  checkCooperativeSettleRequest(message, address, address2){
    let { channelIdentifier, p1, p1Balance, p2, p2Balance, p1Signature, p2Signature } = message;

    let messagehash = this.web3.utils.soliditySha3(this.paymentContractAddress, channelIdentifier, p1, p1Balance, p2, p2Balance);

    logInfo("checkCooperativeSettleRequest messagehash is ", messagehash);

    let isValid = Ecsign.checkSignature(messagehash, p1Signature, address);

    if(address2 != null && p2Signature != null){
      let isValid2 = Ecsign.checkSignature(messagehash, p2Signature, address2);
      isValid = isValid && isValid2;
    }

    return isValid;
  }

}

module.exports = MessageValidator;
