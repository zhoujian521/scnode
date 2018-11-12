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
    status: Sequelize.TINYINT
  });

  const Transfer = sequelize.define("tansfer", {
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
    from: Sequelize.STRING,
    to: Sequelize.STRING,
    value: Sequelize.STRING
  });

  Channel.sync();
  Transfer.sync();
  Bet.sync();
  Payment.sync();


  return {
    Channel,
    Transfer,
    Bet,
    Payment
  };
}


