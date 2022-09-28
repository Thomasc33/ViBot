const Discord = require('discord.js')
const logs = require('../data/logInfo.json')
const quotas = require('../data/quotas.json')
const quota = require('./quota')
module.exports = {
    name: 'log',
    description: 'Logs runs',
    args: '<type> [mention for assists] (#)',
    requiredArgs: 1,
    role: 'eventrl',
    getNotes(guildid, member) {
        return `Types: ${logs[guildid].main.map(log => log.key + ' (' + log.name + ')').join(', ')}`
    },
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let toUpdate = 0
        var embed = new Discord.EmbedBuilder().setAuthor({ name: message.member.nickname, iconURL: message.author.avatarURL() || undefined })
        let currentWeekEmbed = new Discord.EmbedBuilder()
        let count = 1;
        var desc = '`Successful` Run'
        let promises = []

        //get log info
        let guildInfo = logs[message.guild.id]
        if (!guildInfo) return message.channel.send('Logging isn\'t setup on this server yet')
        let run = getRunInfo(guildInfo, args[0])
        if (!run) return message.channel.send('Run Type not recognized\n' + this.getNotes(message.guild.id))



        /* RUN LOGGING LOGIC */

        //count
        if (args[args.length - 1].replace(/^\d{1,2}$/, '') == '') {
            console.log('found ' + args[args.length - 1]);
            count = args[args.length - 1]
            if (run.weight) count = count * run.weight
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
                        .addFields({ name: 'Current week:', value: run.toDisplay.map(c => ` \`${rows[0][c]}\` ${c.replace('currentweek', '')}`).join('\n') })
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
                                if (currentWeekEmbed.fields.length == 1) currentWeekEmbed.addFields([{name: 'Assists', value: s}])
                                else if (currentWeekEmbed.fields[currentWeekEmbed.fields.length - 1].value.length + s.length <= 1024) currentWeekEmbed.fields[currentWeekEmbed.fields.length - 1].value = currentWeekEmbed.fields[currentWeekEmbed.fields.length - 1].value.concat(`\n${s}`)
                                else currentWeekEmbed.addFields([{name: '** **', value: s}])
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
        const logChannel = message.guild.channels.cache.get(settings.channels.leadinglog)
        if (logChannel)
            logChannel.send({ embeds: [embed] })
        if (!toUpdate) return

        if (quotas[message.guild.id]) {
            const runQuota = quotas[message.guild.id].quotas.filter(q => q.id == toUpdate)
            if (runQuota)
                quota.update(message.guild, db, bot, settings, quotas[message.guild.id], runQuota[0]);
        }
    }
}

function confirm(runInfo, message, count) {
    return new Promise(async (res, rej) => {
        const multiplier = runInfo.multiply === null ? 1 : runInfo.multiply;
        let confirmEmbed = new Discord.EmbedBuilder()
            .setColor(runInfo.color)
            .setTitle('Confirm')
            .setDescription(`Are you sure you want to log ${parseInt(count) * multiplier} ${runInfo.confirmSuffix}?`)
            .setFooter({ text: message.member.nickname })
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
        if (key.toLowerCase() == i.key.toLowerCase()) return i;
        if (i.alias.includes(key.toLowerCase())) return i
    }
    return null
}