const Discord = require('discord.js')
const realmeyescrape = require('../realmEyeScrape')
module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'Developer',
    async execute(message, args, bot, db) {
        console.log(parseInt('UT'))
    }
}