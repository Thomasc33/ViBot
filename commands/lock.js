const botSettings = require('../settings.json');

module.exports = {
    name: 'lock',
    description: 'Locks voice channels',
    execute(message, args) {
        var raidLeaderRole = message.guild.roles.cache.find(r => r.name === "Almost Raid Leader");
        var aRaidLeaderRole = message.guild.roles.cache.find(r => r.name === "Raid Leader");
        if (!(message.member.roles.cache.has(raidLeaderRole.id) || message.member.roles.cache.has(aRaidLeaderRole.id))) return;
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
        channel = await message.guild.channels.cache.find(c => c.name == `raiding-${channelNumber}` || c.name == `raiding-${channelNumber} <--Join Now!`);
        verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === 'Verified Raider');
    } else if (isVet) {
        channel = await message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${channelNumber}` || c.name == `Veteran Raiding ${channelNumber} <--Join Now!`);
        verifiedRaiderRole = await message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
    } else return;
    await lockChannel(verifiedRaiderRole, channel, channelNumber, isVet);
    message.channel.send(`Raiding ${channelNumber} has been locked`)
}

async function lockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber}`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(99).catch(r => console.log(r));
    }
    if (!isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`raiding-${voiceChannelNumber}`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(99).catch(r => console.log(r));
    }
    return;
}
