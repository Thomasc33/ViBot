module.exports = {
    name: 'temporarykeyremove',
    alias: ['tkr'],
    role: 'security',
    description: 'Removes temporary key popper role',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')
        member.roles.remove(settings.roles.tempkey)
            .then(message.react('✅'))
    }
}