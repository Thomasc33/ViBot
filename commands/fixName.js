const botSettings = require(`../settings.json`)

module.exports = {
    name: 'fixname',
    alias: ['fn'],
    role: 'almostrl',
    requiredArgs: 1,
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
        } else if (message.channel.parent.name.toLowerCase() === 'events') {
            let channel = message.guild.channels.cache.find(c => c.type == 'GUILD_CATEGORY' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            channel.setName(channel.name.substring(0, channel.name.indexOf(args[0]) + 1)).catch(r => { })
        } else return message.channel.send(`Please try again in ${message.guild.channels.cache.get(settings.channels.raidcommands)} or ${message.guild.channels.cache.get(settings.channels.vetcommands)}`);
        message.react('✅')
    }
}