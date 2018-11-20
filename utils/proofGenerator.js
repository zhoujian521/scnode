class ProofGenerator{
    constructor(scclient) {
        this.from = scclient.from;
        this.scclient = scclient;
        this.dbhelper = scclient.dbhelper;
        this.web3 = scclient.web3;
    }

    async getCloseData(channel){
        
        let {channelId, remoteNonce: nonce} = channel;

        let partner = channel.partner;
        let balanceHash = "0x";
        let signature = "0x";
        let transfer = await this.dbhelper.getLatestTransfer({ channelId, nonce, owned: 1 });
        if (transfer != null) {
            balanceHash = transfer.balanceHash;
            signature = this.web3.utils.hexToBytes(transfer.signature);
        }
        return { partner, balanceHash, nonce, signature };
    }

    async getBalanceProof(channel){

        let {channelId, remoteNonce: nonce} = channel;

        let partner = channel.partner;
        let balanceHash = "0x";
        let signature = "0x";
        let transfer = await this.dbhelper.getLatestTransfer({ channelId, nonce, owned: 1 });
        if (transfer != null) {
            balanceHash = transfer.balanceHash;
            signature = this.web3.utils.hexToBytes(transfer.signature);
        }
        return { closing: partner, balanceHash, nonce, signature };

    }

    async getSettleData(channel, localBalanceHash, remoteBalanceHash) {

        let { channelId , partner} = channel;
        let participant1 = this.from;
        let participant1_transferred_amount = 0;
        let participant1_locked_amount = 0;
        let participant1_lock_id = 0;

        if(remoteBalanceHash == ''){

        }else{
            let transferLocal = await this.dbhelper.getLatestTransfer({ channelId, balanceHash: remoteBalanceHash, owned: 0 });

            if(transferLocal){
                participant1_transferred_amount = transferLocal.transferred_amount;
                participant1_locked_amount= transferLocal.locked_amount;
                participant1_lock_id = participant1_locked_amount == 0 ? 0 : transferLocal.round;
            }
        }

        let participant2 = partner;
        let participant2_transferred_amount = 0;
        let participant2_locked_amount = 0;
        let participant2_lock_id = 0;
        if(localBalanceHash == ''){

        }else{
            let transferRemote = await this.dbhelper.getLatestTransfer({ channelId, balanceHash: localBalanceHash, owned: 1 });
            if(transferRemote){
                participant2_transferred_amount = transferRemote.transferred_amount;
                participant2_locked_amount= transferRemote.locked_amount;
                participant2_lock_id = participant2_locked_amount == 0 ? 0 : transferRemote.round;
            }
        }
        return { participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id };
    }

    async getUnlockData(participant1, participant2, lockIdentifier) {
        return { participant1, participant2, lockIdentifier };
    }

    async getInitiatorSettleData(channel, bet){
        let {channelId: channelIdentifier} = channel;

        let { betMask, modulo, round, positiveA: positive, negativeB: negative, ra: initiatorR, hashRa: initiatorHashR, signatureA: initiatorSignature, rb: acceptorR, signatureB: acceptorSignature } = bet;
        return {
            channelIdentifier,
            round,
            betMask,
            modulo,
            positive,
            negative,
            initiatorHashR,
            initiatorSignature: this.web3.utils.hexToBytes(initiatorSignature),
            acceptorR,
            acceptorSignature: this.web3.utils.hexToBytes(acceptorSignature),
            initiatorR            
        };
    }

    async getAcceptorSettleData(channel, bet){

        let {channelId: channelIdentifier} = channel;
        let { betMask, modulo, round, positiveA: positive, negativeB: negative, hashRa: initiatorHashR, signatureA: initiatorSignature, rb: acceptorR } = bet;
        return { channelIdentifier, round, betMask, modulo, positive, negative, initiatorHashR, initiatorSignature: this.web3.utils.hexToBytes(initiatorSignature), acceptorR };
    }

    async getInitiatorRevealData(channel, bet){

        let {channelId: channelIdentifier} = channel;
        let {round, ra: initiatorR} = bet;
        return { channelIdentifier, round, initiatorR };
    }

}

module.exports = ProofGenerator;