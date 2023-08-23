const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const cron = require('cron');
const moment = require('moment')

module.exports = {
    name: 'test',
    description: 'Holds testing code. Do not issue command if you do not know what is in it',
    requiredArgs: 0,
    guildspecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        let members = await message.guild.members.fetch()
        let memberDefault = await message.guild.members.cache
        await message.reply(`${members.size}`)
        await message.reply(`${memberDefault.size}`)
    }
}