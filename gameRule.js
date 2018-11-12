function getPossibleWinAmount(betMask, modulo, value){

    return value;
}

function winOrLose(betMask, modulo, ra, rb, isPlayer){

    if(isPlayer)
        return true;
    else
        return false;
}

module.exports = { getPossibleWinAmount, winOrLose };