const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'addvial',
    alias: ['av'],
    description: 'Adds stored vial to user',
    args: '<user>',
    requiredArgs: 1,
    role: 'almostrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0])
        if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (member == null) return message.channel.send('User not found')
        db.query(`SELECT * FROM users WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            db.query(`UPDATE users SET vialStored = ${parseInt(rows[0].vialStored) + 1} WHERE id = '${member.id}'`)
            message.channel.send(`Vial logged. They now have ${parseInt(rows[0].vialStored) + 1} vials stored`)
            message.guild.channels.cache.get(settings.channels.viallog).send(`Vial added to ${member} (${member.nickname}), logged by ${message.member} (${parseInt(rows[0].vialStored) + 1} remaining vials)`)
        })
    }
}