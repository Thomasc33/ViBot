const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'lockdown',
    description: 'Blocks verified raider from typing in a channel',
    role: 'headeventrl',
    args: 'None | <channel id>',
    async execute(message, args, bot) {
        let channel
        if (args.length == 0) channel = message.channel
        else channel = message.guild.channels.cache.get(args[0])
        if (!channel) return message.channel.send('Channel not found')

        channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false })
            .then(message.react('✅'))
            .catch(er => ErrorLogger.log(er, bot, message.guild))
    }
}
