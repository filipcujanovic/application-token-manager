const { RegExp } = require("globalthis/implementation");

const HEADER_ROW = 0;
const TOKEN_VALUE_COLUMN = 2;
const TOKEN_KEY = 0;
const VARIABLE_REGEX = new RegExp(/(?<={)\w+/g);
const TOKEN_KEY_REGEX = new RegExp(/^[a-zA-Z_.]+$/g);

module.exports = {
    HEADER_ROW,
    TOKEN_VALUE_COLUMN,
    TOKEN_KEY,
    VARIABLE_REGEX,
    TOKEN_KEY_REGEX,
}
