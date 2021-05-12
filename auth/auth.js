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
            scope: process.env.SCOPES.split(' '),
        });

    let server = http.createServer((request, response) => {
        let parsedURL = url.parse(request.url);
        if (parsedURL.pathname === '/') {
            let { code } = querystring.parse(parsedURL.query);
            getNewToken(oAuth2Client, code);
            httpTerminator.terminate();
        }
        response.write('Please close this window in order for the script to continue it\'s work.');
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
    // let token = fs.readFileSync(process.env.TOKEN_PATH);
    let token = fs.readFileSync('secrets/token.json');
    return JSON.parse(token);
}

const getCredentials = () => {
    // let result = fs.readFileSync(process.env.CREDENTIALS_PATH);
    let result = fs.readFileSync('secrets/credentials.json');
    return JSON.parse(result).web;
}

module.exports = {
    authorize,
};