## Interface Documentation

Reference[State channel client api document](https://gitlab.f3m.club/dice/dice2win_blockchain_sc/wikis/State-Channel-Client-API-Document) to use

### :evergreen_tree:  State Channel Node code structure

1. index.js
* Class definition of SCClient

2. messageHandler.js 
* P2P message processing class

3. blockEventHandler.js
* The processing class that listens for contract events on the blockchain and performs the corresponding actions

4. blockChainQuery.js 
* A query class that queries data and contracts on a blockchain does not require a private key

5. blockChainProxy.js 
* The private key is required to submit the transaction to the blockchain and invoke the operation class of the contract

6. Constants.js 
* Constant type definition, mainly including channel state, gambling state and other constants

7. gameRule.js 
* Rules of the game, mainly including the logic of odds calculation, winning or losing judgment, etc., need to be consistent with the logic of the game contract on the blockchain

8. Dice_SC.json
* Is the data file that the game contract compiles with truffle

9.  Payment_ETH.json
* The channel contract compiles the completed data files with truffle

10. utils  Related tool class file
    1.  ecsign.js 
        * Utility class that signs messages with a private key

    2. messageGenerator.js P2P
        * A message generator that generates the various messages required by the offchain protocol and signs the messages

    3.  messageValidator.js 
        * After receiving the P2P message from the other party, verify whether the message signature of the other party is correct

    4.  proofGenerator.js 
        * The types of data that need to be submitted to the contract when generating a strong channel

### :post_office: State Channel Message protocol

Reference [State channel message flow picture](https://gitlab.f3m.club/dice/dice2win_blockchain_sc/wikis/State-Channel-message-flow-picture) to implement the messaging protocol, and made some changes


#### The order in which Bet messages are sent and received   

```
  1. A ----------BetRequest------------> B
  2. A <---------LockedTransfer--------- B
  3. A ----------LockedTransferR-------> B
  4. A <---------BetResponse------------ B
  5. A ----------Preimage--------------> B
  6. A <---------DirectTransfer--------- B
  7. A ----------DirectTransferR-------> B
  8. A <---------BetSettle-------------- B
```
 
#### CooperativeSettle message send and receive order

  1. A ----CooperativeSettleRequest----> B
  
  2. B signs and submits the final message to the blockchain


## :globe_with_meridians: The processing logic when the channel is strongly closed

#### 玩家强关

1. The player calls the closeChannel to close the channel

2. After listening to ChannelClose from the blockchain,

   - If at this time the player has received the BetResponse message and the bet has not been completed, the player should submit the initiatorSettle request to the game contract and request the arbitration of the game contract

   - Banker call nonclosingUpdateBalanceProof channel contract, submit evidence

3. After the settleTimeout time is exceeded ***（The code is set to 120 seconds, and the actual application here needs to be modified)***, The player and the dealer call the settle method in the channel contract to settle the channel (only one party's call is theoretically successful here)

   - Optimize to implement a function that automatically calls settle

4. When the blockchain is set to the channelplyevent, the player and the dealer call the channel's unlock method to unlock the channel and lock the balance
   - 直接调用有可能调用不成功，需要优化
   
5. Direct calls may not succeed and need to be optimized

#### 庄家强关

1. The declarer calls the closeChannel to close the channel

2. After listening to ChannelClose from the blockchain,

   - If the dealer has sent BetResponse and the bet is not completed, the dealer would like to submit the AcceptorSettle request to the game contract and request the arbitration of the game contract

   - Players call nonclosingUpdateBalanceProof channel contract, submit evidence

3. When the player listens to the acceptorplymessage from the blockchain, the initiatorReveal request is called to submit evidence to the game contract

4. After the settleTimeout time is exceeded ***（The code is set to 120 seconds. The actual application here needs to be modified）***, The player and the dealer call the settle method in the channel contract to settle the channel（Theoretically, only one of these calls will succeed) 

   - Optimize to implement a function that automatically calls settle

5. When the blockchain is set to the channelplyevent, the player and the dealer call the channel's unlock method to unlock the channel and lock the balance

   - Direct calls may not succeed and need to be optimized

6. Listen on the blockchain to ChannelLockedSent or ChannelLockedReturn event.
