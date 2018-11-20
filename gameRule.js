/**
 * 游戏规则类
 * 1. 判断输赢
 * 2. 计算赌注和可赢的金额
 */
const BN = require('bn.js');

/**
 * 计算可以赢得的金额
 * @param betMask 下注内容
 * @param modulo 游戏类型 2硬币 6骰子 36两个骰子 100Ethroll
 * @param amount 下注金额
 * @returns {Integer} 可赢得金额
 */
function getPossibleWinAmount(betMask, modulo, amount){

    betMask = parseInt(betMask);
    modulo = parseInt(modulo);

    let rollUnder = calcRollUnder(betMask, modulo);

    const HOUSE_EDGE_PERCENT = 0;
    // const HOUSE_EDGE_MINIMUM_AMOUNT = 0.0003 * 1e18;

    let houseEdge = amount * HOUSE_EDGE_PERCENT / 100;

    // if (houseEdge < HOUSE_EDGE_MINIMUM_AMOUNT) {
    //     houseEdge = HOUSE_EDGE_MINIMUM_AMOUNT;
    // }

    let winAmount = Math.floor(((amount - houseEdge) * modulo) / rollUnder);
    return winAmount - amount;

}

/**
 * 判断输赢
 * @param web3 
 * @param betMask 下注内容
 * @param modulo 游戏类型 2硬币 6骰子 36两个骰子 100Ethroll
 * @param ra 玩家随机数
 * @param rb 庄家随机数
 * @param isPlayer 调用者是否为玩家
 * @returns {Boolean} 返回输赢结果
 */
function winOrLose(web3, betMask, modulo, ra, rb, isPlayer){

    let hash = web3.utils.soliditySha3(ra, rb);
    let dice = web3.utils.toBN(hash).umod(web3.utils.toBN(modulo)).toNumber();
    let betMaskNumber = parseInt(betMask);
    let playerWin = false;


    if(parseInt(modulo) < 40){
        if (((2 ** dice) & betMaskNumber) != 0) {
            playerWin = true;
        }
    }else{
        if(dice < betMaskNumber){
            playerWin = true;
        }
    }

    if(isPlayer)
        return playerWin;
    else
        return !playerWin;
}

/**
 * 计算modulo < 40时 betMask对应的胜率
 * @param betMask 
 * @param modulo 
 * @returns 返回具体的胜率
 */
function calcRollUnder(betMask, modulo){

    let POPCNT_MULT = new BN('0000000000002000000000100000000008000000000400000000020000000001', 16)
    let POPCNT_MASK = new BN('0001041041041041041041041041041041041041041041041041041041041041', 16)
    let POPCNT_MODULO = new BN('3F', 16);

    modulo = parseInt(modulo);
    betMask = new BN(parseInt(betMask).toString(16), 16);

    let rollUnder = 100;
    if (modulo < 40) {

        let rollUnderBN = betMask.mul(POPCNT_MULT).and(POPCNT_MASK).mod(POPCNT_MODULO);
        rollUnder = rollUnderBN.toNumber();

    } else {
        rollUnder = betMask.toNumber();
    }
    return rollUnder;

}









module.exports = { getPossibleWinAmount, winOrLose };