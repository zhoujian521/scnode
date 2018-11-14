const BN = require('bn.js');

function getPossibleWinAmount(betMask, modulo, amount){

    betMask = parseInt(betMask);
    modulo = parseInt(modulo);

    let rollUnder = calcRollUnder(betMask, modulo);

    const HOUSE_EDGE_PERCENT = 2;
    // const HOUSE_EDGE_MINIMUM_AMOUNT = 0.0003 * 1e18;

    let houseEdge = amount * HOUSE_EDGE_PERCENT / 100;

    // if (houseEdge < HOUSE_EDGE_MINIMUM_AMOUNT) {
    //     houseEdge = HOUSE_EDGE_MINIMUM_AMOUNT;
    // }

    let winAmount = Math.floor(((amount - houseEdge) * modulo) / rollUnder);
    return winAmount - amount;

}

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