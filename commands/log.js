const Discord = require('discord.js')
const CurrentWeek = require('./currentWeek')
const eCurrentWeek = require('./eventCurrentWeek')
const pCurrentWeek = require('./parseCurrentWeek')

const logs = require('../data/logInfo.json')


module.exports = {
    name: 'log',
    description: 'Logs runs',
    args: '<c/v/o/e> [mention for assists] (#)',
    requiredArgs: 1,
    role: 'eventrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let toUpdate = 0
        var embed = new Discord.MessageEmbed().setAuthor(message.member.nickname, message.author.avatarURL() || null)
        let currentWeekEmbed = new Discord.MessageEmbed()
        var count = 1;
        var desc = '`Successful` Run'
        let promises = []

        //get log info
        let guildInfo = logs[message.guild.id]
        if (!guildInfo) return message.channel.send('Logging isn\'t setup on this server yet')
        let run = getRunInfo(guildInfo, args[0])
        if (!run) return message.channel.send('Run Type not recognized')



        /* RUN LOGGING LOGIC */

        //count
        if (args[args.length - 1].replace(/^\d{1,2}$/, '') == '') {
            count = args[args.length - 1]
        }

        //confirm if needed
        let confirmed = false;
        if (run.confirm) confirmed = await confirm(run, message, count)
        else confirmed = true
        if (!confirmed) return

        //send query
        promises.push(new Promise(res => {
            db.query(`UPDATE users SET ${run.main} = ${run.main} + ${count}, ${run.currentweek} = ${run.currentweek} + ${count} WHERE id = '${message.author.id}'`, (err, rows) => {
                //return if any errors
                if (err) { res(null); return message.channel.send(`Error: ${err}`) }

                db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                    if (err) { res(null); return message.channel.send(`Error: ${err}`) }
                    if (rows.length < 1) { res(null); return message.channel.send('Current week stats could not be retrived. However, run was still logged') }
                    currentWeekEmbed.setDescription(`Run Logged for ${`<@!${message.author.id}>`}${message.member.nickname ? ` \`${message.member.nickname}\`` : ''}`)
                        .addField('Current week:', run.toDisplay.map(c => ` \`${rows[0][c]}\` ${c.replace('currentweek', '')}`).join('\n'))
                        .setTimestamp()
                        .setColor(run.color)
                    if (run.icon) currentWeekEmbed.setThumbnail(run.icon)
                    embed.setColor(run.color)
                    desc = run.desc
                    toUpdate = run.toUpdate
                    res(null)
                })
            })
        }))


        //assists
        if (run.allowAssists && guildInfo.assist) {
            desc = desc.concat(`\n`)
            message.mentions.members.each(m => {
                promises.push(new Promise(res => {
                    if (m.id !== message.author.id) {
                        desc = desc + `<@!${m.id}> `
                        db.query(`UPDATE users SET ${guildInfo.assist.main} = ${guildInfo.assist.main} + ${count}, ${guildInfo.assist.currentweek} = ${guildInfo.assist.currentweek} + ${count} WHERE id = ${m.id}`, (err, rows) => {
                            if (err) return res(null)
                            db.query(`SELECT ${guildInfo.assist.currentweek} FROM users WHERE id = '${m.id}'`, (err, rows) => {
                                let s = `<@!${m.id}>${m.nickname ? ` \`${m.nickname}\`` : ''}. Current week: ${rows[0][guildInfo.assist.currentweek]} Assists`
                                if (currentWeekEmbed.fields.length == 1) currentWeekEmbed.addField('Assists', s)
                                else if (currentWeekEmbed.fields[currentWeekEmbed.fields.length - 1].value.length + s.length <= 1024) currentWeekEmbed.fields[currentWeekEmbed.fields.length - 1].value = currentWeekEmbed.fields[currentWeekEmbed.fields.length - 1].value.concat(`\n${s}`)
                                else currentWeekEmbed.addField('** **', s)
                                res(null)
                            })
                        })
                    }
                }))
            })
        }

        await Promise.all(promises)

        embed.setDescription(desc)
        message.channel.send({ embeds: [currentWeekEmbed] })
        message.guild.channels.cache.get(settings.channels.leadinglog).send({ embeds: [embed] })
        if (!toUpdate) return
        if (toUpdate == 1 && settings.backend.currentweek) CurrentWeek.update(message.guild, db, bot)
        if (toUpdate == 2 && settings.backend.eventcurrentweek) eCurrentWeek.update(message.guild, db, bot)
        if (toUpdate == 3 && settings.backend.parsecurrentweek) pCurrentWeek.update(message.guild, db, bot)
    }
}

function confirm(runInfo, message, count) {
    return new Promise(async (res, rej) => {
        let confirmEmbed = new Discord.MessageEmbed()
            .setColor(runInfo.color)
            .setTitle('Confirm')
            .setDescription(`Are you sure that you lead for around ${parseInt(count) * runInfo.multiply} minutes?`)
            .setFooter(message.member.nickname)
            .setTimestamp()
        let confirmMessage = await message.channel.send({ embeds: [confirmEmbed] })
        let confirmCollector = new Discord.ReactionCollector(confirmMessage, { filter: (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌') })
        confirmMessage.react('✅')
        confirmMessage.react('❌')
        confirmCollector.on('collect', async function (r, u) {
            confirmMessage.delete()
            if (r.emoji.name === '✅') return res(true)
            else return res(false)
        })
        confirmCollector.on('end', async (r, u) => { confirmMessage.delete(); res(false); })
    })
}

function getRunInfo(guildInfo, key) {
    for (let i of guildInfo.main) {
        if (key == i.key) return i;
        if (i.alias.includes(key)) return i
    }
    return null
}