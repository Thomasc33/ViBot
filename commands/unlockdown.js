const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'unlockdown',
    description: 'Allows people to type in a channel',
    role: 'headrl',
    args: 'None | <channel id>',
    async execute(message, args, bot, db) {
        let channel;
        if (args.length == 0) channel = message.channel;
        else channel = message.guild.channels.cache.get(args[0])
        if (!channel) return message.channel.send('Channel not found')

        channel.updateOverwrite(message.guild.id, { SEND_MESSAGES: null })
            .then(message.react('✅'))
            .catch(er => ErrorLogger.log(er, bot))
    }
}