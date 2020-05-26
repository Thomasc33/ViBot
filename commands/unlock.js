const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')
var bot;
module.exports = {
    name: 'unlock',
    description: 'Unlocks voice channels',
    alias: 'ul',
    args: '<channel number>',
    role: 'Event Organizer',
    async execute(message, args, bott) {
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.name === 'dylanbot-commands') {
            var channel = await message.guild.channels.cache.find(c => c.name == `raiding-${args[0]}` || c.name == `raiding-${args[0]} <-- Join!`);
            var verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === 'Verified Raider');
        } else if (message.channel.name === 'veteran-bot-commands') {
            var channel = await message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${args[0]}` || c.name == `Veteran Raiding ${args[0]} <-- Join!`);
            var verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        } else if (message.channel.name === 'eventbot-commands') {
            var channel = message.guild.channels.cache.find(c => c.type == 'category' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            var verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === 'Verified Raider');
        } else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        bot = bott
        await this.unlock(message, channel, args[0], verifiedRaiderRole)

        message.channel.send(`${channel.name} has been unlocked`)
    },
    async unlock(message, channel, channelNumber, raider) {
        if (channel == null) {
            message.channel.send("Could not find channel correctly, please try again");
            return;
        }
        if (message.channel.name === 'dylanbot-commands') {
            await channel.setName(`raiding-${channelNumber} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function () { channel.updateOverwrite(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 500)
        }
        if (message.channel.name === 'veteran-bot-commands') {
            await channel.setName(`Veteran Raiding ${channelNumber} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function () { channel.updateOverwrite(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 500)
        }
        if (message.channel.name === 'eventbot-commands') {
            let name = channel.name.substring(0, channel.name.indexOf(channelNumber) + 1)
            await channel.setName(`${name} <-- Join!`).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setUserLimit(75).catch(er => ErrorLogger.log(er, bot)) }, 500)
            setTimeout(function () { channel.updateOverwrite(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) }, 500)
        }
    }
};