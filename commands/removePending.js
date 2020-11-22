module.exports = {
    name: 'removepending',
    role: 'security',
    description: 'Removes a pending verification or veteran verification module if bot hiccups',
    args: '<r/v> <id>',
    notes: 'r = regular, v = veteran',
    requiredArgs: 2,
    async execute(message, args, bot) {
        //veteran or regular
        let isVet
        if (args[0].charAt(0).toLowerCase() == 'r') isVet = false
        else if (args[0].charAt(0).toLowerCase() == 'v') isVet = true
        else return message.channel.send('Please specify regular or veteran')

        //get channel and message id
        let mID = args[1]
        if (!mID) return message.channel.send('Please specify a message id')
        let channel
        if (isVet) channel = message.guild.channels.cache.get(bot.settings[message.guild.id].channels.manualvetverification)
        else channel = message.guild.channels.cache.get(bot.settings[message.guild.id].channels.manualverification)
        if (!channel) return message.channel.send('I could not find the channel')

        //delete message
        channel.messages.fetch(mID)
            .then(m => {
                if (!m) return message.channel.send(`I could not find the message under \`${mID}\``)
                m.delete()
                    .then(message.react('✅'))
            })

    }
}