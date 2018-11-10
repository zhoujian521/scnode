/**
 *
 * Message Type
 *
 * 1. ChannelOpen
 * 2. BetPlaced
 * 3. BetSettled
 * 4. PaymentReceived
 * 5. ChannelClosed
 * 6. BalanceProofUpdated
 * 7. BetUnlocked
 * 8. ChannelSettled
 *
 */

class eventManager {
  constructor(eventList) {
    this.eventList = eventList;
  }

  async sendChannelOpen(channel) {
    this.eventList.ChannelOpen && this.eventList.ChannelOpen(channel);
  }
  async sendChannelSettled() {
    this.eventList.ChannelSettled && this.eventList.ChannelSettled(channel);
  }

  sendChannelClosed(channel) {
    this.eventList.ChannelSettled && this.eventList.ChannelSettled(channel);
  }

  sendBalanceProofUpdated(channel) {
    this.eventList.BalanceProofUpdated &&
      this.eventList.BalanceProofUpdated(channel);
  }

  sendBetUnlocked(channel, bet) {
    this.eventList.BetUnlocked && this.eventList.BetUnlocked(channel, bet);
  }

  sendBetPlaced(channel, bet) {
    this.eventList.BetPlaced && this.eventList.BetPlaced(channel, bet);
  }

  sendBetSettled(channel, bet) {
    this.eventList.BetSettled && this.eventList.BetSettled(channel, bet);
  }

  sendPaymentReceived(channel, bet) {
    this.eventList.PaymentReceived &&
      this.eventList.PaymentReceived(channel, bet);
  }
}

module.exports = eventManager;
