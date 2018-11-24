/**
 * 区块链查询
 * 主要包含功能:
 * 3. 通道/游戏合约查询功能
 */
const Tx = require('ethereumjs-tx');


class BlockchainQuery {
  constructor(web3, config) {
    let {
      fromAddress,
      paymentContractAddress,
      paymentContractAbi,
      gameContractAddress,
      gameContractAbi
    } = config;

    this.web3 = web3;

    this.paymentContract = new web3.eth.Contract(
      paymentContractAbi,
      paymentContractAddress
    );
    this.paymentContractAddress = paymentContractAddress;
    this.gameContract = new web3.eth.Contract(
      gameContractAbi,
      gameContractAddress
    );
    this.gameContractAddress = gameContractAddress;
    this.from = fromAddress;

  }

  /**
   * 查询锁定ID对应的锁定金额
   * @param lockIdentifier 锁定ID
   * @returns 返回锁定金额
   */
  async getLockIdentifier_to_lockedAmount(lockIdentifier) {
    return await this.paymentContract.methods
      .lockIdentifier_to_lockedAmount(lockIdentifier)
      .call({ from: this.from });
  }

  /**
   * 查询通道信息
   * @param channelIdentifier 通道ID
   * @returns 通道信息
   */
  async getChannels(channelIdentifier) {
    return await this.paymentContract.methods
      .channels(channelIdentifier)
      .call({ from: this.from });
  }



  /**
   * 查询通道参与者信息
   * @param channelIdentifier 通道ID 
   * @param participant 参与者地址
   * @returns {Object} ParticipantInfo
   */
  async getParticipantInfo(channelIdentifier, participant){
    return await this.paymentContract.methods
      .getParticipantInfo(channelIdentifier, participant)
      .call({ from: this.from });
  }

  /**
   * 根据己方地址，另一方地址获取通道ID
   * @param partnerAddress 另一方地址
   * @returns 通道ID
   */
  async getChannelIdentifier(partnerAddress) {
    return await this.paymentContract.methods
      .getChannelIdentifier(partnerAddress, this.from)
      .call({ from: this.from });
  }

  /**
   * 获取游戏合约地址
   */
  async getGameAddress() {
    return await this.paymentContract.methods.game().call({ from: this.from });
  }

  //Game Contract Methods

  /**
   * 查询仲裁结果
   * @param roundIdentifier 轮数ID
   * @returns 仲裁结果
   */
  async getResult(roundIdentifier) {
    return await this.gameContract.methods
      .getResult(roundIdentifier)
      .call({ from: this.from });
  }

  /**
   * 查询合约仲裁信息及状态
   * @param roundIdentifier 论数ID
   * @return 返回仲裁信息
   */
  async getRoundIdentifier_to_diceInfo(roundIdentifier) {
    return await this.gameContract.methods
      .roundIdentifier_to_diceInfo(roundIdentifier)
      .call({ from: this.from });
  }

}

// Game Contract Methods:
module.exports = BlockchainQuery;
