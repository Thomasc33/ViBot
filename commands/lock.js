const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')
var bot;
module.exports = {
    name: 'lock',
    description: 'Locks voice channel',
    alias: 'rc, resetchannel',
    args: '<channel>',
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
        await this.lock(message, channel, args[0], verifiedRaiderRole)

        message.channel.send(`${channel.name} has been locked`)
    },
    async lock(message, channel, channelNumber, raider) {
        if (channel == null) {
            message.channel.send("Could not find channel correctly, please try again");
            return;
        }
        if (message.channel.name === 'dylanbot-commands') {
            await channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            setTimeout(function () { await channel.setName(`raiding-${channelNumber}`).catch(r => ErrorLogger.log(er, bot)) }, 1000)
        }
        if (message.channel.name === 'veteran-bot-commands') {
            await channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { await channel.setName(`Veteran Raiding ${channelNumber}`).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
        if (message.channel.name === 'eventbot-commands') {
            let name = channel.name.substring(0, channel.name.indexOf(channelNumber) + 1)
            channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { await channel.setName(`${name}`).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
    }
}