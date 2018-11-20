/**
 * 强关通道时相关数据证据的提供类
 * 主要包含以下几类Proof数据
 * 1. CloseData 发起强关提交给Payment合约的数据
 * 2. BalanceProof 响应强关提交给Payment合约的数据
 * 3. SettleData 结算通道时提交给Payment合约的数据
 * 4. UnlockData 解锁LockedTransfer时提交给Payment合约的数据
 * 5. InitiatorSettleData 玩家发起强关提交给Game合约的数据
 * 6. AcceptorSettleData 庄家发起强关提交给Game合约的数据
 * 7. InitiatorRevealData 玩家响应庄家强关 提交给Game合约的数据
 */
class ProofGenerator{
    constructor(scclient) {
        this.from = scclient.from;
        this.scclient = scclient;
        this.dbhelper = scclient.dbhelper;
        this.web3 = scclient.web3;
    }

    /**
     * 生成通道强关操作所需要的数据
     * @param channel 通道数据
     * @returns {Object} 返回通道强关所需的参数
     */
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

    /**
     * 生成 响应通道强关所需要的数据
     * @param channel 通道数据
     * @returns {Object} BalanceProof数据体
     */
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

    /**
     * 生成通道结算数据
     * @param channel 通道数据
     * @param localBalanceHash  关通道时己方提交给合约的balanceHash
     * @param remoteBalanceHash  关通道时对方提交给合约的balanceHash
     * @returns {Object} 结算通道时所需要的数据
     */
    async getSettleData(channel, localBalanceHash, remoteBalanceHash) {

        let { channelId , partner} = channel;
        let participant1 = this.from;
        let participant1_transferred_amount = 0;
        let participant1_locked_amount = 0;
        let participant1_lock_id = 0;


        // BalanceHash = SoliditySha3(transferred_amount, locked_amount, round)
        if(remoteBalanceHash == ''){

        }else{
            let transferLocal = await this.dbhelper.getLatestTransfer({ channelId, balanceHash: remoteBalanceHash, owned: 0 });

            if(transferLocal){
                participant1_transferred_amount = transferLocal.transferred_amount;
                participant1_locked_amount= transferLocal.locked_amount;
                //特殊设定：如果LockedTransfer中locked_amount为0, 则生成balanceHash时round设置为0，如果locked_amount不为0,则设置为相应的round
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
                //特殊设定：如果LockedTransfer中locked_amount为0, 则生成balanceHash时round设置为0，如果locked_amount不为0,则设置为相应的round
                participant2_lock_id = participant2_locked_amount == 0 ? 0 : transferRemote.round; 
            }
        }
        return { participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id };
    }

    /**
     * 生成解锁通道时所需要的数据 
     * @param participant1 通道的一方地址
     * @param participant2 通道的另一方地址
     * @param lockIdentifier 锁定ID
     * @returns {Object} UnlockData
     */
    async getUnlockData(participant1, participant2, lockIdentifier) {
        return { participant1, participant2, lockIdentifier };
    }

    /**
     * 生成玩家强制结算游戏时所需要的数据InitiatorSettleData
     * @param channel 通道数据
     * @param bet 赌局数据
     * @returns {Object} InitiatorSettleData
     */
    async getInitiatorSettleData(channel, bet){
        let {channelId: channelIdentifier} = channel;

        let { betMask, modulo, round, positiveA: positive, negativeB: negative, ra: initiatorR, hashRa: initiatorHashR, signatureA: initiatorSignature, rb: acceptorR, signatureB: acceptorSignature } = bet;
        
        //提交给合约时initiatorSignature和acceptorSignature是bytes类型，所以此处需要做一个hex to bytes的转换
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

    /**
     * 庄家强制结算游戏时所需要的数据
     * @param channel 通道数据
     * @param bet 赌局数据
     * @returns {Object} AcceptorSettleData
     */
    async getAcceptorSettleData(channel, bet){

        let {channelId: channelIdentifier} = channel;
        let { betMask, modulo, round, positiveA: positive, negativeB: negative, hashRa: initiatorHashR, signatureA: initiatorSignature, rb: acceptorR } = bet;
        return { channelIdentifier, round, betMask, modulo, positive, negative, initiatorHashR, initiatorSignature: this.web3.utils.hexToBytes(initiatorSignature), acceptorR };
    }

    /**
     * 庄家强制结算游戏时，玩家响应所需要的数据
     * @param channel 通道数据
     * @param bet 赌局数据
     * @returns {Object} InitiatorRevealData
     */
    async getInitiatorRevealData(channel, bet){

        let {channelId: channelIdentifier} = channel;
        let {round, ra: initiatorR} = bet;
        return { channelIdentifier, round, initiatorR };
    }

}

module.exports = ProofGenerator;