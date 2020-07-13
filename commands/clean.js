const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'clean',
    description: 'Cleans the given voice channel',
    args: '<channel>',
    role: 'Event Organizer',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (!(message.channel.parent.name.toLowerCase() === 'raiding' || message.channel.parent.name.toLowerCase() === 'veteran raiding' || message.channel.parent.name.toLowerCase() === 'events')) {
            message.channel.send("Try again in a correct category");
            return;
        }
        if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            let lounge = message.guild.channels.cache.find(c => c.name === "Veteran Lounge");
            let channel = message.guild.channels.cache.find(c => c.name == `${settings.vetprefix}${args[0]}` || c.name == `${settings.vetprefix}${args[0]} <-- Join!`);
            await this.clean(channel, lounge, message, settings)
        } else if (message.channel.parent.name.toLowerCase() === 'raiding') {
            let lounge = message.guild.channels.cache.find(c => c.name === "lounge");
            let channel = message.guild.channels.cache.find(c => c.name == `${settings.raidprefix}${args[0]}` || c.name == `${settings.raidprefix}${args[0]} <-- Join!`);
            await this.clean(channel, lounge, message, settings)
        } else if (message.channel.parent.name.toLowerCase() === 'events') {
            let channel = message.guild.channels.cache.find(c => c.type == 'category' && c.name == 'Events').children.find(c => c.name.includes(args[0]) && !c.name.includes('Realm Clearing'))
            let lounge = message.guild.channels.cache.find(c => c.name === 'Event Lounge')
            await this.clean(channel, lounge, message, settings)
        }
        await message.channel.send("Channel successfully cleaned");
    },
    async clean(channel, lounge, message, settings) {
        channel.members.each(async m => {
            if (m.roles.highest.position < message.guild.roles.cache.find(r => r.name === settings.eo).position) {
                await m.voice.setChannel(lounge, 'cleaning')
            }
        })
    }
}