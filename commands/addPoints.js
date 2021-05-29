const botSettings = require('../settings.json')
module.exports = {
    name: 'addpoints',
    alias: ['stream', 'priest', 'trickster'],
    guildSpecific: true,
    role: 'security',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (!settings || !settings.backend.points) return
        let type
        let command = message.content.substring(botSettings.prefix.length, message.content.length).split(/ +/)[0].toLowerCase()
        if (command == this.name) type = args.shift()
        else type = command
        let member = message.guild.members.cache.get(args[0])
        if (!member) member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send(`${args[0]} not found`)
        let points
        switch (type) {
            case 'stream': points = settings.points.o3streaming; break;
            case 'priest': points = settings.points.o3puri; break;
            case 'trickster': points = settings.points.o3trickster; break;
            default: return message.channel.send(`${type} not recognized`)
        }
        db.query(`UPDATE users SET points = points + ${points} WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            message.react('✅')
        })
    }
}