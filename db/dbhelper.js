/**
 * DB Objects
 * 1. channel
 * 2. payment
 * 3. transfer
 * 4. bet
 *
 */
class DBHelper {
  addChannel(channel) {}
  updateChannel(channelId, newAttr) {}
  deleteChannel(channelId) {}
  getChannels() {}
  getChannel(channelId) {}

  addPayment(payment) {}
  getPaymetns() {}

  addTransfer(transfer) {}
  updateTransfer(transferId, newAttr) {}
  deleteTransfer(transferId) {}
  getTransfer(transferId) {}

  addBet(bet) {}
  updateBet(betId, newAttr) {}
  getBets() {}
  getBet(betId) {}
}

module.exports = DBHelper;
