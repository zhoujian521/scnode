var io = require("socket.io-client");
var SCClient = require("./index");

var socket = io("http://localhost");
// socket.on("news", function(data) {
//   console.log(data);
//   socket.emit("my other event", { my: "data" });
// });



//rinkeby geth server
let ethWSUrl = 'ws://18.179.206.91:8546';

let dbprovider = {
  type: 'node',
  config: {
    database: 'test',
    username: 'user',
    password: 'user',
    dialect: {
      host: 'localhost',
      dialect: 'sqlite',
      operatorsAliases: false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },

      // SQLite only
      storage: './client.sqlite'
    }
  }
};

let address = '';
let privateKey = '';

let scclient = new SCClient(ethWSUrl, dbprovider, address, privateKey);
scclient.initMessageHandler(socket);


async function main(){

  let channels = await scclient.getAllChannels();
  console.log(channels);

  let gameAddress = await scclient.blockchainProxy.getGameAddress();
  console.log(gameAddress);


  await scclient.blockchainProxy.testMonitorEvent();


}

main();



