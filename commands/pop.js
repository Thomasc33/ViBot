const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'pop',
    description: 'Logs key pops',
    args: '<lh/event> <user> (count)',
    requiredArgs: 2,
    role: 'eventrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var count = 1
        if (args.length < 1) return;
        if (args.length > 2) {
            count = parseInt(args[2])
        }
        if (count == NaN || !count) count = 1
        var user = message.mentions.members.first()
        if (!user) user = message.guild.members.cache.get(args[1])
        if (!user) user = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
        if (!user) return message.channel.send('User not found')

        if (args[0].toLowerCase() == 'lh' || args[0].toLowerCase() == 'losthalls') {
            message.channel.send(`Are you sure you want to log ${count} lost halls pops for ${user.nickname}? (Y/N)`)
            let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
            collector.on('collect', m => {
                if (m.content.charAt(0).toLowerCase() == 'y') {
                    collector.stop()
                    db.query(`SELECT * FROM users WHERE id = '${user.id}'`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        if (rows.length == 0) return message.channel.send('User is not logged in the DB')
                        db.query(`UPDATE users SET keypops = ${parseInt(rows[0].keypops) + parseInt(count)} WHERE id = '${user.id}'`)
                        message.channel.send(`Key has been logged. ${user.nickname} now has ${parseInt(rows[0].keypops) + parseInt(count)} pops`)
                    })
                    let points = settings.points.keypop * count
                    if (user.roles.cache.has(settings.roles.nitro)) points = points * settings.points.nitromultiplier
                    db.query(`UPDATE users SET points = points + ${points} WHERE id = '${user.id}'`)
                } else if (m.content.charAt(0).toLowerCase() == 'n') {
                    collector.stop()
                    message.channel.send('Cancelled.')
                    return;
                } else { message.channel.send('Response not recognized. Try again (Y/N)') }
            })
        } else if (args[0].toLowerCase() == 'event' || args[0].toLowerCase() == 'e') {
            message.channel.send(`Are you sure you want to log ${count} event pops for ${user.nickname}? (Y/N)`)
            let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
            collector.on('collect', m => {
                if (m.content.charAt(0).toLowerCase() == 'y') {
                    collector.stop()
                    db.query(`SELECT * FROM users WHERE id = '${user.id}'`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        if (rows.length == 0) return message.channel.send('User is not logged in the DB')
                        db.query(`UPDATE users SET eventpops = ${parseInt(rows[0].eventpops) + parseInt(count)} WHERE id = '${user.id}'`)
                        message.channel.send(`Key has been logged. ${user.nickname} now has ${parseInt(rows[0].eventpops) + parseInt(count)} event pops`)
                    })
                    let points = settings.points.eventkey * count
                    if (user.roles.cache.has(settings.roles.nitro)) points = points * settings.points.nitromultiplier
                    db.query(`UPDATE users SET points = points + ${points} WHERE id = '${user.id}'`)
                } else if (m.content.charAt(0).toLowerCase() == 'n') {
                    collector.stop()
                    message.channel.send('Cancelled.')
                    return;
                } else { message.channel.send('Response not recognized. Try again (Y/N)') }
            })
        }
    }
}