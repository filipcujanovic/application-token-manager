const columnToLetter = (column) => {
    let temp,
        letter = '',
        col = column;
    while (col > 0) {
        temp = (col - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        col = (col - temp - 1) / 26;
    }
    return letter;
}

module.exports = {
    columnToLetter
}