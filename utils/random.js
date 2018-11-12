var crypto = require("crypto");

function generateRandomFromSeed(seed){
    let randomBuffer = crypto.randomBytes(64);
    return randomBuffer.toString('hex');
}


module.exports = {
    generateRandomFromSeed,
}