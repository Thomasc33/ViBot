const Discord = require('discord.js')
const realmeyescrape = require('../realmEyeScrape')
module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'Developer',
    async execute(message, args, bot, db) {
        nick = args[0]
        console.log(nick.charAt(0).toUpperCase() + nick.substring(1, nick.length))
    }
}