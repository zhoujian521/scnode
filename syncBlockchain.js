



class SyncBlockchain{

    constructor(scclient){

        this.scclient = scclient;
        this.web3 = scclient.web3;
        this.blockchainQuery = scclient.blockchainQuery;
        this.dbhelper = scclient.dbhelper;
        this.from = scclient.from;
    }


    async doSync(partner){

        let channelIdentifier = await this.blockchainQuery.getChannelIdentifier(partner);
        console.log('channelIdentifier is ', channelIdentifier);
        let channelFromChain = await this.blockchainQuery.getChannels(channelIdentifier);
        console.log('channelFromChain', channelFromChain);
        let channelFromDb = await this.dbhelper.getChannel(channelIdentifier);
        console.log('channelFromDB', channelFromDb);

        let selfInfo = await this.blockchainQuery.getParticipantInfo(channelIdentifier, this.from);
        console.log('selfInfo', selfInfo);
        let partnerInfo = await this.blockchainQuery.getParticipantInfo(channelIdentifier, partner);
        console.log('partnerInfo', partnerInfo);



        //通道状态为开通或者关闭
        if(channelFromChain.state == 1){
            // channelFromDb不存在
            if(channelFromDb == null){
                let channel = {
                    channelId: channelIdentifier,
                    partner: partner,
                    settleTimeout: channelFromChain.settle_timeout,
                    totalDeposit: selfInfo.deposit,
                    partnerTotalDeposit: partnerInfo.deposit,
                    localBalance: selfInfo.deposit,
                    remoteBalance: partnerInfo.deposit,
                    localLockedAmount: 0,
                    remoteLockedAmount: 0,
                    currentRound: 0,
                    localNonce: 0,
                    remoteNonce: 0,
                    status: Constants.CHANNEL_OPENED
                  };

                await this.dbhelper.addChannel(channel);

            }else{
                let newAttr = {};
                // channelFromDb余额对不上

                console.log(channelFromDb.totalDeposit, selfInfo.deposit);
                if(parseInt(channelFromDb.totalDeposit) < parseInt(selfInfo.deposit)){

                    let delta = this.web3.utils.toBN(selfInfo.deposit).sub(this.web3.utils.toBN(channelFromDb.totalDeposit));
                    newAttr.localBalance = this.web3.utils
                      .toBN(channelFromDb.localBalance)
                      .add(delta)
                      .toString(10);
                    newAttr.totalDeposit = selfInfo.deposit;

                }

                console.log(channelFromDb.partnerTotalDeposit, partnerInfo.deposit);
                if(parseInt(channelFromDb.partnerTotalDeposit) < parseInt(partnerInfo.deposit)){
                    let delta = this.web3.utils.toBN(partnerInfo.deposit).sub(this.web3.utils.toBN(channelFromDb.partnerTotalDeposit));
                    newAttr.remoteBalance = this.web3.utils
                      .toBN(channelFromDb.remoteBalance)
                      .add(delta)
                      .toString(10);
                    newAttr.partnerTotalDeposit = partnerInfo.deposit;
                }

                console.log('newAttr is ', newAttr);

                if(Object.keys(newAttr).length > 0){
                    await this.dbhelper.updateChannel(channelIdentifier, newAttr);
                }
            }
        }
    }
}


module.exports = SyncBlockchain;