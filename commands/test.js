const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');

module.exports = {
    name: 'test',
    description: 'Holds testing code',
    args: [],
    requiredArgs: 0,
    getNotes(guildId, member) {
        return ''
    },
    guildSpecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        
    }
}
