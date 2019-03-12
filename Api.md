## State Channel Client API Document

version: 0.1.0

### Introduction

The State channel Client is a universal javascript library that can be invoked on the nodejs side or react-native side. Once successfully initialized, the client object can operate through the state channel for random number gambling game. The specific interface and return result of client can refer to the content below this document.

### Objects:

1. **channel object**
```
  {
    channelId: '',              // Channel id
    settleTimeout,              // Channel shutdown expiration time
    partner: '',                // other address
    totalDeposit: 100,          // self deposit amount
    localBalance: 40,           // self balance
    partnerTotalDeposit: 45,    // other deposit total amount
    remoteBalance: 45,          // other balance
    localLockedAmount: 5,       // self locked amount
    remoteLockedAmount: 10,     // other locked amount
    localNonce: 1               // local nonce
    remoteNonce: 1              // remote nonce
    state: 1,                   // Channel state 1 initialization 2 opening 3 compulsory closing 4 updated evidence 5 settlement 6 unlocking completed
    currentRound: 6,            // The current round of number
    closeType:  1               // Close type 1 strong level 2 negotiation level
    closedBySelf: 1             // Whether to be strong close to initiate to put
    localCloseBalanceHash: ''   // Submit balance evidence locally
    remoteCloseBalanceHash: ''  // Remote submission of balance evidence
    localSettleAmount: ''       // Local settlement amount when channel is closed
    remoteSettleAmount: ''      // Local settlement amount when channel is closed
    localLockedSentAmount: ''   // Lock the unlock amount locally
    remoteLockedSentAmount: ''  // Remote lock unlock amount
    localLockedReturnAmount: '' // Lock the refund amount locally
    remoteLockedReturnAmount: '' // Remotely lock the refund amount
    closeLockIdentifier: ''     // Force lock ID
    createdAt: ''               // Creation time
    updatedAt: ''               // Update time
  }
```

2. **bet object**
```
{
  betId: 1          // Bet ID
  betMask: "1"      // Bet Mask
  channelId: "0xf06be3caa544e2e43f460e3900bca841258bc07e18a95a850d8362c5f289694a"  // Channel ID
  createdAt: "2018-11-15 05:25:15.266 +00:00"                // Creation time
  gameContractAddress: "0xE44C8bA910A179A801267442224F9B7f3065E0ec"                // Game contract address
  hashRa: "0x16d709d355a5ff1d4cb4d767024dda5095016eb9ca9a62990fe30c21a47c0f8d"     // Player random number Hash
  modulo: 2         // Game type 2 coin 6 dice 36 2 dice 100 Ethroll player random number Hash
  negativeB: "0x633177eeE5dB5a2c504e0AE6044d20a9287909f9"   // Banker address
  positiveA: "0x56d77fcb5e4Fd52193805EbaDeF7a9D75325bdC0"   // Players address
  ra:  "4deaa6a5a382fbb1c74d1bfba6b487fc290974f0893e50179814923320e0b3132ef05b055381cedf576e9269281ef8d1b9e4b81b60066343c7484dca363da22a"                // Player random number
  rb: "397a6eba4f6c27a13a587a90ff60be2b4e336ffdc21ceaa247cbd996fba7a630931d5209e3d739023f68840539638703cf03e802992b493d641353b1570171e4"                 // Random Numbers
  round: 1              // Number of rounds
  signatureA:  
 "0x1dc6752fd4830331073cfc9763e4618ea4902871c1b6ccecc053cc27ab2d7a212615c1f1b72454cf05a7effde3273b25cf89d8996de72a8b2cbbcd01084137511b"                  // Player signed
  signatureB: "0x8309693e461efc38afd8b560664290cd687855ba5155876ff79e2db863599de77496fab91868dae47de4b303216a1dcef24ff15b15193354416bb0e2aefa9a501c"     // Banker signed
  status: 8                           //state 1 initialization 2 send lock 3 reply lock 4 start 5 show random number 6 send transfer 7 reply transfer 8 complete
  updatedAt: "2018-11-15 05:25:15.427 +00:00" //更新时间
  value: "100000000000000"           // Bet amount
  winAmount: "96000000000000"        // Win amount
  winner: "1"                        // Whether winner or not
```

3. **payment object**
```
{
  paymentId: ''       // transfer ID
  betId: '',          // game ID
  fromAddr: '',       // Turns out the address
  toAddr:'',          // To address
  value: '',          // pay amount
  createdAt: '',      // Creation time
  updatedAt: ''       // Update time
}
```

4. **SCClient**

```
```

### Methods:

1. **new SCClient** new SCClient

   - params:
      - web3: Web3 instance
      - dbhelper: Database operation helper functions
      - cryptohelper: Generate random number related auxiliary functions
      - address: Local address
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

2. **openChannel** Open a channel and deposit the money
    - params:
      - partnerAddress: The other party ether lane address
      - depositAmount: Amount of deposit
    - returns:
      - err
      - channel
    - example:
```
  scclient.openChannel(parterAddress, depositAmount)
          .then(console.log);
```

3. **deposit** To deposit a specified amount of money into a channel
    - params:
      - partnerAddress: The other party ether lane address
      - depositAmount: Amount of deposit
    - returns:
      - err
      - channel
    - example:
```
  scclient.deposit(parterAddress, depositAmount)
      .then(console.log);

```

4. **startBet** Start a game
    - params:
      - channelIdentifer: Channel ID
      - betMask: Bet data
      - modulo: Types of games
      - betValue: Bet amount
      - randomSeed: Local random number seeds
    - returns:
      - err
      - channel
    - example:
```
  scclient.startBet(channelIdentifier, partnerAddress, betMask, modulo, betValue, randomSeed)
        .then(console.log);
```

5. **closeChannel** Forced closing of channel
    - params:
      - partnerAddress: The other party ether lane address
    - returns:
      - err
      - result
    - example:
```
  scclient.closeChannel(partnerAddress).then(console.log);
```

6. **closeChannelCooperative**
    - params:
      - partnerAddress: The other party ether lane address
    - returns:
      - err
      - result
    - example:
```
  scclient.closeChannelCooperative(partnerAddress).then(console.log);
```

7. **getAllChannels** Get all channels
    - params:
      - condition: Query conditions
      - offset: Start query point
      - limit: Returns the number of queries
    - returns:
      - channels
    - example:

```
  scclient.getAllChannels({partner: '0x11111111111'}, 0, 10).then(console.log);
```

7. **getChannel** Gets the individual channel information
    - params:
      - partnerAddress: The other party ether lane address
    - returns:
      - channel
    - example:
```
  scclient.getChannel(partnerAddress);
```

8. **getAllBets** Get all bet information and results
    - params:
      - condition: Query conditions
      - offset
      - limit
    - returns:
      - bets
    - example:
```
  scclient.getAllBets({channelId: '0x13123123'}, offset, limit);
```

9. **getBetById** Get the bet by ID
    - params:
      - betId: bet ID
    - returns:
      - bet
    - example:
```
  scclient.getBetById(betId);
```

10. **getPayments** Get all transfer records
 - params:
      - condition: Query conditions
      - offset
      - limit
    - returns:
      - payments 
    - example:
```
  scclient.getPayments({betId: 1}, offset, limit);
```

### Events 

Events on the channel can be picked up by listening, and then the relevant business logic can be customized

1. **ChannelOpen**

Open channel

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