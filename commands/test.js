const request = require('request');
const cheerio = require('cheerio');
const realmEyeScrape = require('../realmEyeScrape');
const options = {
    url: 'https://www.realmeye.com/player/ThomasC',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36'
    }
}
module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'Developer',
    execute(message, args, bot, db) {
        realmEyeScrape.getUserInfo('vi')
    }
}