const express = require('express');
const botSettings = require('../settings.json')
const fetch = require('node-fetch')
const btoa = require('btoa');
const { catchAsync } = require('../lib/utils')

const router = express.Router();

const CLIENT_ID = botSettings.botId;
const CLIENT_SECRET = botSettings.botSecret;
const redirectURL = 'http://localhost:3000/o/discord/callback'
const redirect = encodeURIComponent(redirectURL);
const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)

router.get('/login', (req, res) => {
    res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirect}&response_type=code&scope=identify`)
});

router.get('/callback', catchAsync(async (req, res) => {
    if (!req.query.code) throw new Error('NoCodeProvided');
    const code = req.query.code;
    const data = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectURL,
        code: code,
        scope: 'identify',
    };

    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams(data),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    })
    const json = await response.json();
    res
        .cookie('accessToken', json.access_token, { expire: json.expires_in + Date.now() })
        .cookie('tokenType', json.token_type, { expire: json.expires_in + Date.now() })
        .redirect(`/`)
}));

module.exports = router;