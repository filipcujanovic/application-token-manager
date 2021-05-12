# application-token-manager

- To use the push/pull scripts first you will have to create your `.env`. The structure of the file can be found in `.env.example`. 
- Create you spreadsheet and populate it with data. After that grab the spreadsheet ID from the URL(https://docs.google.com/spreadsheets/d/{spreadsheetId}/edit#gid={sheetI}
- `TOKEN_PATH` and `CREDENTIALS_PATH` should be directories located in the repo. `TOKEN_PATH` is directory for storing the `access_token` and `refresh_token`. `CREDENTIALS_PATH` is directory where oAuth credentials for Google should be located.
