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
      signatureA,
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
  generatePreimage(channelIdentifier, round, ra) {
    return {
      channelIdentifier,
      round,
      ra
    };
  }
}

module.exports = messageGenerator;