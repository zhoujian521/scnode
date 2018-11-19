const Ecsign = require("./ecsign");

class MessageValidator {
  constructor(web3, gameContractAddress, paymentContractAddress) {
    this.web3 = web3;
    this.gameContractAddress = gameContractAddress;
    this.paymentContractAddress = paymentContractAddress;
  }

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

  checkPreimage(message, hashRa) {
    let { channelIdentifier, round, ra } = message;
    let newHashRa = this.web3.utils.sha3(ra);
    let isValid = newHashRa == hashRa;
    logInfo("checkPreimage", hashRa, newHashRa);
    return isValid;
  }

  checkCooperativeSettleRequest(message, address){
    let {channelIdentifier, p1, p1Balance, p2, p2Balance, signature} = message;

    let messagehash = this.web3.utils.soliditySha3(this.paymentContractAddress, channelIdentifier, p1, p1Balance, p2, p2Balance);

    logInfo("checkCooperativeSettleRequest messagehash is ", messagehash);

    let isValid = Ecsign.checkSignature(messagehash, signature, address);
    return isValid;
  }

}

module.exports = MessageValidator;
