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
    status: Sequelize.TINYINT
  });

  const Transfer = sequelize.define("tansfer", {
    transferId: Sequelize.INTEGER,
    balanceHash: Sequelize.STRING,
    transferred_amount: Sequelize.STRING,
    locked_amount: Sequelize.STRING,
    locks_root: Sequelize.STRING,
    nonce: Sequelize.INTEGER,
    owned: Sequelize.TINYINT,
    signature: Sequelize.STRING
  });

  const Bet = sequelize.define("bet", {
    betId: Sequelize.INTEGER,
    round: Sequelize.STRING,
    betMask: Sequelize.STRING,
    modulo: Sequelize.INTEGER,
    value: Sequelize.STRING,
    hashRa: Sequelize.STRING,
    ra: Sequelize.STRING,
    signatureA: Sequelize.STRING,
    rb: Sequelize.STRING,
    signatureB: Sequelize.STRING,
    winAmount: Sequelize.STRING,
  });

  const Payment = sequelize.define("payment", {
    paymentId: Sequelize.INTEGER,
    betId: Sequelize.INTEGER,
    from: Sequelize.STRING,
    to: Sequelize.STRING,
    value: Sequelize.STRING,
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


