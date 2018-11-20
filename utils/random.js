var crypto = require("crypto");

function generateRandomFromSeed(seed){
    let randomBuffer = crypto.randomBytes(64);
    return randomBuffer.toString('hex');
}


function generateRandomFromSeed2(web3, seed) {
    return web3.utils.randomHex(32);
}


module.exports = {
    generateRandomFromSeed,
    generateRandomFromSeed2,
}