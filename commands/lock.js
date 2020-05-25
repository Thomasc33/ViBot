const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')
var bot;
module.exports = {
    name: 'lock',
    description: 'Locks voice channel',
    alias: 'rc, resetchannel',
    args: '<channel>',
    role: 'Almost Raid Leader',
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
        /*let overwrites = channel.permissionOverwrites.array()
        var newPerms = []
        for (let i in overwrites) {
            let p = overwrites[i];
            if (p.id == raider.id) {
                newPerms.push({
                    role: raider.id,
                    type: p.type,
                    allow: ['VIEW_CHANNEL'],
                    deny: ['CONNECT']
                })
            } else {
                newPerms.push({
                    role: p.id,
                    type: p.type,
                    allow: p.allow,
                    deny: p.deny
                })
            }
        }*/
        if (message.channel.name === 'dylanbot-commands') {
            /*channel.edit({
                name: `raiding-${channelNumber}`,
                permissionOverwrites: newPerms
            }).catch(r => console.log(r))*/
            channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
                .then(c => c.setName(`raiding-${channelNumber}`).catch(r => ErrorLogger.log(er, bot)))
        }
        if (message.channel.name === 'veteran-bot-commands') {
            channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
                .then(channel.setName(`Veteran Raiding ${channelNumber}`).catch(r => ErrorLogger.log(er, bot)))
        }
        if (message.channel.name === 'eventbot-commands') {
            let name = channel.name.substring(0, channel.name.indexOf(channelNumber) + 1)
            channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
                .then(channel.setName(`${name}`).catch(r => ErrorLogger.log(er, bot)))
        }
    }
}