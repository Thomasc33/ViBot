const Discord = require('discord.js')
const CurrentWeek = require('./currentWeek')
const eCurrentWeek = require('./eventCurrentWeek')
const pCurrentWeek = require('./parseCurrentWeek')

const logs = require('../logInfo.json')


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

                    message.channel.send(`Run Logged for ${message.member.nickname || `<@!${message.author.id}>`}. Current week: ${run.toDisplay.map(c => ` \`${rows[0][c]}\` ${c.replace('currentweek', '')}`)}`)
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
                                message.channel.send(`Assist Logged for ${m.nickname || `<@!${m.id}>`}. Current week: ${rows[0][guildInfo.assist.currentweek]} Assists`)
                                res(null)
                            })
                        })
                    }
                }))
            })
        }

        await Promise.all(promises)

        embed.setDescription(desc)
        message.guild.channels.cache.get(settings.channels.leadinglog).send(embed)
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
        let confirmMessage = await message.channel.send(confirmEmbed)
        let confirmCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
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
    }
    return null
}



/*
if (args[0].toLowerCase().charAt(0) == 'v') {
    db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
        if (err) throw err;
        if (rows.length == 0) return message.channel.send('You are not logged in DB')
        db.query(`UPDATE users SET voidsLead = ${parseInt(rows[0].voidsLead) + parseInt(count)}, currentweekVoid = ${parseInt(rows[0].currentweekVoid) + parseInt(count)} WHERE id = '${message.author.id}'`)
        message.channel.send(`Run logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].currentweekCult)} cult, ${parseInt(rows[0].currentweekVoid) + parseInt(count)} void, and ${parseInt(rows[0].currentweekAssists)} assists`)
    })
    embed.setColor('#8c00ff')
    desc = '`Void` Run'
    toUpdate = 1;
} else if (args[0].toLowerCase().charAt(0) == 'c') { //cult
    db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
        if (err) throw err;
        if (rows.length == 0) return message.channel.send('You are not logged in DB')
        db.query(`UPDATE users SET cultsLead = ${parseInt(rows[0].cultsLead) + parseInt(count)}, currentweekCult = ${parseInt(rows[0].currentweekCult) + parseInt(count)} WHERE id = '${message.author.id}'`)
        message.channel.send(`Run logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].currentweekCult) + parseInt(count)} cult, ${parseInt(rows[0].currentweekVoid)} void, and ${parseInt(rows[0].currentweekAssists)} assists`)
    })
    embed.setColor('#ff0000')
    desc = '`Cult` Run'
    toUpdate = 1;
} else if (args[0].toLowerCase().charAt(0) == 'o') { //o3
    db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
        if (err) throw err;
        if (rows.length == 0) return message.channel.send('You are not logged in DB')
        db.query(`UPDATE users SET o3leads = ${parseInt(rows[0].o3leads) + parseInt(count)}, currentweeko3 = ${parseInt(rows[0].currentweeko3) + parseInt(count)} WHERE id = '${message.author.id}'`)
        message.channel.send(`Run logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].currentweeko3) + parseInt(count)} runs, and ${parseInt(rows[0].currentweekAssistso3)} assists`)
    })
    embed.setColor('#8c00ff')
    desc = '`Oryx` Run'
    toUpdate = 1;
} else if (args[0].toLowerCase().charAt(0) == 'p') { //o3 parses
    db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
        if (err) throw err;
        if (rows.length == 0) return message.channel.send('You are not logged in DB')
        db.query(`UPDATE users SET o3parses = ${parseInt(rows[0].o3parses) + parseInt(count)}, o3currentweekparses = ${parseInt(rows[0].o3currentweekparses) + parseInt(count)} WHERE id = '${message.author.id}'`)
        message.channel.send(`Parse logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].o3currentweekparses) + parseInt(count)} parses`)
    })
    embed.setColor('#8c00ff')
    desc = '`Oryx` Parse'
    toUpdate = 3;
    cont()
} else if (args[0].toLowerCase().charAt(0) == 'e') { //events
    let confirmEmbed = new Discord.MessageEmbed()
        .setColor('#ffff00')
        .setTitle('Confirm')
        .setDescription(`Are you sure that you lead for around ${parseInt(count) * 10} minutes?`)
        .setFooter(message.member.nickname)
        .setTimestamp()
    let confirmMessage = await message.channel.send(confirmEmbed)
    let confirmCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
    confirmMessage.react('✅')
    confirmMessage.react('❌')
    confirmCollector.on('collect', async function (r, u) {
        if (u.bot) return
        if (r.emoji.name === '✅') {
            db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                if (err) throw err;
                if (rows.length == 0) return message.channel.send('You are not logged in DB')
                db.query(`UPDATE users SET eventsLead = ${parseInt(rows[0].eventsLead) + parseInt(count)}, currentweekEvents = ${parseInt(rows[0].currentweekEvents) + parseInt(count)} WHERE id = '${message.author.id}'`)
                message.channel.send(`Run logged for ${message.member.nickname}. Current week: ${parseInt(rows[0].currentweekEvents) + parseInt(count)}`)
            })
            embed.setColor('#00FF00')
            desc = '`Event` Run'
            cont()
            confirmMessage.delete()
        }
        else if (r.emoji.name === '❌') return confirmMessage.delete()
    })
    toUpdate = 2;
} else return message.channel.send('Run type not recognized. Please try again');

if (message.mentions.users && args[0].toLowerCase().charAt(0) !== 'e' && args[0].toLowerCase().charAt(0) !== 'p') {
    desc = desc.concat(`\n`)
    let assistName = 'assists', weeklyAssistName = 'currentweekAssists';
    if (args[0].toLowerCase().charAt(0) == 'o') { assistName = 'assistso3'; weeklyAssistName = 'currentweekAssistso3' }
    message.mentions.members.each(u => {
        if (u.id !== message.author.id) {
            desc = desc + `${message.guild.members.cache.get(u.id)} `
            db.query(`SELECT * FROM users WHERE id = '${u.id}'`, (err, rows) => {
                if (err) throw err;
                db.query(`UPDATE users SET ${assistName} = ${parseInt(rows[0][assistName]) + parseInt(count)}, ${weeklyAssistName} = ${parseInt(rows[0][weeklyAssistName]) + parseInt(count)} WHERE id = '${u.id}'`)
                if (args[0].toLowerCase().charAt(0) == 'o') message.channel.send(`Run logged for ${u.nickname}. Current week: ${parseInt(rows[0].currentweeko3)} o3, ${parseInt(rows[0][weeklyAssistName]) + parseInt(count)} assists`)
                else message.channel.send(`Run logged for ${u.nickname}. Current week: ${parseInt(rows[0].currentweekCult)} cult, ${parseInt(rows[0].currentweekVoid)} void, and ${parseInt(rows[0][weeklyAssistName]) + parseInt(count)} assists`)
            })
        }
    })
    cont()
}
*/