const { HEADER_ROW, TOKEN_VALUE_COLUMN, TOKEN_KEY } = require('./consts');
const { google } = require('googleapis');
const { authorize } = require('../auth/auth');
const { columnToLetter } = require('./utils');


const getDataFromSpreadSheet = async (includeAdditionalInfo = false) => {
    const auth = await authorize(),
        sheetsAPI = google.sheets({version: 'v4', auth}),
        resultSpreadsheet = await sheetsAPI.spreadsheets.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            includeGridData: true
        });
    let tokenVariants = {},
        jsonSheetData = {},
        { sheets } = resultSpreadsheet.data,
        existingSheets = [];
    for (const sheet of sheets) {
        let { title } = sheet.properties;
        if (includeAdditionalInfo) {
            jsonSheetData[title] = {
                token_keys: {},
                token_variants: {},
            };
        }
        existingSheets[title] = {numberOfTokenVariants: 2};
        const sheetResult = await sheetsAPI.spreadsheets.values.get({
                spreadsheetId: process.env.SPREADSHEET_ID,
                range: title,
                majorDimension: 'ROWS',
                valueRenderOption: 'FORMATTED_VALUE'
            }),
            rows = sheetResult.data.values;
        if (typeof rows !==  'undefined') {
            let rowData,
                rowSize;
            rows.map((row, index) => {
                if (index === HEADER_ROW) {
                    rowSize = row.length;
                    row.map((rowValue, rowIndex) => {
                        // Looking only for token variants columns in order to create filenames
                        if (rowIndex >= TOKEN_VALUE_COLUMN) {
                            existingSheets[title].numberOfTokenVariants++;
                            let sheetTitle = title.split('.')[0];
                            tokenVariants[rowIndex] = `${sheetTitle}.${rowValue}.json`;
                            if (includeAdditionalInfo) {
                                jsonSheetData[title].token_variants[rowValue] = rowIndex + 1;
                            }
                        }
                    });
                } else {
                    if (row.length < rowSize) {
                        row = [...row, ...Array(rowSize).fill('')];
                    }
                    row.map((rowValue, rowIndex) => {
                        if (typeof tokenVariants[rowIndex] !== 'undefined') {
                            if (!jsonSheetData.hasOwnProperty(tokenVariants[rowIndex])) {
                                jsonSheetData[tokenVariants[rowIndex]] = {};
                            }
                            rowData = rowValue;
                            if (includeAdditionalInfo) {
                                rowData = {rowValue, cellInfo: `${columnToLetter(rowIndex + 1)}${index + 1}`};
                            }
                            jsonSheetData[tokenVariants[rowIndex]][row[TOKEN_KEY]] = rowData;
                        }
                    });
                    if (includeAdditionalInfo) {
                        jsonSheetData[title].token_keys[row[TOKEN_KEY]] = index + 1;
                    }
                }
                if (includeAdditionalInfo) {
                    jsonSheetData[title].lastRow = index + 1;
                    jsonSheetData[title].sheetId = sheet.properties.sheetId;
                }
            });
        }
    }

    return { jsonSheetData, existingSheets };
}

const addDataToSpreadSheet = async (jsonDataToPush, existingSheets) => {
    for (const [sheetName, data] of Object.entries(jsonDataToPush)) {
        if (!existingSheets.hasOwnProperty(sheetName)) {
            await createNewSheet(sheetName);
        }
        await updateSheetRanges(data.data);
        await updateHeaderRow(sheetName, data.headerRow);
    }
}

const updateHeaderRow = async (sheetName, headerRow) => {
    await updateSheetRanges([
        {
            majorDimension: 'ROWS',
            range: `${sheetName}!A1`,
            values: [
                headerRow
            ]
        }
    ]);
}

const updateSheetRanges = async (data) => {
    const auth = await authorize(),
        sheetsAPI = google.sheets({version: 'v4', auth});
    try {
        await sheetsAPI.spreadsheets.values.batchUpdate({
            spreadsheetId: process.env.SPREADSHEET_ID,
            resource: {
                valueInputOption: 'RAW',
                data
            }
        });
    } catch (err) {
        console.error(err);
    }
}

const clearSheetRanges = async (data) => {
    if (data.length !== 0) {
        const auth = await authorize(),
            sheetsAPI = google.sheets({version: 'v4', auth});
        try {
            await sheetsAPI.spreadsheets.values.batchClear({
                spreadsheetId: process.env.SPREADSHEET_ID,
                ranges: data
            });
        } catch (err) {
            console.error(err);
        }
    }
}

const runSpreadsheetBatchUpdate = async (data) => {
    if (data.length !== 0) {
        const auth = await authorize(),
            sheetsAPI = google.sheets({version: 'v4', auth});

        try {
            await sheetsAPI.spreadsheets.batchUpdate({
                spreadsheetId: process.env.SPREADSHEET_ID,
                resource: {
                    requests: data
                }
            });
        } catch (err) {
            console.error(err);
        }
    }
}

const createNewSheet = async (sheetName) => {
    const auth = await authorize(),
        sheetsAPI = google.sheets({version: 'v4', auth});

    try {
        // Creating new sheet in the current spreadsheet
        let response = await sheetsAPI.spreadsheets.batchUpdate({
            spreadsheetId: process.env.SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: sheetName,
                            }
                        }
                    },
                ]
            }
        });

        // Adding protected ranges for the sheet
        addProtectedRangeToSheet(response.data.replies[0].addSheet.properties.sheetId);
    } catch (err) {
        console.error(err);
    }
}

const addProtectedRangeToSheet = async (sheetId) => {
    const auth = await authorize(),
        sheetsAPI = google.sheets({version: 'v4', auth});
        
    try {
        await sheetsAPI.spreadsheets.batchUpdate({
            spreadsheetId: process.env.SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        addProtectedRange: {
                            protectedRange: {
                                range: {
                                    sheetId
                                },
                                unprotectedRanges: {
                                    sheetId,
                                    startRowIndex: 1,
                                    startColumnIndex: 2,
                                },
                                warningOnly: false,
                                requestingUserCanEdit: true,
                                editors: {
                                    users: [
                                        process.env.OAUTH_USER
                                    ]
                                }
                            }
                        }
                    }
                ]
            }
        });
    } catch (err) {
        console.error(err);
    }
}

const getSheetsInfo = async () => {
    const auth = await authorize(),
        sheetsAPI = google.sheets({version: 'v4', auth});

    resultSpreadsheet = await sheetsAPI.spreadsheets.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
    });
    return resultSpreadsheet.data.sheets;
}



module.exports = {
    getDataFromSpreadSheet,
    addDataToSpreadSheet,
    updateSheetRanges,
    clearSheetRanges,
    runSpreadsheetBatchUpdate,
    getSheetsInfo,
    addProtectedRangeToSheet,
}