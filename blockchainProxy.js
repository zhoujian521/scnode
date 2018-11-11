// Payment Contract Methods:
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
      console.log(event);
    });
  }






  //Payment Contract Method.

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

  async closeChannel(partner, balanceHash, nonce, signature) {
    let data = this.paymentContract
      .methods
      .closeChannel(partner, balanceHash, nonce, signature)
      .encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
  }

  async updateBalanceProof(closing, balanceHash, nonce, signature) {
    let data = this.paymentContract
      .methods
      .updateBalanceProof(closing, balanceHash, nonce, signature)
      .encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
  }

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
    let data = this.paymentContract
      .methods
      .settle(
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

  async unlock(participant1, participant2, lockIdentifier) {
    let data = this.paymentContract
      .methods
      .unlock(participant1, participant2, lockIdentifier)
      .encodeABI();
    return await this.sendTransaction(this.paymentContractAddress, 0, data);
  }

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

  async getLockIdentifier_to_lockedAmount(lockIdentifier) {
    return await this.paymentContract.methods
      .lockIdentifier_to_lockedAmount(lockIdentifier)
      .call({ from: this.from });
  }

  async getChannels(channelIdentifier) {
    return await this.paymentContract.methods
      .channels(channelIdentifier)
      .call({ from: this.from });
  }

  async getChannelIdentifier(partnerAddress) {
    return await this.paymentContract.methods
      .getChannelIdentifier(partnerAddress, this.from)
      .call({ from: this.from });
  }

  async getGameAddress() {
    return await this.paymentContract.methods.game().call({ from: this.from });
  }

  //Game Contract Methods

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
    return await this.sendTransaction(this.gameContract, 0, data);
  }

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
    return await this.sendTransaction(this.gameContract, 0, data);
  }

  async initiatorReveal(channelIdentifier, round, initiatorR) {
    let data = this.gameContract
      .methods
      .initiatorReveal(channelIdentifier, round, initiatorR).encodeABI();
    return await this.sendTransaction(this.gameContract, 0, data);
  }

  async getResult(roundIdentifier) {
    return await this.gameContract.methods
      .getResult(roundIdentifier)
      .call({ from: this.from });
  }

  async getRoundIdentifier_to_diceInfo(roundIdentifier) {
    return await this.gameContract.methods
      .roundIdentifier_to_diceInfo(roundIdentifier)
      .call({ from: this.from });
  }

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

    var privKey = new Buffer(this.privateKey, "hex");
    var tx = new Tx(rawTransaction);
    tx.sign(privKey);

    var serializedTx = tx.serialize();

    console.log(
      `Attempting to send signed tx:  0x${serializedTx.toString(
        "hex"
      )}\n------------------------`
    );

    return new Promise((resolve, reject) => {
      web3.eth.sendSignedTransaction(
        "0x" + serializedTx.toString("hex"),
        function(err, hash) {
          if (!err) {
            console.log(hash);
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
