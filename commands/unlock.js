const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')
var bot;
module.exports = {
    name: 'unlock',
    description: 'Unlocks voice channels',
    alias: ['ul'],
    args: '<channel>',
    role: 'Event Organizer',
    async execute(message, args, bott) {
        let settings = bott.settings[message.guild.id]
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            var channel = await message.guild.channels.cache.find(c => c.name == `${settings.raidprefix}${args[0]}` || c.name == `${settings.raidprefix}${args[0]} <-- Join!`);
            var verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === settings.raider);
        } else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            var channel = await message.guild.channels.cache.find(c => c.name == `${settings.vetprefix}${args[0]}` || c.name == `${settings.vetprefix}${args[0]} <-- Join!`);
            var verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === settings.vetraider);
        } else if (message.channel.parent.name.toLowerCase() === 'events') {
            var channel = message.guild.channels.cache.find(c => c.type == 'category' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            var verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === settings.raider);
        } else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        bot = bott
        await this.unlock(message, channel, args[0], verifiedRaiderRole)

        message.channel.send(`${channel.name} has been unlocked`)
    },
    async unlock(message, channel, channelNumber, raider) {
        let settings = bot.settings[message.guild.id]
        if (channel == null) return message.channel.send("Could not find channel correctly, please try again");
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            await channel.setName(`${settings.raidprefix}${channelNumber} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function () { channel.updateOverwrite(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
        if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            await channel.setName(`${settings.vetprefix}${channelNumber} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function () { channel.updateOverwrite(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
        if (message.channel.parent.name.toLowerCase() === 'events') {
            let eventBoi = await message.guild.roles.cache.find(r => r.name === settings.events)
            let name = channel.name.substring(0, channel.name.indexOf(channelNumber) + 1)
            await channel.setName(`${name} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function () { channel.updateOverwrite(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
            setTimeout(function () { channel.updateOverwrite(eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
    }
};