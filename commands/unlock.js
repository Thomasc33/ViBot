const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')
var bot;
module.exports = {
    name: 'unlock',
    description: 'Unlocks voice channels',
    alias: 'ul',
    args: '<channel number>',
    role: 'Almost Raid Leader',
    execute(message, args, bott) {
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.name === 'dylanbot-commands') {
            var isVet = false;
        } else if (message.channel.name === 'veteran-bot-commands') {
            var isVet = true;
        } else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        bot = bott
        handler(message, args[0], isVet);
    },
};

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
    if (channel == null) {
        message.channel.send("Could not find channel correctly, please try again");
        return;
    }
    await unlockChannel(verifiedRaiderRole, channel, channelNumber, isVet);
    message.channel.send(`Raiding ${channelNumber} has been unlocked`)
}

async function unlockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            .then(voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber} <-- Join!`).catch(r => ErrorLogger.log(er, bot)))
    }
    if (!isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            .then(voiceChannel.setName(`raiding-${voiceChannelNumber} <-- Join!`).catch(r => ErrorLogger.log(er, bot)))
    }
    return;
}