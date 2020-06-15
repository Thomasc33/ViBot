const botSettings = require(`../settings.json`)

module.exports = {
    name: 'fixname',
    alias: ['fn'],
    role: 'Almost Raid Leader',
    description: 'Fixes the name of the raiding channel',
    args: '<channel>',
    execute(message, args, bot) {
        if (args.length == 0) return;
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.name === 'dylanbot-commands') {
            message.guild.channels.cache.find(c => c.name.includes(`raiding-${args[0]}`))
                .setName(`raiding-${args[0]}`).catch(er => ErrorLogger.log(er, bot))
        } else if (message.channel.name === 'veteran-bot-commands') {
            message.guild.channels.cache.find(c => c.name.includes(`Veteran Raiding ${args[0]}`))
                .setName(`Veteran Raiding ${args[0]}`).catch(r => ErrorLogger.log(er, bot))
        } else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
    }
}