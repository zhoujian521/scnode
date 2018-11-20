/**
 * 随机数生成工具函数
 */
var crypto = require("crypto");

/**
 * 根据种子生成随机数
 * @param seed 随机数种子
 * @returns {String} 返回hex的随机数
 */
function generateRandomFromSeed(seed){
    let randomBuffer = crypto.randomBytes(64);
    return randomBuffer.toString('hex');
}


/**
 * 根据种子生成随机数，使用web3库
 * @param web3 
 * @param seed 种子
 * @returns {String} 返回hex的随机数
 */
function generateRandomFromSeed2(web3, seed) {
    return web3.utils.randomHex(32);
}


module.exports = {
    generateRandomFromSeed,
    generateRandomFromSeed2,
}