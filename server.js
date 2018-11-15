var SCClient = require("./index");
var io = require("socket.io")(80);
const dbfactory = require("./db/dbfactory");




//rinkeby geth server
let ethWSUrl = 'ws://54.250.21.165:8546';
let dbprovider = {
  type: 'node',
  config: {
    database: 'sc_server',
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
      // storage: './server.sqlite'
    }
  }
};

let address = '0x633177eeE5dB5a2c504e0AE6044d20a9287909f9';
let privateKey = '4E9866ADC11E202E6B47CC087B3776B1F460CECD53086007538FB2D207FE54A6';

async function main(){

  console.log('dbfactory is in init');
  let dbhelper = await dbfactory.initDBHelper(dbprovider);
  console.log("db init finished");
  let scclient = new SCClient(ethWSUrl, dbhelper, address, privateKey);
  await scclient.init();

  io.on("connection", function(socket) {
    scclient.initMessageHandler(socket);
  });


  let channels = await scclient.getAllChannels();
  console.log(channels);

  let gameAddress = await scclient.blockchainProxy.getGameAddress();
  console.log(gameAddress);

  let partnerAddress = '0x56d77fcb5e4Fd52193805EbaDeF7a9D75325bdC0';
  let depositAmount = 0.1 * 1e18;

  scclient.on('ChannelOpen', async (channel)=>{
    console.log('ChannelOpen watched');

    if(channel.partner == address) return;
    await scclient.deposit(partnerAddress, depositAmount);

  });



  // await scclient.openChannel(partnerAddress, depositAmount);

  // 



}

main();