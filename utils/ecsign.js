//const Tx = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util');

//messageHash, privateKey are both buffer type
function myEcsign(web3, messageHash, privateKey) {

    let signatureHexString = myEcsignToHex(web3, messageHash, privateKey);
    let signatureBytes = web3.utils.hexToBytes(signatureHexString);
    return signatureBytes;
}

function myEcsignToHex(web3, messageHash, privateKey) {

    let privateKeyBuffer = new Buffer(privateKey, 'hex');
    let signatureObj = ethUtil.ecsign(messageHash, privateKeyBuffer);
    let signatureHexString = ethUtil.toRpcSig(signatureObj.v, signatureObj.r, signatureObj.s).toString('hex');
    return signatureHexString;
}

function mySha3(web3, contractAddress, channelIdentifier, p1, p1Balance, p2, p2Balance) {
    let message = web3.utils.soliditySha3(contractAddress, channelIdentifier, p1, p1Balance, p2, p2Balance);
    message = new Buffer(message.substr(2), 'hex');
    return message;
}

function checkSignature(messageHash, signatureHex, address) {

    logInfo('checkSignature', messageHash, signatureHex, address);

    let messageHashBuffer = new Buffer(messageHash.replace("0x", ""), "hex")
    let sigDecoded = ethUtil.fromRpcSig(signatureHex);
    let recoveredPub = ethUtil.ecrecover(messageHashBuffer, sigDecoded.v, sigDecoded.r, sigDecoded.s)
    let recoveredAddress = ethUtil.pubToAddress(recoveredPub).toString("hex")
    recoveredAddress = "0x" + recoveredAddress;

    logInfo('recoveredAddress', recoveredAddress);
    return recoveredAddress.toLowerCase() == address.toLowerCase();


}



module.exports = {
    mySha3,
    myEcsignToHex,
    myEcsign,
    checkSignature,
}