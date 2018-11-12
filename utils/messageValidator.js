
class MessageValidator {
    constructor(web3, gameContractAddress, paymentContractAddress) {
        this.web3 = web3;
        this.gameContractAddress = gameContractAddress;
        this.paymentContractAddress = paymentContractAddress;
    }

    checkBetRequest(message, addressA) {
        let { channelIdentifier, round, betMask, modulo, positiveA, negativeB, hashRa, signatureA } = message;


        return true;

    }

    checkLockedTransfer(message, address) {
        let { channelIdentifier, balanceHash, nonce, signature } = message;

        return true;
    }

    checkBetResponse(message, addressB) {
        let { channelIdentifier, round, betMask, modulo, positiveA, negativeB, hashRa, signatureA, Rb, signatureB } = message;

        return true;
    }

    checkPreimage(message, address) {
        let { channelIdentifier, round, ra } = message;

        return true;
    }
}


module.exports = MessageValidator;