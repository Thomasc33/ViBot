const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'clean',
    description: 'Cleans the given voice channel',
    args: '<channel>',
    requiredArgs: 1,
    role: 'eventrl',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (!(message.channel.parent.name.toLowerCase() === settings.categories.raiding || message.channel.parent.name.toLowerCase() === settings.categories.veteran || message.channel.parent.name.toLowerCase() === settings.categories.event)) return message.channel.send("Try again in a correct category");
        if (message.channel.parent.name.toLowerCase() === settings.categories.veteran) {
            let lounge = message.guild.channels.cache.get(settings.voice.vetlounge);
            let channel = message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.vetprefix}${args[0]}`))
            if (!channel || !lounge) return message.channel.send('I could not find one of the voice channels (channel or lounge)')
            await this.clean(channel, lounge, message, settings)
        } else if (message.channel.parent.name.toLowerCase() === settings.categories.raiding) {
            let lounge = message.guild.channels.cache.get(settings.voice.lounge);
            let channel = message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.raidprefix}${args[0]}`))
            if (!channel || !lounge) return message.channel.send('I could not find one of the voice channels (channel or lounge)')
            await this.clean(channel, lounge, message, settings)
        } else if (message.channel.parent.name.toLowerCase() === settings.categories.raiding) {
            let channel = message.guild.channels.cache.find(c => c.type == 'category' && c.name == settings.categories.event).children.find(c => c.name.includes(args[0]))
            let lounge = message.guild.channels.cache.get(settings.voice.eventlounge)
            if (!channel || !lounge) return message.channel.send('I could not find one of the voice channels (channel or lounge)')
            await this.clean(channel, lounge, message, settings)
        }
        await message.channel.send("Channel successfully cleaned");
    },
    async clean(channel, lounge, message, settings) {
        channel.members.each(async m => {
            if (m.roles.highest.position < message.guild.roles.cache.get(settings.roles.eventrl).position) {
                await m.voice.setChannel(lounge, 'cleaning').catch(er => { })
            }
        })
    }
}