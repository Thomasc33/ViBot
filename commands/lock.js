const botSettings = require('../settings.json');

module.exports = {
    name: 'lock',
    description: 'Locks voice channel',
    alias: 'rc, resetchannel',
    args: '<channel>',
    role: 'Almost Raid Leader',
    execute(message, args) {
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.name === 'dylanbot-commands') {
            var isVet = false;
        } else if (message.channel.name === 'veteran-bot-commands') {
            var isVet = true;
        } else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        handler(message, args[0], isVet);
    }
}

async function handler(message, channelNumber, isVet) {
    //variables code
    var channel, verifiedRaiderRole
    if (!isVet) {
        channel = await message.guild.channels.cache.find(c => c.name == `raiding-${channelNumber}` || c.name == `raiding-${channelNumber} <-- Join!`);
        verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === 'Verified Raider');
    } else if (isVet) {
        channel = await message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${channelNumber}` || c.name == `Veteran Raiding ${channelNumber} <-- Join!`);
        verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
    } else return;
    await lockChannel(verifiedRaiderRole, channel, channelNumber, isVet);
    message.channel.send(`Raiding ${channelNumber} has been locked`)
}

async function lockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r))
            .then(voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber}`).catch(r => console.log(r)))
            .then(voiceChannel.setUserLimit(75).catch(r => console.log(r)));
    }
    if (!isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r))
            .then(voiceChannel.setName(`raiding-${voiceChannelNumber}`).catch(r => console.log(r)))
            .then(voiceChannel.setUserLimit(75).catch(r => console.log(r)));
    }
    return;
}
