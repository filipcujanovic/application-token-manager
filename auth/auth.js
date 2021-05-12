const openBrowser = require('open');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const { createHttpTerminator } = require('http-terminator');

const authorize = async () =>  {
    const { client_secret, client_id, redirect_uris } = getCredentials(),
        oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        
    let token = null;

    try {
        token = getTokenFromFile(oAuth2Client);
    } catch (e) {
        console.log('Error while reading token from file. Trying to get new token');
        await obtainNewToken(oAuth2Client);
    }

    if (token === null) {
        token = getTokenFromFile(oAuth2Client);
    }

    oAuth2Client.setCredentials(token);

    return oAuth2Client;
}

const obtainNewToken = async (oAuth2Client) => {
    const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/spreadsheets']
        });

    let server = http.createServer((request, response) => {
        let parsedURL = url.parse(request.url);
        if (parsedURL.pathname === '/') {
            let { code } = querystring.parse(parsedURL.query);
            getNewToken(oAuth2Client, code);
            httpTerminator.terminate();
        }
        response.write('<h1>If your browser was open before running the script then please run the script again.</h1>');
        response.write('<h1>If this is the only instance of the browser with only one tab active, just close it. No need to run the script again.</h1>');
        response.end();

    });
    server.listen(8080);
    const httpTerminator = createHttpTerminator({server}); 
    await openBrowser(authUrl, {wait: true, app: {name: openBrowser.apps.chrome}}); // Add to open in incognito and test it
}

const getNewToken = (oAuth2Client, code) => {
    oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error while trying to retrieve access token', err);
        fs.writeFileSync(process.env.TOKEN_PATH, JSON.stringify(token));
    });
}

const getTokenFromFile = () => {
    let token = fs.readFileSync(process.env.TOKEN_PATH);
    return JSON.parse(token);
}

const getCredentials = () => {
    let result = fs.readFileSync(process.env.CREDENTIALS_PATH);
    return JSON.parse(result).web;
}

module.exports = {
    authorize,
};