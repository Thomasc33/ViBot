const Discord = require('discord.js')

module.exports = {
    name: 'seppuku',
    role: 'eventrl',
    description: '死ぬ',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        message.channel.send(`死ぬ!`)
        message.member.ban()
    }
}