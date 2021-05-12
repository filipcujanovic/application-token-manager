const fs = require('fs');
const { 
    getDataFromSpreadSheet, 
    addDataToSpreadSheet, 
    updateSheetRanges, 
    clearSheetRanges, 
    runSpreadsheetBatchUpdate, 
    getSheetsInfo, 
    addProtectedRangeToSheet 
} = require('./spreadsheetService');
const { 
    VARIABLE_REGEX, 
    TOKEN_KEY_REGEX 
} = require('./consts');
const { columnToLetter } = require('./utils');

const pushDataToGoogleSheet = async (argv) => {
    const {jsonSheetData, existingSheets } = await getDataFromSpreadSheet(true),
        dirPath = argv['dir-path'];

    let jsonDataToPush = {
            tokenCleanupData: [],
            setCleanupData: Object.keys(jsonSheetData),
            replaceData: {},
            newTokenData: {
                apiData: [],
                dataForMaping: {}
            }
        };

    fs.readdir(dirPath, async (err, files) => {
        if (err) console.log(`There was an error while reading ${dirPath} directory. Please try again, or try a different directory.`);

        for (const file of files) {
            try {
                jsonDataToPush = getUpdatedData(argv, file , jsonDataToPush, existingSheets, jsonSheetData);
            } catch (err) {
                console.error('There was an error while pushing data', err);
            }
        }

        await mapDataAndUpdate(argv, jsonDataToPush, existingSheets, jsonSheetData);

    });
}

const prepareDataForMapping = (data, sheetName, existingSheets, file, jsonSheetData) => {
    let tokenVariantName = file.split('.')[1];
    if (!jsonSheetData.hasOwnProperty(file)) {
        existingSheets[sheetName].numberOfTokenVariants++;
    }
    if (!data.hasOwnProperty(sheetName)) {
        data[sheetName] = {
            headerRow: ['keys', 'vars'],
            data: {}
        };
    }

    data[sheetName].headerRow.push(tokenVariantName);

    return data;
}

const getUpdatedData = (argv, file, jsonDataToPush, existingSheets, jsonSheetData) => {
    let jsonFileData = JSON.parse(fs.readFileSync(`${argv['dir-path']}/${file}`)),
        sheetName = `${file.split('.')[0]}.json`;

    if (argv['replace-modified']) {
        jsonDataToPush.replaceData = prepareDataForMapping(jsonDataToPush.replaceData, sheetName, existingSheets, file, jsonSheetData);
        jsonDataToPush.replaceData = getModifyReplaceData(jsonDataToPush.replaceData, jsonSheetData, jsonFileData, file, sheetName);
    } 
    if (argv['cleanup-tokens']) {
        const data = getTokenCleanupData(jsonSheetData, jsonFileData, file, sheetName);
        jsonDataToPush.tokenCleanupData.push(...data);
    } 
    if (argv['cleanup-set']) {
        jsonDataToPush.setCleanupData = getSetCleanupData(file, jsonDataToPush.setCleanupData);
    }

    jsonDataToPush.newTokenData.dataForMaping = prepareDataForMapping(jsonDataToPush.newTokenData.dataForMaping, sheetName, existingSheets, file, jsonSheetData);
    jsonDataToPush.newTokenData = getNewTokensData(jsonDataToPush.newTokenData, jsonSheetData, jsonFileData, file, sheetName, existingSheets);

    return jsonDataToPush;
}

const getSetCleanupData = (file, setCleanupData) => {
    return setCleanupData.filter((value) => {
        return value !== file;
    }).filter((value) => {
        return value !== `${file.split('.')[0]}.json`;
    });
}

const getTokenCleanupData = (jsonSheetData, jsonFileData, file, sheetName) => {
    let data = [];
    if (jsonSheetData.hasOwnProperty(file)) {
        for (const [token, tokenValue] of Object.entries(jsonSheetData[file])) {
            if (!jsonFileData.hasOwnProperty(token)) {
                data.push(`${sheetName}!${tokenValue.cellInfo}`);
            }
        }
    }
    return data;
}

// Getting data for replace-modified flag
const getModifyReplaceData = (replaceData, jsonSheetData, jsonFileData, file, sheetName) => {
    for (const [token, tokenValue] of Object.entries(jsonFileData)) {
        if (jsonSheetData.hasOwnProperty(file)) {
            if (jsonSheetData[file].hasOwnProperty(token) && jsonSheetData[file][token].rowValue !== tokenValue) {
                if (!replaceData[sheetName].data.hasOwnProperty(token)) {
                    replaceData[sheetName].data[token] = {
                        values: [],
                        range: [],
                    };
                }
                replaceData[sheetName].data[token].values.push(tokenValue);

                if (replaceData[sheetName].data[token].range.length !== 1) {
                    replaceData[sheetName].data[token].range.pop();
                }
                replaceData[sheetName].data[token].range.push(jsonSheetData[file][token].cellInfo);
            }
        }
    }

    return replaceData;
}

// Get data for new tokens
const getNewTokensData = (newTokenData, jsonSheetData, jsonFileData, file, sheetName, existingSheets) => {
    let tokenVariantName = file.split('.')[1];
    for (const [token, tokenValue] of Object.entries(jsonFileData)) {
        if (((typeof jsonSheetData[file] !== 'undefined' && !jsonSheetData[file].hasOwnProperty(token)) || typeof jsonSheetData[file] === 'undefined') && token.match(TOKEN_KEY_REGEX) !== null) {
            // token variant doesn't exits
            if (!jsonSheetData.hasOwnProperty(file)) {
                //check if token exits 
                if (jsonSheetData[sheetName].token_keys.hasOwnProperty(token)) {
                    newTokenData.apiData.push({
                        majorDimension: 'ROWS',
                        range: `${sheetName}!${columnToLetter(existingSheets[sheetName].numberOfTokenVariants)}${jsonSheetData[sheetName].token_keys[token]}`,
                        values: [
                            [tokenValue]
                        ]
                    });
                } else {
                    if (!newTokenData.dataForMaping[sheetName].data.hasOwnProperty(token)) {
                        newTokenData.dataForMaping[sheetName].data[token] = [];
                    }
                    newTokenData.dataForMaping[sheetName].data[token].push({
                        variant: getMaxTokenVariantColumnIndex(jsonSheetData[sheetName].token_variants, 1),
                        value: tokenValue
                    });
                }
            } else {
                if (!newTokenData.dataForMaping[sheetName].data.hasOwnProperty(token)) {
                    newTokenData.dataForMaping[sheetName].data[token] = [];
                }
                newTokenData.dataForMaping[sheetName].data[token].push({
                    variant: jsonSheetData[sheetName].token_variants[tokenVariantName],
                    value: tokenValue
                });
            }

        }
    }


    return newTokenData;
}

const getMaxTokenVariantColumnIndex = (data, append) => {
    let max = 3;
    for (const [variant, columnIndex] of Object.entries(data)) {
        if (columnIndex > max) {
            max = columnIndex;
        }
    }
    
    return max + append;
}


const mapDataAndUpdate = async (argv, jsonDataToPush, existingSheets, jsonSheetData) => {
    if (argv['replace-modified']) {
        await mapModifyReplaceDataAndUpdate(jsonDataToPush.replaceData);
    } 
    if (argv['cleanup-tokens']) {
        await clearSheetRanges(jsonDataToPush.tokenCleanupData);
    }
    if (argv['cleanup-set']) {
        await clearSetData(jsonDataToPush.setCleanupData, jsonSheetData, existingSheets);
    }

    await updateNewTokens(jsonDataToPush.newTokenData, existingSheets, jsonSheetData);
    await checkAndUpdateProtectedRanges(jsonSheetData);
}

// Mapping data for replace-modified flag and updatingsheet
const mapModifyReplaceDataAndUpdate = async (replaceData) => {
    let data = [];
    for (const [sheetName, value] of Object.entries(replaceData)) {

        let valuesForUpdate = Object.keys(value.data).map((tokenKey) => {
            return {
                range: `${sheetName}!${value.data[tokenKey].range.join(':')}`,
                majorDimension: 'ROWS',
                values: [value.data[tokenKey].values]
            }
        });
        data.push(...valuesForUpdate);
    }
    await updateSheetRanges(data);
}

// Map new token data for the API
const updateNewTokens = async (newTokenData, existingSheets, jsonSheetData) => {
    let tokenCounter = 1;
    for (const [sheetName, value] of Object.entries(newTokenData.dataForMaping)) {
        let sheetValues = [],
            offset = 3;

        Object.keys(value.data).map((tokenKey) => {
            let variablesSet = new Set(),
                tokenValues = [];

            value.data[tokenKey].map((tokenObject, index) => {
                let matches = tokenObject.value.match(VARIABLE_REGEX);
                if (matches !== null) {
                    matches.map(match => {
                        variablesSet.add(match);
                    });
                }
                tokenValues.push([tokenKey, [...variablesSet].join(','), ...Array(tokenObject.variant - offset).fill(null), tokenObject.value]);
            });

            if (tokenValues.length !== 0) {
                tokeValues = tokenValues.map((value) => {
                    return {
                            majorDimension: 'ROWS',
                            range: `${sheetName}!A${jsonSheetData[sheetName].lastRow + tokenCounter}`,
                            values: [
                                value
                            ]
                        }
                });
                tokenCounter++;
                sheetValues.push(...tokeValues);
            }
        });

        if (value.headerRow.length > 0 && !existingSheets.hasOwnProperty(sheetName)) {
            newTokenData.dataForMaping[sheetName].data = [value.headerRow, ...sheetValues];
        } else {
            newTokenData.dataForMaping[sheetName].headerRow = value.headerRow;
            newTokenData.dataForMaping[sheetName].data = [...sheetValues];
        }
    }

    if (newTokenData.apiData.length > 0) {
        await updateSheetRanges(newTokenData.apiData);
    }

    await addDataToSpreadSheet(newTokenData.dataForMaping, existingSheets);
}

const clearSetData = async (setCleanupData, jsonSheetData, existingSheets) => {
    let dataForClearing = [],
        sheetsForDeleting = [],
        sheetNamesForDeleting = [],
        rangesForClearing = setCleanupData.map((setToCleanUp) => {
            dataForClearing.push(setToCleanUp);
            if (jsonSheetData.hasOwnProperty(setToCleanUp) && jsonSheetData[setToCleanUp].hasOwnProperty('sheetId')) {
                sheetsForDeleting.push({
                    deleteSheet: {
                        sheetId: jsonSheetData[setToCleanUp].sheetId
                    }
                });
                sheetNamesForDeleting.push(setToCleanUp);
            } else {
                let splitData = setToCleanUp.split('.'),
                    sheetName = `${splitData[0]}.json`,
                    variantName = splitData[1],
                    columnLetter = columnToLetter(jsonSheetData[sheetName].token_variants[variantName]);

                return {
                    sheetName,
                    range: `${sheetName}!${columnLetter}:${columnLetter}`
                }
            }
        }).filter(value => value !== undefined);

    if (Object.keys(existingSheets).length === sheetsForDeleting.length) {
        sheetsForDeleting = [];
    } else {
        rangesForClearing = rangesForClearing.filter(value => !sheetNamesForDeleting.includes(value.sheetName));
    }
    await clearSheetRanges(rangesForClearing.map(value => value.range));
    await runSpreadsheetBatchUpdate(sheetsForDeleting);
}

const checkAndUpdateProtectedRanges = async () => {
    let sheetsData = await getSheetsInfo();
    sheetsData.map((sheet) => {
        if (!sheet.hasOwnProperty('protectedRanges')) {
            addProtectedRangeToSheet(sheet.properties.sheetId);
        }
    });
}

const push = async (argv) => {
    await pushDataToGoogleSheet(argv);
}

module.exports = {
    push
}