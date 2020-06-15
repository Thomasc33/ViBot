const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'clean',
    description: 'Cleans the given voice channel',
    args: '<channel>',
    role: 'Event Organizer',
    async execute(message, args, bot) {
        var isVet = false;
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands') || message.channel.name === 'eventbot-commands') {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (message.channel.name === 'veteran-bot-commands') {
            isVet = true;
            if (args[0] > botSettings.vetVoiceChannelCount) {
                message.channel.send("Channel number invalid");
                return;
            }
        } else {
            if (args[0] > botSettings.voiceChannelCount) {
                message.channel.send("Channel number invalid");
                return;
            }
        }
        if (message.channel.name == 'eventbot-commands') {
            let channel = message.guild.channels.cache.find(c => c.type == 'category' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            let lounge = message.guild.channels.cache.find(c => c.name === 'Event Lounge')
            this.clean(channel, lounge, message)
            return;
        }
        if (isVet) {
            let lounge = message.guild.channels.cache.find(c => c.name === "Veteran Lounge");
            let channel = message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${args[0]}` || c.name == `Veteran Raiding ${args[0]} <-- Join!`);
            var vcUsers = channel.members.array()
            for (let i in vcUsers) {
                let u = vcUsers[i];
                if (u.roles.highest.position < message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) {
                    await u.edit({ channel: lounge });
                }
            }
        } else {
            let lounge = message.guild.channels.cache.find(c => c.name === "lounge");
            let channel = message.guild.channels.cache.find(c => c.name == `raiding-${args[0]}` || c.name == `raiding-${args[0]} <-- Join!`);
            this.clean(channel, lounge, message)
        }
        message.channel.send("Channel successfully cleaned");
    },
    async clean(channel, lounge, message) {
        let users = channel.members.array()
        for (let i in users) {
            let u = users[i]
            if (u.roles.highest.position < message.guild.roles.cache.find(r => r.name === "Event Organizer").position) {
                await u.edit({ channel: lounge });
            }
        }
    }
}