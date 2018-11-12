const DBHelper = require("../dbhelper");
const Sequelize = require("sequelize");

class NodeDBHelper extends DBHelper {
  constructor(dbprovider) {
    super();

    let { database, username, password, dialect } = dbprovider;
    console.log(database, username, password, dialect);

    let sequelize = new Sequelize(database, username, password, dialect);

    this.model = require("./model")(sequelize);
  }

  async addChannel(channel) {
    console.log("[NodeDBHelper: AddChannel]", channel);
    return await this.model.Channel.create(channel);
  }

  async updateChannel(channelId, newAttr) {
    let channel = await this.model.Channel.findById(channelId);
    if (!channel) {
      return false;
    }
    return channel.update(newAttr);
  }

  async deleteChannel(channelId) {
    let channel = await this.model.Channel.findById(channelId);
    if (!channel) {
      return false;
    }
    return await channel.destroy({ force: true });
  }

  async getChannels() {
    return await this.model.Channel.findAll().map(el =>
      el.get({ plain: true })
    );
  }

  async getChannel(channelId) {
    let channel = await this.model.Channel.findById(channelId);
    if (channel) return channel.get({ plain: true });
    return null;
  }

  async addPayment(payment) {
    return await this.model.Payment.create(payment);
  }

  async getPaymetns() {
    return await this.model.Payment.findAll().map(el =>
      el.get({ plain: true })
    );
  }

  async addTransfer(transfer) {
    return await this.model.Transfer.create(transfer);
  }

  async updateTransfer(transferId, newAttr) {
    let transfer = await this.model.Transfer.findById(transferId);
    if (!transfer) {
      return false;
    }
    return await transfer.update(newAttr);
  }

  async deleteTransfer(transferId) {
    let transfer = await this.model.Transfer.findById(transferId);
    if (!transfer) {
      return false;
    }
    transfer.destroy({ force: true });
  }

  async getTransfer(transferId) {
    let transfer = await this.model.Transfer.findById(transferId);
    if (!transfer) return null;
    return transfer.get({ plain: true });
  }

  async getLatestTransfer(channelId, owned) {
    let transfer = await this.model.Transfer.findOne({
      where: { channelId, owned },
      order: [["nonce", "desc"]]
    });
    if (!transfer) return null;
    return transfer.get({ plain: true });
  }

  async addBet(bet) {
    return await this.model.Bet.create(bet);
  }

  async updateBet(betId, newAttr) {
    let bet = await this.model.Bet.findById(betId);
    if (!bet) return false;
    return await bet.update(newAttr);
  }

  async getBets() {
    return await this.model.Bet.findAll().map(el => el.get({ plain: true }));
  }

  async getBet(betId) {
    let bet = await this.model.Bet.findById(betId);
    if (!bet) return null;
    return bet.get({ plain: true });
  }

  async getBetByChannel(where) {
    let bet = await this.model.Bet.findOne({ where, order: [['round', 'desc']] });
    if (!bet) return null;
    return bet.get({ plain: true });
  }

  async getLatestRound(channelId) {
    let bet = await this.model.Bet.findOne({
      where: { channelId },
      order: [["round", "desc"]]
    });
    if (!bet) return 1;
    return parseInt(bet.round) + 1;
  }
}

module.exports = NodeDBHelper;