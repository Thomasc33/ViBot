const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError')
var bot;
module.exports = {
    name: 'lock',
    description: 'Locks voice channel',
    alias: ['rc', 'resetchannel'],
    args: '<channel>',
    requiredArgs: 1,
    role: 'eventrl',
    async execute(message, args, bott) {
        if (args.length == 0) return;
        let settings = bott.settings[message.guild.id]
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            var channel = await message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.raidingprefix}${args[0]}`))
            var verifiedRaiderRole = await message.guild.roles.cache.get(settings.roles.raider);
        } else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            var channel = await message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.vetprefix}${args[0]}`))
            var verifiedRaiderRole = await message.guild.roles.cache.get(settings.roles.vetraider);
        } else if (message.channel.parent.name.toLowerCase() === 'events') {
            var channel = message.guild.channels.cache.find(c => c.type == 'category' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            var verifiedRaiderRole = await message.guild.roles.cache.get(settings.roles.raider);
        } else return message.channel.send("Try again, but in a proper category")
        bot = bott
        if (!channel) return message.channel.send(`Channel ${args[0]} was not found`)
        if (!verifiedRaiderRole) return message.channel.send('Raider role was not found')
        await this.lock(message, channel, args[0], verifiedRaiderRole)
        message.channel.send(`${channel.name} has been locked`)
    },
    async lock(message, channel, channelNumber, raider) {
        let settings = bot.settings[message.guild.id]
        if (channel == null) return message.channel.send("Could not find channel correctly, please try again");
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            await channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setName(`${settings.voiceprefixes.raidingprefix}${channelNumber}`).catch(r => ErrorLogger.log(r, bot)) }, 1000)
        }
        if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            await channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setName(`${settings.voiceprefixes.vetprefix}${channelNumber}`).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
        if (message.channel.parent.name.toLowerCase() === 'events') {
            let eventBoi = await message.guild.roles.cache.get(settings.roles.eventraider)
            let name = channel.name.substring(0, channel.name.indexOf(channelNumber) + 1)
            await channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
            await channel.updateOverwrite(eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
            setTimeout(function () { channel.setName(`${name}`).catch(er => ErrorLogger.log(er, bot)) }, 1000)
        }
    }
}