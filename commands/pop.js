const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

const keypops = require('../data/keypop.json')

module.exports = {
    name: 'pop',
    description: 'Logs key pops',
    args: '<keytype> <user> (count)',
    getNotes(guildid, u) {
        return keypops[guildid] ? Object.keys(keypops[guildid]).toString() : `not setup for guild ${guildid}`
    },
    requiredArgs: 2,
    role: 'eventrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var count = 1
        if (args.length < 1) return;
        if (args.length > 2) count = parseInt(args[2])
        if (count == NaN || !count) count = 1
        var user = message.mentions.members.first()
        if (!user) user = message.guild.members.cache.get(args[1])
        if (!user) user = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
        if (!user) return message.channel.send('User not found')

        if (!keypops[message.guild.id]) return message.channel.send('Key information missing for this guild')
        let keyInfo = findKey(message.guild.id, args[0].toLowerCase())
        if (!keyInfo) return message.channel.send(`\`${args[0]}\` not recognized`)

        message.channel.send(`Are you sure you want to log ${count} ${keyInfo.name} pops for ${user.nickname}? (Y/N)`)
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 20000 });
        collector.on('collect', m => {
            if (m.content.charAt(0).toLowerCase() == 'y') {
                collector.stop()
                db.query(`SELECT * FROM users WHERE id = '${user.id}'`, (err, rows) => {
                    if (err) ErrorLogger.log(err, bot)
                    if (rows.length == 0) return message.channel.send('User is not logged in the DB')
                    db.query(`UPDATE users SET ${keyInfo.schema} = ${keyInfo.schema} + ${count} WHERE id = '${user.id}'`)
                    message.channel.send(`Key has been logged. ${user.nickname} now has ${parseInt(rows[0][keyInfo.schema]) + parseInt(count)} pops`)
                })
                if (settings.backend.points && keyInfo.points) {
                    let points = settings.points[keyInfo.points] * count
                    if (user.roles.cache.has(settings.roles.nitro)) points = points * settings.points.nitromultiplier
                    db.query(`UPDATE users SET points = points + ${points} WHERE id = '${user.id}'`)
                }
            } else if (m.content.charAt(0).toLowerCase() == 'n') {
                collector.stop()
                return message.channel.send('Cancelled.')
            } else return message.channel.send('Response not recognized. Try again (Y/N)')
        })
    }
}

function findKey(guildid, key) {
    let info = keypops[guildid]
    if (Object.keys(info).includes(key)) return info[key]
    for (let i of info) if (i.alias.includes(key)) return i
    return null
}