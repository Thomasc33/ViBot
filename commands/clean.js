const botSettings = require('../settings.json');

module.exports = {
    name: 'clean',
    description: 'Cleans the given voice channel',
    execute(message, args, bot) {
        handler(message, args)
    }
}

async function handler(message, args) {
    var isVet = false;
    var raidLeaderRole = message.guild.roles.cache.find(r => r.name === "Almost Raid Leader");
    var aRaidLeaderRole = message.guild.roles.cache.find(r => r.name === "Raid Leader");
    var modRole = message.guild.roles.cache.find(r => r.name === "Moderator");
    var securityRole = message.guild.roles.cache.find(r => r.name === "Security");
    if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
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
    if (isVet) {
        let lounge = message.guild.channels.cache.find(c => c.name === "Veteran Lounge");
        let channel = message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${args[0]}` || c.name == `Veteran Raiding ${args[0]} <--Join Now!`);
        await channel.members.each(u => {
            if (!(u.roles.cache.has(raidLeaderRole.id) || u.roles.cache.has(aRaidLeaderRole.id) || u.roles.cache.has(securityRole.id) || u.roles.cache.has(modRole.id))) {
                u.edit({ channel: lounge });
            }
        })
    } else {
        let lounge = message.guild.channels.cache.find(c => c.name === "lounge");
        let channel = message.guild.channels.cache.find(c => c.name == `raiding-${args[0]}` || c.name == `raiding-${args[0]} <--Join Now!`);
        await channel.members.each(u => {
            if (!(u.roles.cache.has(raidLeaderRole.id) || u.roles.cache.has(aRaidLeaderRole.id) || u.roles.cache.has(securityRole.id) || u.roles.cache.has(modRole.id))) {
                u.edit({ channel: lounge });
            }
        })
    }
    message.channel.send("Channel successfully cleaned");
}
