/**
 * 返回给外部的消息类
 * Message Type
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
    logInfo("sendChannelOpen", this.eventList);

    this.eventList.ChannelOpen && this.eventList.ChannelOpen(channel);
  }
  async sendChannelSettled(channel) {
    this.eventList.ChannelSettled && this.eventList.ChannelSettled(channel);
  }

  async sendChannelClosed(channel) {
    this.eventList.ChannelSettled && this.eventList.ChannelSettled(channel);
  }

  async sendBalanceProofUpdated(channel) {
    this.eventList.BalanceProofUpdated &&
      this.eventList.BalanceProofUpdated(channel);
  }

  async sendCooperativeSettled(channel) {
    this.eventList.CooperativeSettled &&
      this.eventList.CooperativeSettled(channel);
  }
  
  async sendBetUnlocked(channel, bet) {
    this.eventList.BetUnlocked && this.eventList.BetUnlocked(channel, bet);
  }

  async sendBetPlaced(channel, bet) {
    this.eventList.BetPlaced && this.eventList.BetPlaced(channel, bet);
  }

  async sendBetSettled(channel, bet) {
    this.eventList.BetSettled && this.eventList.BetSettled(channel, bet);
  }

  async sendPaymentReceived(channel, bet) {
    this.eventList.PaymentReceived &&
      this.eventList.PaymentReceived(channel, bet);
  }

  async sendChannelDeposit(channel) {
    this.eventList.ChannelDeposit &&
      this.eventList.ChannelDeposit (channel);
  }

  // vincent expose message
  async sendBetRequest(channel, message) {
    this.eventList.BetRequest && this.eventList.BetRequest(channel, message);
  }

  async sendLockedTransfer(channel, message) {
    this.eventList.LockedTransfer && this.eventList.LockedTransfer(channel, message);
  }

  async sendLockedTransferR(channel, message) {
    this.eventList.LockedTransferR && this.eventList.LockedTransferR(channel, message);
  }

  async sendBetResponse(channel, message) {
    this.eventList.BetResponse && this.eventList.BetResponse(channel, message);
  }

  async sendPreimage(channel, message) {
    this.eventList.Preimage && this.eventList.Preimage(channel, message);
  }

  async sendDirectTransfer(channel, message) {
    this.eventList.DirectTransfer && this.eventList.DirectTransfer(channel, message);
  }

  async sendDirectTransferR(channel, message) {
    this.eventList.DirectTransferR && this.eventList.DirectTransferR(channel, message);
  }

}

module.exports = eventManager;
