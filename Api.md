## State Channel Client API Document

version: 0.1.0

#### Introduction

State channel Client 是一个通用的javascript library, 可以在nodejs端或者react-native端进行调用。一旦成功初始化后，可以通过client对象操作状态通道进行随机数博彩游戏。client的具体接口和返回结果可以参考本文档下方内容。


#### Objects:

1. **channel object**
```
  {
    channelId: '',       //通道标识
    settleTimeout,       //通道强关过期时间
    partner: '',          //对方地址
    totalDeposit: 100,            //己方充值金额
    localBalance: 40,            //己方余额
    partnerTotalDeposit: 45,           //对方充值总金额
    remoteBalance: 45,           //对方余额
    localLockedAmount: 5,         //己方锁定金额
    remoteLockedAmount: 10,       //对方锁定金额
    localNonce: 1                //本地nonce
    remoteNonce: 1               //远程nonce
    state: 1,              //通道状态  1 初始化 2 开通 3 强制关闭中 4 已更新证据 5 结算 6 解锁完成
    currentRound: 6,          //当前轮数
    closeType:  1            //关闭类型  1强关 2协商关
    closedBySelf: 1            //是否为强关发起放
    localCloseBalanceHash: ''      //本地提交余额证据
    remoteCloseBalanceHash: ''     //远程提交余额证据
    localSettleAmount: ''           //关通道时 本地结算金额
    remoteSettleAmount: ''         //关通道时 本地结算金额
    localLockedSentAmount: ''      //本地锁定解锁金额
    remoteLockedSentAmount: ''     //远程锁定解锁金额
    localLockedReturnAmount: ''    //本地锁定退回金额
    remoteLockedReturnAmount: ''   //远程锁定退回金额
    closeLockIdentifier: ''        //强关锁定ID
    createdAt: ''                  //创建时间
    updatedAt: ''                  //更新时间


  }

```

2. **bet object**
```
{
  betId: 1  //赌局ID
  betMask: "1"  //下注内容
  channelId: "0xf06be3caa544e2e43f460e3900bca841258bc07e18a95a850d8362c5f289694a" //通道ID
  createdAt: "2018-11-15 05:25:15.266 +00:00"  //创建时间
  gameContractAddress: "0xE44C8bA910A179A801267442224F9B7f3065E0ec"  //游戏合约地址
  hashRa: "0x16d709d355a5ff1d4cb4d767024dda5095016eb9ca9a62990fe30c21a47c0f8d"  //玩家随机数Hash
  modulo: 2   //游戏类型 2硬币 6骰子 36两个骰子 100 Ethroll
  negativeB: "0x633177eeE5dB5a2c504e0AE6044d20a9287909f9"   //庄家地址
  positiveA: "0x56d77fcb5e4Fd52193805EbaDeF7a9D75325bdC0"   //玩家地址
  ra:  "4deaa6a5a382fbb1c74d1bfba6b487fc290974f0893e50179814923320e0b3132ef05b055381cedf576e9269281ef8d1b9e4b81b60066343c7484dca363da22a"               //玩家随机数
  rb: "397a6eba4f6c27a13a587a90ff60be2b4e336ffdc21ceaa247cbd996fba7a630931d5209e3d739023f68840539638703cf03e802992b493d641353b1570171e4"              //庄家随机数
  round: 1                        //轮数
  signatureA:  
 "0x1dc6752fd4830331073cfc9763e4618ea4902871c1b6ccecc053cc27ab2d7a212615c1f1b72454cf05a7effde3273b25cf89d8996de72a8b2cbbcd01084137511b"         //玩家签名
  signatureB: "0x8309693e461efc38afd8b560664290cd687855ba5155876ff79e2db863599de77496fab91868dae47de4b303216a1dcef24ff15b15193354416bb0e2aefa9a501c"         //庄家签名
  status: 8       //状态  1初始化 2发送lock 3回复lock 4开始 5出示随机数 6发送transfer 7回复transfer 8完成
  updatedAt: "2018-11-15 05:25:15.427 +00:00"
  value: "100000000000000"   //下注金额
  winAmount: "96000000000000"  //赢取金额
  winner: "1"              //自己是否是赢家
```

3. **payment object**
```
{
  paymentId: ''       //转账ID
  betId: '',          //游戏ID
  fromAddr: '',       //转出地址
  toAddr:'',          //转入地址
  value: '',          //金额
  createdAt: '',      //创建时间
  updatedAt: ''       //更新时间
}
```

4. **SCClient**
```
```


#### Methods:

1. **new SCClient** 创建一个新的SCClient

   - params:
      - web3: web3实例
      - dbhelper: 数据库操作辅助函数
      - cryptohelper: 生成随机数有关的辅助函数
      - address: 本地地址
   - returns:
      - scclient
   - example:
  ```
  let socket = io("http://localhost");
  let address = '0xa96e4b69821583b0e5F46Ff5460df2c201827557';
  let privateKey = 'FD218FC6EE4638C898918A545F9D3E20A621AC89BB4F1E448D434DF07930DF55';

  let dbhelper = await dbfactory.initDBHelper(dbprovider);
  let cryptohelper = require('../../crypto/cryptoHelper');
  let wsweb3 = new Web3(Web3.givenProvider || ethWSUrl);  
  console.log("db init finished");
  let scclient = new SCClient(wsweb3, dbhelper, cryptohelper, address);

  scclient.unlockWallet(privateKey);
  scclient.initMessageHandler(socket);

  ```

2. **openChannel** 开通一个通道，并存入相应的钱
    - params:
      - partnerAddress: 对方以太坊地址
      - depositAmount: 存款金额
    - returns:
      - err
      - channel
    - example:
```
  scclient.openChannel(parterAddress, depositAmount)
          .then(console.log);
```

3. **deposit** 向通道中存入指定金额的钱
    - params:
      - partnerAddress: 对方以太坊地址
      - depositAmount: 存款金额
    - returns:
      - err
      - channel
    - example:
```
  scclient.deposit(parterAddress, depositAmount)
          .then(console.log);

```

4. **startBet** 开始玩一局
    - params:
      - channelIdentifer: 通道ID
      - betMask: 下注数据
      - modulo: 游戏种类
      - betValue: 下注金额
      - randomSeed: 本方随机数种子
    - returns:
      - err
      - channel
    - example:
```
  scclient.startBet(channelIdentifier, partnerAddress, betMask, modulo, betValue, randomSeed)
        .then(console.log);
```

5. **closeChannel** 强制关闭通道
    - params:
      - partnerAddress: 对方以太坊地址
    - returns:
      - err
      - result
    - example:
```
  scclient.closeChannel(partnerAddress).then(console.log);
```

6. **closeChannelCooperative**
    - params:
      - partnerAddress: 对方以太坊地址
    - returns:
      - err
      - result
    - example:
```
  scclient.closeChannelCooperative(partnerAddress).then(console.log);
```


7. **getAllChannels** 获取所有通道
    - params:
      - condition: 查询条件
      - offset: 起始查询点
      - limit: 返回查询条数
    - returns:
      - channels
    - example:

```
  scclient.getAllChannels({partner: '0x11111111111'}, 0, 10).then(console.log);
```

7. **getChannel** 获取单个通道信息
    - params:
      - partnerAddress: 对方以太坊地址
    - returns:
      - channel
    - example:
```
  scclient.getChannel(partnerAddress);
```

8. **getAllBets** 获取所有下注信息和结果
    - params:
      - condition: 查询条件
      - offset
      - limit
    - returns:
      - bets
    - example:
```
  scclient.getAllBets({channelId: '0x13123123'}, offset, limit);
```

9. **getBetById** 根据ID获取下注
    - params:
      - betId: 下注ID
    - returns:
      - bet
    - example:
```
  scclient.getBetById(betId);
```
10. **getPayments** 获取所有转账记录
 - params:
      - condition: 查询条件
      - offset
      - limit
    - returns:
      - payments 
    - example:
```
  scclient.getPayments({betId: 1}, offset, limit);
```

#### Events 

通道上的事件可以通过监听的方式获取，之后可以自定相关的业务逻辑

1. **ChannelOpen**

通道开启

```
  scclient.on('ChannelOpen', function(channel){
    console.log(channel);
  });
```

2. **BetPlaced**



```
  scclient.on('BetPlaced', function(channel, bet){
    console.log(channel, bet);
  });
```

3. **BetSettled**
   
```
  scclient.on('BetSettled', function(channel, bet){
    console.log(channel, bet);
  });
```
4. **PaymentReceived**
   
```
  scclient.on('PaymentReceived', function(channel, payment){
    console.log(channel, payment);
  });
```
5. **ChannelClosed**
   
```
  scclient.on('ChannelClosed', function(channel){
    console.log(channel);
  });
```

6. **BalanceProofUpdated**
   
```
  scclient.on('BalanceProofUpdated', function(channel){
    console.log(channel);
  });
```
7. **BetUnlocked**
   
```
  scclient.on('BetUnlocked', function(channel, bet){
    console.log(channel, bet);
  });
```

8. **CooperativeSettled**
```
  scclient.on('CooperativeSettled', function(channel){
    console.log(channel);
  });
```

9. **ChannelDeposit**
```
  scclient.on('ChannelDeposit', function(channel){
    console.log(channel);
  });
```