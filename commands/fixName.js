const botSettings = require(`../settings.json`)

module.exports = {
    name: 'fixname',
    alias: ['fn'],
    role: 'Almost Raid Leader',
    description: 'Fixes the name of the raiding channel',
    args: '<channel>',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length == 0) return;
        if (args[0] > botSettings.voiceChannelCount) return;
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            message.guild.channels.cache.find(c => c.name.includes(`raiding-${args[0]}`))
                .setName(`raiding-${args[0]}`).catch(er => ErrorLogger.log(er, bot))
        } else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            message.guild.channels.cache.find(c => c.name.includes(`Veteran Raiding ${args[0]}`))
                .setName(`Veteran Raiding ${args[0]}`).catch(r => ErrorLogger.log(er, bot))
        } else {
            message.channel.send(`Please try again in ${message.guild.channels.cache.find(r => r.name == settings.raidcommands)} or ${message.guild.channels.cache.find(r => r.name == settings.vetcommands)}`);
            return;
        }
        message.react('✅')
    }
}