### 接口文档

参考[State channel client api document](https://gitlab.f3m.club/dice/dice2win_blockchain_sc/wikis/State-Channel-Client-API-Document) 进行使用

### State Channel Node 代码结构

1. index.js是SCClient的类定义

2. messageHandler.js 是处理P2P消息的处理类

3. blockEventHandler.js 是监听区块链上合约事件，并进行相应操作的处理类

4. blockChainQuery.js 是对区块链上数据和合约进行查询的查询类，不需要私钥

5. blockChainProxy.js 是向区块链提交交易，调用合约的操作类，需要私钥

6. Constants.js 常量类型定义，主要包括通道状态, 赌局状态等常量

7. gameRule.js 游戏规则类，主要包含赔率计算，输赢判定等逻辑，需要与区块链上游戏合约逻辑保持一致

8. Dice_SC.json是游戏合约用truffle编译完成之后的数据文件

9.  Payment_ETH.json是通道合约用truffle编译完成之后的数据文件

10. utils文件，相关工具类
    1.  ecsign.js 用私钥对消息进行签名的工具类

    2.  messageGenerator.js P2P消息生成器, 生成offchain协议所需的各种消息，并对消息进行签名

    3.  messageValidator.js 接收到对方的P2P消息后，验证对方的消息签名是否正确

    4.  proofGenerator.js 生成强关通道时，需要向合约提交的各类数据

### State Channel 消息协议

参考[State channel message flow picture](https://gitlab.f3m.club/dice/dice2win_blockchain_sc/wikis/State-Channel-message-flow-picture)来实现的消息收发协议，并做了一些修改


#### Bet消息收发顺序    
  1. A ----------BetRequest------------> B
  2. A <---------LockedTransfer--------- B
  3. A ----------LockedTransferR-------> B
  4. A <---------BetResponse------------ B
  5. A ----------Preimage--------------> B
  6. A <---------DirectTransfer--------- B
  7. A ----------DirectTransferR-------> B
  8. A <---------BetSettle-------------- B
 
  
#### CooperativeSettle消息收发顺序
  1. A ----CooperativeSettleRequest----> B
  2. B签名, 并将最终消息提交到区块链


### 强关通道时的处理逻辑

#### 玩家强关

1. 玩家调用closeChannel关闭通道
2. 从区块链监听到ChannelClose后，
   - 如果此时玩家已经收到了BetResponse消息并且赌局还未完成，玩家向游戏合约提交initiatorSettle请求，请求游戏合约仲裁
   - 庄家调用通道合约的nonclosingUpdateBalanceProof，提交证据
3. 超过settleTimeout时间后 **（代码中设定为120秒，此处实际应用需修改）**, 玩家和庄家会调用通道合约的settle方法，请求通道结算（此处理论上只会有一方的调用成功)
   - 可优化，实现一种能够自动调用settle的功能
4. 从区块链监听到ChannelSettled事件后，玩家和庄家调用通道的unlock方法，解锁通道锁定余额
   - 直接调用有可能调用不成功，需要优化
5. 从区块链监听到ChannelLockedSent或者ChannelLockedReturn事件，



#### 庄家强关

1. 庄家调用closeChannel关闭通道
2. 从区块链监听到ChannelClose后，
   - 如果此时庄家已经发出了BetResponse并且赌局还未完成, 庄家想游戏合约提交AcceptorSettle请求，请求游戏合约仲裁
   - 玩家调用通道合约的nonclosingUpdateBalanceProof, 提交证据
3. 玩家从区块链监听到AcceptorSettled消息后，调用initiatorReveal请求，向游戏合约提交证据
4. 超过settleTimeout时间后 **（代码中设定为120秒，此处实际应用需修改）**, 玩家和庄家会调用通道合约的settle方法，请求通道结算（此处理论上只会有一方的调用成功) 
   - 可优化，实现一种能够自动调用settle的功能
5. 从区块链监听到ChannelSettled事件后，玩家和庄家调用通道的unlock方法，解锁通道锁定余额
   - 直接调用有可能调用不成功，需要优化
6. 从区块链监听到ChannelLockedSent或者ChannelLockedReturn事件，
