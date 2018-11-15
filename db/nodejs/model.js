const Sequelize = require("sequelize");

module.exports = (sequelize) => {

  const Channel = sequelize.define("channel", {
    channelId: { type: Sequelize.STRING, primaryKey: true },
    settleTimeout: Sequelize.STRING,
    partner: Sequelize.STRING,
    totalDeposit: Sequelize.STRING,
    partnerTotalDeposit: Sequelize.STRING,
    localBalance: Sequelize.STRING,
    remoteBalance: Sequelize.STRING,
    localLockedAmount: Sequelize.STRING,
    remoteLockedAmount: Sequelize.STRING,
    localNonce: Sequelize.INTEGER,
    remoteNonce: Sequelize.INTEGER,
    status: Sequelize.TINYINT,
    currentRound: Sequelize.INTEGER
  });

  const Transfer = sequelize.define("transfer", {
    transferId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    channelId: Sequelize.STRING,
    balanceHash: Sequelize.STRING,
    transferred_amount: Sequelize.STRING,
    locked_amount: Sequelize.STRING,
    round: Sequelize.INTEGER,
    nonce: Sequelize.INTEGER,
    owned: Sequelize.TINYINT,
    signature: Sequelize.STRING
  });

  const Bet = sequelize.define("bet", {
    betId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    gameContractAddress: Sequelize.STRING,
    channelId: Sequelize.STRING,
    round: Sequelize.INTEGER,
    betMask: Sequelize.STRING,
    modulo: Sequelize.INTEGER,
    value: Sequelize.STRING,
    positiveA: Sequelize.STRING,
    hashRa: Sequelize.STRING,
    ra: Sequelize.STRING,
    signatureA: Sequelize.STRING,
    negativeB: Sequelize.STRING,
    rb: Sequelize.STRING,
    signatureB: Sequelize.STRING,
    winner: Sequelize.STRING,
    winAmount: Sequelize.STRING,
    status: Sequelize.INTEGER
  });

  const Payment = sequelize.define("payment", {
    paymentId: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    betId: Sequelize.INTEGER,
    fromAddr: Sequelize.STRING,
    toAddr: Sequelize.STRING,
    value: Sequelize.STRING
  });

  const init = async()=>{
    await Channel.sync();
    await Transfer.sync();
    await Bet.sync();
    await Payment.sync();
  }

  return {
    init,
    Channel,
    Transfer,
    Bet,
    Payment
  };
}


