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
        if (!(message.channel.parent.name.toLowerCase() === 'raiding' || message.channel.parent.name.toLowerCase() === 'veteran raiding' || message.channel.parent.name.toLowerCase() === 'events')) {
            return message.channel.send("Try again in a correct category");
        }
        if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            let lounge = message.guild.channels.cache.get(settings.channels.vetlounge);
            let channel = message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.vetprefix}${args[0]}`))
            await this.clean(channel, lounge, message, settings)
        } else if (message.channel.parent.name.toLowerCase() === 'raiding') {
            let lounge = message.guild.channels.cache.get(settings.channels.lounge);
            let channel = message.guild.channels.cache.find(c => c.name.includes(`${settings.voiceprefixes.raidprefix}${args[0]}`))
            await this.clean(channel, lounge, message, settings)
        } else if (message.channel.parent.name.toLowerCase() === 'events') {
            let channel = message.guild.channels.cache.find(c => c.type == 'category' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            let lounge = message.guild.channels.cache.get(settings.channels.eventlounge)
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