/**
 * 区块链查询和提交交易接口类
 * 主要包含功能:
 * 1. 通道合约开关通道相关功能
 * 2. 游戏合约仲裁功能
 * 3. 通道合约查询功能
 * 4. 游戏合约仲裁功能
 */
const Tx = require('ethereumjs-tx');


class BlockchainProxy {
  constructor(web3, config) {
    let {
      fromAddress,
      privateKey,
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
    this.privateKey = privateKey;
    this.gasPriceGwei = 8;
    this.gasLimit = 600000;
    this.chainId = 4;
  }

  async testMonitorEvent(){

    this.paymentContract.getPastEvents('ChannelOpened',
    {
      filter: {}, 
      fromBlock: 0,
      toBlock: 'latest'
    },
    function(error, event){
      logInfo(event);
    });
  }







  /**
   * 开通通道
   * @param participant1 通道一方参与者地址
   * @param participant2 通道另一方参与者地址
   * @param settle_window 通道结算超时事件 默认3-6个区块时间
   * @param amount 开通通道时，一方存入的金额]
   * @returns 返回交易的hash
   */
  async openChannel(participant1, participant2, settle_window, amount = 0) {
    let data = this.paymentContract
      .methods
      .openChannel(participant1, participant2, settle_window)
      .encodeABI();
    return await this.sendTransaction(
      this.paymentContractAddress,
      amount,
      data
    );
  }

  /**
   * 通道中存钱
   * @param participant 存钱者地址
   * @param partner 通道另一方
   * @param amount 存入金额
   * @returns 返回交易hash
   */
  async deposit(participant, partner, amount) {
    let data = this.paymentContract
      .methods
      .setTotalDeposit(participant, partner).encodeABI();
    return await this.sendTransaction(
      this.paymentContractAddress,
      amount,
      data
    );
  }

  /**
   * 强关通道
   * @param partner 通道另一方地址
   * @param balanceHash 余额Hash
   * @param nonce 转账nonce
   * @param signature 另一方签名
   * @returns 交易hash
   */
  async closeChannel(partner, balanceHash, nonce, signature) {

    logInfo('closeChannel params', partner, balanceHash, nonce, signature);

    let data = this.paymentContract
      .methods
      .closeChannel(partner, balanceHash, nonce, signature)
      .encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
  }

  /**
   * 针对强关，提交申述证据
   * @param closing 强关发起者地址
   * @param balanceHash 余额Hash
   * @param nonce 转账nonce
   * @param signature 另一方签名
   * @returns 交易hash
   */
  async updateBalanceProof(closing, balanceHash, nonce, signature) {

    logInfo('updateBalanceProof params', closing, balanceHash, nonce, signature);
    let data = this.paymentContract
      .methods
      .nonclosingUpdateBalanceProof(closing, balanceHash, nonce, signature)
      .encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
  }

  /**
   * 强关申请后，结算通道
   * @param participant1                      一方地址
   * @param participant1_transferred_amount   一方转出金额
   * @param participant1_locked_amount        一方锁定金额
   * @param participant1_lock_id              一方锁定ID
   * @param participant2                      另一方地址
   * @param participant2_transferred_amount   另一方转出金额
   * @param participant2_locked_amount        另一方锁定金额
   * @param participant2_lock_id              另一方锁定ID
   * @returns 交易hash
   */
  async settle(
    participant1,
    participant1_transferred_amount,
    participant1_locked_amount,
    participant1_lock_id,
    participant2,
    participant2_transferred_amount,
    participant2_locked_amount,
    participant2_lock_id
  ) {
    logInfo('settle params', participant1, participant1_transferred_amount, participant1_locked_amount, participant1_lock_id, participant2, participant2_transferred_amount, participant2_locked_amount, participant2_lock_id);
    let data = this.paymentContract
      .methods
      .settleChannel(
        participant1,
        participant1_transferred_amount,
        participant1_locked_amount,
        participant1_lock_id,
        participant2,
        participant2_transferred_amount,
        participant2_locked_amount,
        participant2_lock_id
      )
      .encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
  }

  /**
   * 强关-解锁锁定金额
   * @param participant1 通道一方地址
   * @param participant2 通道另一方地址
   * @param lockIdentifier 通道锁定ID
   * @returns 交易hash
   */
  async unlock(participant1, participant2, lockIdentifier) {
    let data = this.paymentContract
      .methods
      .unlock(participant1, participant2, lockIdentifier)
      .encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
  }

  /**
   * 协商关通道 区块链提交交易
   * @param participant1_address 一方地址
   * @param participant1_balance 一方余额
   * @param participant2_address 另一方地址
   * @param participant2_balance 另一方余额
   * @param participant1_signature 一方签名
   * @param participant2_signature 另一方签名
   * @returns 交易hash
   */
  async cooperativeSettle(
    participant1_address,
    participant1_balance,
    participant2_address,
    participant2_balance,
    participant1_signature,
    participant2_signature
  ) {
    let data = this.paymentContract.methods
      .cooperativeSettle(
        participant1_address,
        participant1_balance,
        participant2_address,
        participant2_balance,
        participant1_signature,
        participant2_signature
      ).encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
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
   * 玩家申请游戏合约仲裁
   * @param channelIdentifier    通道ID
   * @param round                轮数
   * @param betMask              下注内容
   * @param modulo               游戏种类
   * @param positive             玩家地址
   * @param negative             庄家地址
   * @param initiatorHashR       玩家随机数Hash
   * @param initiatorSignature   玩家签名
   * @param acceptorR            庄家随机数
   * @param acceptorSignature    庄家签名
   * @param initiatorR           玩家随机数
   * @returns 交易hash
   */
  async initiatorSettle(
    channelIdentifier,
    round,
    betMask,
    modulo,
    positive,
    negative,
    initiatorHashR,
    initiatorSignature,
    acceptorR,
    acceptorSignature,
    initiatorR
  ) {

    
    logInfo("initiatorSettle params: ", channelIdentifier, round, betMask, modulo, positive, negative, initiatorHashR, initiatorSignature, acceptorR, acceptorSignature, initiatorR);

    try{
    let data = this.gameContract
      .methods
      .initiatorSettle(
        channelIdentifier,
        round,
        betMask,
        modulo,
        positive,
        negative,
        initiatorHashR,
        initiatorSignature,
        acceptorR,
        acceptorSignature,
        initiatorR
      )
      .encodeABI();
      let result = await this.sendTransaction(this.gameContractAddress, 0, data);
      return result;
    }catch(err){
      logError(err);
    }

      return null;
  }

  /**
   * 庄家申请游戏合约仲裁
   * @param channelIdentifier         通道ID
   * @param round                     轮数
   * @param betMask                   下注内容
   * @param modulo                    种类
   * @param positive                  玩家地址
   * @param negative                  庄家地址
   * @param initiatorHashR            玩家Hash
   * @param initiatorSignature        玩家签名
   * @param acceptorR                 庄家随机数
   * @returns 交易hash
   */
  async acceptorSettle(
    channelIdentifier,
    round,
    betMask,
    modulo,
    positive,
    negative,
    initiatorHashR,
    initiatorSignature,
    acceptorR
  ) {


    logInfo("acceptorSettle params", channelIdentifier, round, betMask, modulo, positive, negative, initiatorHashR, initiatorSignature, acceptorR);

    let data = this.gameContract
      .methods
      .acceptorSettle(
      channelIdentifier,
      round,
      betMask,
      modulo,
      positive,
      negative,
      initiatorHashR,
      initiatorSignature,
      acceptorR

    ).encodeABI();
    return await this.sendTransaction(this.gameContractAddress, 0, data);
  }

  /**
   * 庄家申请游戏合约仲裁，玩家提交证据
   * @param channelIdentifier 通道ID
   * @param round             轮数
   * @param initiatorR        玩家随机数
   * @returns 交易hash
   */
  async initiatorReveal(channelIdentifier, round, initiatorR) {

    logInfo("initiatorReveal params", channelIdentifier, round, initiatorR);


    let data = this.gameContract
      .methods
      .initiatorReveal(channelIdentifier, round, initiatorR).encodeABI();
    return await this.sendTransaction(this.gameContractAddress, 0, data);
  }

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

  /**
   * 提交区块链交易基础函数
   * @param to     交易接受方
   * @param value  发送eth值
   * @param data   发送具体数据
   * @returns 交易hash
   */
  async sendTransaction(to, value, data) {
    let web3 = this.web3;
    let gasPriceGwei = this.gasPriceGwei;
    let gasLimit = this.gasLimit;
    let chainId = this.chainId;
    let from = this.from;

    let nonce = await this.web3.eth.getTransactionCount(from);

    var rawTransaction = {
      from: from,
      nonce: "0x" + nonce.toString(16),
      gasPrice: web3.utils.toHex(gasPriceGwei * 1e9),
      gasLimit: web3.utils.toHex(gasLimit),
      to: to,
      value: web3.utils.toHex(value),
      data: data,
      chainId: chainId
    };

    // console.log('rawTransaction', rawTransaction);

    var privKey = new Buffer(this.privateKey, "hex");
    var tx = new Tx(rawTransaction);
    tx.sign(privKey);

    var serializedTx = tx.serialize();

    logInfo(
      `Attempting to send signed tx:  0x${serializedTx.toString(
        "hex"
      )}\n------------------------`
    );

    return new Promise((resolve, reject) => {
      web3.eth.sendSignedTransaction(
        "0x" + serializedTx.toString("hex"),
        function(err, hash) {
          if (!err) {
            logInfo(hash);
            resolve(hash);
          } else {
            reject(err);
          }
        }
      );
    });
  }
}

// Game Contract Methods:

module.exports = BlockchainProxy;
