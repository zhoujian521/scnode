/**
 * 随机数生成工具函数
 */
var crypto = require("crypto");

/**
 * 根据种子生成随机数
 * @param seed 随机数种子
 * @returns {String} 返回hex的随机数
 */
function generateRandomFromSeed2(web3, seed){
    let randomBuffer = crypto.randomBytes(32);
    return '0x' + randomBuffer.toString('hex');
}


/**
 * 根据种子生成随机数，使用web3库
 * @param web3 
 * @param seed 种子
 * @returns {String} 返回hex的随机数
 */
function generateRandomFromSeed1(web3, seed) {
    let ra = web3.utils.randomHex(32);
    return web3.utils.padLeft(ra, 64);
}


module.exports = {
    generateRandomFromSeed,
    generateRandomFromSeed2,
}


// let ra = generateRandomFromSeed("123");
// console.log(ra);