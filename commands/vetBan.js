const fs = require('fs')
const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'vetban',
    description: 'Gives user vet banned role',
    args: '[in-game names] <time> <time type d/m/s/w/y> <reason>',
    requiredArgs: 3,
    role: 'veteventrl',
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const vetBanRole = message.guild.roles.cache.get(settings.roles.vetban)
        const suspensionLog = message.guild.channels.cache.get(settings.channels.suspendlog)
        const toBan = []
        if (args.length < 3) {
            message.channel.send('Expected at least 4 arguments, but recieved ' + args.length)
            return
        }
        for (i = 0; i < args.length; i++) {
            const arg = args[0]
            if (arg.replace(/^\d{1,2}$/, '') == '') {
                break
            } else {
                toBan.push(args.shift())
            }
        }
        try {
            var time = parseInt(args[0])
            const timeType = args[1]
            var timeTypeString

            switch (timeType.toLowerCase()) {
                case 'd':
                    time *= 86400000
                    timeTypeString = 'day(s)'
                    break
                case 'm':
                    time *= 60000
                    timeTypeString = 'minutes'
                    break
                case 's':
                    time *= 1000
                    timeTypeString = 'second(s)'
                    break
                case 'w':
                    time *= 604800000
                    timeTypeString = 'week(s)'
                    break
                case 'y':
                    time *= 31536000000
                    timeTypeString = 'year(s)'
                    break
                case 'h':
                    time *= 3600000
                    timeTypeString = 'hour(s)'
                    break
                default:
                    message.channel.send('Please enter a valid time type __**d**__ay, __**m**__inute, __**h**__our, __**s**__econd, __**w**__eek, __**y**__ear')
                    return
            }
        } catch (er) {
            return message.channel.send('Invalid time given. Please try again')
        }
        try {
            let reason = ''
            for (i = 2; i < args.length; i++) {
                reason = reason.concat(args[i]) + ' '
            }
            if (reason == '') reason = 'None'
            reason = reason.replace('\'', '`')
            toBan.forEach(u => {
                let member = message.guild.members.cache.get(u)
                if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()))
                if (!member) member = message.guild.members.cache.get(u.replace(/[<>@!]/gi, ''))
                if (!member) return message.channel.send(`${u} not found, please try again`)
                if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be vetbanned`)
                if (!member.roles.cache.has(settings.roles.vetraider)) return message.channel.send(`${member} is does not have veteran raider role`)
                if (member.roles.cache.has(vetBanRole.id)) {
                    db.query(`SELECT * FROM vetbans WHERE id = '${member.id}' AND suspended = true`, async (err, rows) => {
                        if (rows.length != 0) {
                            message.channel.send(member.nickname.concat(' is already vetbanned. Reply __**Y**__es to overwrite.'))
                            const collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id, time: 10000 })
                            collector.on('collect', message => {
                                if (message.content.charAt(0) == 'y') {
                                    db.query(`UPDATE vetbans SET suspended = 0 WHERE id = '${member.id}'`)
                                    message.channel.send('Overwriting suspension...')
                                    vetBanProcess()
                                    collector.stop()
                                } else if (message.content.charAt(0) == 'n') {
                                    return collector.stop()
                                } else {
                                    message.channel.send('Response not recognized. Please try banning again')
                                    collector.stop()
                                }
                            })
                        } else return message.channel.send(`${member} is already vet banned, and I dont have any record of them being banned`)
                    })
                } else {
                    vetBanProcess()
                }
                async function vetBanProcess() {
                    const embed = new Discord.EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('Vet Ban Information')
                        .setDescription(`The ban is for ${parseInt(args[0])} ${timeTypeString} until <t:${((Date.now() + time) / 1000).toFixed(0)}:f>`)
                        .addFields([{ name: `User Information \`${member.nickname}\``, value: `<@!${member.id}> (Tag: ${member.user.tag})`, inline: true }])
                        .addFields([{ name: `Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, value: `<@!${message.author.id}> (Tag: ${message.author.tag})`, inline: true }])
                        .addFields([{ name: 'Reason:', value: reason }])
                        .setFooter({ text: 'Unsuspending at ' })
                        .setTimestamp(Date.now() + time)
                    messageId = await suspensionLog.send({ embeds: [embed] })
                    await member.user.send({ embeds: [embed] }).catch(() => {})
                    db.query(`INSERT INTO vetbans (id, guildid, suspended, uTime, reason, modid, logmessage) VALUES ('${member.id}', '${message.guild.id}', true, '${Date.now() + time}', '${reason}', '${message.author.id}', '${messageId.id}');`, err => { if (err) console.log(err) })
                    await member.roles.remove(settings.roles.vetraider)
                    setTimeout(() => { member.roles.add(settings.roles.vetban) }, 1000)
                    message.channel.send(`${member} has been vet banned`)
                }
            })
        } catch (er) {
            ErrorLogger.log(er, bot, message.guild)
            message.channel.send('Error with command. Please check syntax and try again')
        }
    }
}
