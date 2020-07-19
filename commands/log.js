const Discord = require('discord.js')
const CurrentWeek = require('./currentWeek')
const eCurrentWeek = require('./eventCurrentWeek')

module.exports = {
    name: 'log',
    description: 'Logs runs',
    args: '<c/v/e> [mention for assists] (#)',
    role: 'Event Organizer',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var embed = new Discord.MessageEmbed()
            .setAuthor(message.member.nickname, message.author.avatarURL())
            .setColor('#015c21')
        var count = 1;
        var desc = '`Successful` Run'
        if (args.length > 0) {
            if (args[args.length - 1].replace(/^\d{1,2}$/, '') == '') {
                count = args[args.length - 1]
            }
            if (args[0].toLowerCase().charAt(0) == 'v') {
                db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                    if (err) throw err;
                    db.query(`UPDATE users SET voidsLead = ${parseInt(rows[0].voidsLead) + parseInt(count)}, currentweekVoid = ${parseInt(rows[0].currentweekVoid) + parseInt(count)} WHERE id = '${message.author.id}'`)
                    message.channel.send(`Run logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].currentweekCult)} cult, ${parseInt(rows[0].currentweekVoid) + parseInt(count)} void, and ${parseInt(rows[0].currentweekAssists)} assists`)
                })
                embed.setColor('#8c00ff')
                desc = '`Void` Run'
            } else if (args[0].toLowerCase().charAt(0) == 'c') {
                db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                    if (err) throw err;
                    db.query(`UPDATE users SET cultsLead = ${parseInt(rows[0].cultsLead) + parseInt(count)}, currentweekCult = ${parseInt(rows[0].currentweekCult) + parseInt(count)} WHERE id = '${message.author.id}'`)
                    message.channel.send(`Run logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].currentweekCult) + parseInt(count)} cult, ${parseInt(rows[0].currentweekVoid)} void, and ${parseInt(rows[0].currentweekAssists)} assists`)
                })
                embed.setColor('#ff0000')
                desc = '`Cult` Run'
            } else if (args[0].toLowerCase().charAt(0) == 'e') {
                let confirmEmbed = new Discord.MessageEmbed()
                    .setColor('#ffff00')
                    .setTitle('Confirm')
                    .setDescription(`Are you sure that you lead for around ${parseInt(count) * 10} minutes?`)
                    .setFooter(message.member.nickname)
                    .setTimestamp()
                let confirmMessage = await message.channel.send(confirmEmbed)
                let confirmCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
                await confirmMessage.react('✅')
                await confirmMessage.react('❌')
                confirmCollector.on('collect', async function (r, u) {
                    if (r.emoji.name === '✅') {
                        await confirmMessage.delete()
                        db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                            if (err) throw err;
                            db.query(`UPDATE users SET eventsLead = ${parseInt(rows[0].eventsLead) + parseInt(count)}, currentweekEvents = ${parseInt(rows[0].currentweekEvents) + parseInt(count)} WHERE id = '${message.author.id}'`)
                            message.channel.send(`Run logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].currentweekEvents) + parseInt(count)}`)
                        })
                        embed.setColor('#00FF00')
                        desc = '`Event` Run'
                        confirmCollector.stop()
                        cont()
                    }
                    else if (r.emoji.name === '❌') {
                        await confirmMessage.delete()
                        confirmCollector.stop()
                        return;
                    }
                })
            } else {
                message.channel.send('Run type not recognized. Please try again');
                return;
            }
        } else {
            message.channel.send("Please specify a run type");
            return;
        }
        if (message.mentions.users && args[0].toLowerCase().charAt(0) !== 'e') {
            desc = desc.concat(`\n`)
            message.mentions.members.each(u => {
                if (u.id !== message.author.id) {
                    desc = desc + `${message.guild.members.cache.get(u.id)} `
                    db.query(`SELECT * FROM users WHERE id = '${u.id}'`, (err, rows) => {
                        if (err) throw err;
                        db.query(`UPDATE users SET assists = ${parseInt(rows[0].assists) + parseInt(count)}, currentweekAssists = ${parseInt(rows[0].currentweekAssists) + parseInt(count)} WHERE id = '${u.id}'`)
                        message.channel.send(`Run logged for ${u.nickname}. Current week: ${parseInt(rows[0].currentweekCult)} cult, ${parseInt(rows[0].currentweekVoid)} void, and ${parseInt(rows[0].currentweekAssists) + parseInt(count)} assists`)
                    })
                }
            })
            cont()
        }
        function cont() {
            embed.setDescription(desc)
            message.guild.channels.cache.find(c => c.name === settings.leadinglogs).send(embed)
            if (settings.currentweek) CurrentWeek.update(message.guild, db, bot)
            if (settings.eventCurrentweek) eCurrentWeek.update(message.guild, db, bot)
        }
    }
}