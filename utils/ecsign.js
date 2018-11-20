/**
 * 签名相关的工具函数
 */
//const Tx = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util');


/**
 * 用私钥签署消息
 * @param web3 
 * @param messageHash 消息Hash
 * @param privateKey 私钥
 * @returns {Bytes} 返回bytes格式的签名结果
 */
function myEcsign(web3, messageHash, privateKey) {

    let signatureHexString = myEcsignToHex(web3, messageHash, privateKey);
    let signatureBytes = web3.utils.hexToBytes(signatureHexString);
    return signatureBytes;
}

/**
 * 用私钥签署消息
 * @param web3 
 * @param messageHash 消息Hash
 * @param privateKey 私钥
 * @returns {String} 返回hex格式的签名结果
 */
function myEcsignToHex(web3, messageHash, privateKey) {

    let privateKeyBuffer = new Buffer(privateKey, 'hex');
    let signatureObj = ethUtil.ecsign(messageHash, privateKeyBuffer);
    let signatureHexString = ethUtil.toRpcSig(signatureObj.v, signatureObj.r, signatureObj.s).toString('hex');
    return signatureHexString;
}

/**
 * 返回CooperativeSettleRequest消息所需的Hash
 * @param web3 
 * @param contractAddress Payment合约地址 
 * @param channelIdentifier 通道ID
 * @param p1 通道一方地址
 * @param p1Balance 通道一方金额 
 * @param p2 通道另一方地址
 * @param p2Balance 通道另一方金额
 * @returns {String} 返回Hash
 */
function mySha3(web3, contractAddress, channelIdentifier, p1, p1Balance, p2, p2Balance) {
    let message = web3.utils.soliditySha3(contractAddress, channelIdentifier, p1, p1Balance, p2, p2Balance);
    message = new Buffer(message.substr(2), 'hex');
    return message;
}

/**
 * 检测签名地址与签名是否匹配
 * @param messageHash 消息Hash
 * @param signatureHex 消息签名
 * @param address 消息签名地址
 * @returns {Boolean} 返回验证结果
 */
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