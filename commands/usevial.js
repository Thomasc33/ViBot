const ErrorLogger = require('../logError')
const botSettings = require('../settings.json')

module.exports = {
    name: 'usevial',
    alias: ['uv'],
    description: 'Adds popped vial to user',
    args: '<user>',
    role: 'Almost Raid Leader',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0])
        if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (member == null) { message.channel.send('User not found'); return; }
        db.query(`SELECT * FROM users WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if(settings.points){
                if (member.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.nitro).id)) var points = botSettings.points.vialPopPoints * botSettings.points.nitroMultiplier
                else var points = botSettings.points.vialPopPoints
                db.query(`UPDATE users SET vialUsed = ${parseInt(rows[0].vialUsed) + 1}, points = points + ${points} WHERE id = '${member.id}'`)
            }
            message.channel.send(`Vial logged. They now have ${parseInt(rows[0].vialUsed) + 1} vials popped`)
            message.guild.channels.cache.find(c => c.name === settings.viallog).send(`Vial added to ${member} (${member.nickname}), logged by ${message.member} (${parseInt(rows[0].vialUsed) + 1} total pops)`)
        })
    }
}