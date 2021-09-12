const botSettings = require('../../settings.json');
const ErrorLogger = require('../../lib/logError')
var bot;
module.exports = {
    name: 'unlock',
    description: 'Unlocks voice channels',
    alias: ['ul'],
    args: '<channel>',
    requiredArgs: 1,
    role: 'eventrl',
    async execute(message, args, bott) {
        let settings = bott.settings[message.guild.id]
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            var channel = await message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.raidingprefix}${args[0]}`))
            var verifiedRaiderRole = await message.guild.roles.cache.get(settings.roles.raider);
        } else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            var channel = await message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.vetprefix}${args[0]}`))
            var verifiedRaiderRole = await message.guild.roles.cache.get(settings.roles.vetraider);
        } else if (message.channel.parent.name.toLowerCase() === 'events') {
            var channel = message.guild.channels.cache.find(c => c.type == 'GUILD_CATEGORY' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            var verifiedRaiderRole = await message.guild.roles.cache.get(settings.roles.raider);
        } else return message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands")
        bot = bott
        await this.unlock(message, channel, args[0], verifiedRaiderRole)
        if (channel)
            message.channel.send(`${channel.name} has been unlocked`)
    },
    async unlock(message, channel, channelNumber, raider) {
        let settings = bot.settings[message.guild.id]
        if (channel == null) return message.channel.send("Could not find channel correctly, please try again");
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            await channel.setName(`${settings.voiceprefixes.raidingprefix}${channelNumber} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function() { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function() { channel.permissionOverwrites.edit(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
        if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            await channel.setName(`${settings.voiceprefixes.vetprefix}${channelNumber} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function() { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function() { channel.permissionOverwrites.edit(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
        if (message.channel.parent.name.toLowerCase() === 'events') {
            let eventBoi = await message.guild.roles.cache.get(settings.roles.eventraider)
            let name = channel.name.substring(0, channel.name.indexOf(channelNumber) + 1)
            await channel.setName(`${name} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function() { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function() { channel.permissionOverwrites.edit(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
            setTimeout(function() { channel.permissionOverwrites.edit(eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
    }
};