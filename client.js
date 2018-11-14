var io = require("socket.io-client");
var SCClient = require("./index");

var socket = io("http://localhost");
// socket.on("news", function(data) {
//   console.log(data);
//   socket.emit("my other event", { my: "data" });
// });



//rinkeby geth server
let ethWSUrl = 'ws://54.250.21.165:8546';

let dbprovider = {
  type: 'node',
  config: {
    database: 'sc_client',
    username: 'root',
    password: 'abc321456',
    dialect: {
      host: 'localhost',
      dialect: 'mysql',
      operatorsAliases: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },

      // SQLite only
      // storage: './client.sqlite'
    }
  }
};

let address = '0x56d77fcb5e4Fd52193805EbaDeF7a9D75325bdC0';
let privateKey = '118538D2E2B08396D49AB77565F3038510B033A74C7D920C1C9C7E457276A3FB';

let scclient = new SCClient(ethWSUrl, dbprovider, address, privateKey);
// scclient.setAutoRespond(false);


async function main(){

  await scclient.init();
  scclient.initMessageHandler(socket);

  // // await scclient.dbhelper.addChannel({ channelId: "13", partner: "01" });
  // let channels = await scclient.dbhelper.getChannel("13");
  // console.log('CHANNEL IS', channels);
  // return;

  // let gameAddress = await scclient.blockchainProxy.getGameAddress();
  // console.log(gameAddress);

  let partnerAddress = '0x633177eeE5dB5a2c504e0AE6044d20a9287909f9';
  let depositAmount = 0.1 * 1e18;
  // return;

  // await scclient.deposit(partnerAddress, depositAmount);

  // await scclient.blockchainProxy.testMonitorEvent();

  // scclient.on('ChannelOpen', async (channel)=>{
    // await scclient.closeChannelCooperative(partnerAddress);
  // });

  // await test01();

  let channelIdentifier = await scclient.blockchainProxy.getChannelIdentifier(partnerAddress);
  let params = process.argv.splice(2);
  console.log(params);
  
  if(params.length < 1){
    return;
  }


  if(params[0] == 'openchannel'){
    await scclient.openChannel(partnerAddress, depositAmount); 
  }else if(params[0] == 'startbet'){
   console.time('ProcessBet');
   let count = 1;
   scclient.on('BetSettled', async (channel, bet) => {
     console.log("BetSettle logged");

     if(count ++ < 100){
       scclient.startBet(channelIdentifier, partnerAddress, 1, 2, 1e14, 'abc');
     }else{
       console.timeEnd('ProcessBet');
       process.exit();
     }
   });

   scclient.on('BetPlaced', async(channel, bet) => {
     console.log("===========BetPlaced");
   });

   scclient.on('PaymentReceived', async(channel, bet) => {
     console.log("===========PaymentReceived");
   });

   scclient.startBet(channelIdentifier, partnerAddress, 1, 2, 1e14, 'abc');

  }else if(params[0] == 'closechannel'){
    await scclient.closeChannelCooperative(partnerAddress);
  }
}

main();

async function test01(){
  let channels = await scclient.getAllChannels();
  console.log(channels);
  let bets = await scclient.getAllBets();
  console.log(bets);
}


