const fs = require('fs');
const { getDataFromSpreadSheet } = require('./spreadsheetService');

const pullDataFromGoogleSheet = async (argv) => {
    const dirPath = argv['dir-path'];
    try {
        const { jsonSheetData } = await getDataFromSpreadSheet();
        for (const [file, value] of Object.entries(jsonSheetData)) {
            let dataToWrite;
            try {
                fs.statSync(`${dirPath}/${file}`);
                let fileData = JSON.parse(fs.readFileSync(`${dirPath}/${file}`));
                for (const [tokenKey, tokenValue] of Object.entries(value)) {
                    if (fileData.hasOwnProperty(tokenKey) && tokenValue !== fileData[tokenKey]) {
                        fileData[tokenKey] = value[tokenKey];
                    } else if (!fileData.hasOwnProperty(tokenKey)) {
                        fileData[tokenKey] = tokenValue;
                    }
                }
                dataToWrite = fileData;
            } catch (err) {
                dataToWrite = value;
            }
            fs.writeFileSync(`${dirPath}/${file}`, JSON.stringify(dataToWrite));
        }
    } catch (err) {
        console.error('An error has occured')
    }
}

const pull = async (argv) => {
    await pullDataFromGoogleSheet(argv);
}

module.exports = {
    pull
}