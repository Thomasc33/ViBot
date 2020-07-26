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
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.raidingprefix}${args[0]}`))
                .setName(`${settings.voiceprefixes.raidingprefix}${args[0]}`).catch(er => { })
        } else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.vetprefix}${args[0]}`))
                .setName(`${settings.voiceprefixes.vetprefix}${args[0]}`).catch(r => { })
        } else return message.channel.send(`Please try again in ${message.guild.channels.cache.get(settings.channels.raidcommands)} or ${message.guild.channels.cache.get(settings.channels.vetcommands)}`);
        message.react('✅')
    }
}