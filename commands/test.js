const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');

module.exports = {
    name: 'test',
    description: 'Holds testing code. Do not issue command if you do not know what is in it',
    requiredArgs: 0,
    guildspecific: true,
    role: 'raider',
    async execute(message, args, bot, db,) {
        const member = message.member
        const guild = message.guild
        const vetaffiliateID = bot.settings[guild.id].roles.vetaffiliate
        const vetaffiliate = guild.roles.cache.get(vetaffiliateID)
        if (member.roles.highest.position == vetaffiliate.position && !member.displayName.startsWith('>')) {
            const baseName = member.displayName.replace(/^(\W+)/, '')
            const oldName = member.displayName
            await member.setNickname(`${'>'}${baseName}`, 'Automatic Nickname Change: User just got Veteran Affiliate Staff as their highest role')
        }
        if (member.roles.highest.position < vetaffiliate.position && member.displayName.startsWith('>')) {
            const baseName = member.displayName.replace(/^(\W+)/, '')
            const oldName = member.displayName
            await member.setNickname(`${baseName}`, 'Automatic Nickname Change: User just got Veteran Affiliate Staff as their highest role, but in reverse')
            console.log("sauron")
        }
    }
}
