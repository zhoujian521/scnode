var SCClient = require("./index");
var io = require("socket.io")(80);




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
      storage: './server.sqlite'
    }
  }
};

let address = '';
let privateKey = '';
let scclient = new SCClient(ethWSUrl, dbprovider, address, privateKey);


io.on("connection", function(socket) {
  scclient.initMessageHandler(socket);

  // socket.emit('betRequest', {hello: "world"});
});


async function main(){

  let channels = await scclient.getAllChannels();
  console.log(channels);

  let gameAddress = await scclient.blockchainProxy.getGameAddress();
  console.log(gameAddress);



}

main();