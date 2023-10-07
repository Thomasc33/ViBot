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
    getNotes(guild, member, bot) {
        return logs[guild.id] ? `Types: ${logs[guild.id].main.map(log => log.key + ' (' + log.name + ')').join(', ')}` : 'No loginfo for this server'
    },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        let toUpdate = 0
        const embed = new Discord.EmbedBuilder().setAuthor({ name: message.member.displayName, iconURL: message.author.avatarURL() || undefined })
        const currentWeekEmbed = new Discord.EmbedBuilder()
        let count = 1
        let desc = '`Successful` Run'
        const promises = []

        // get log info
        const guildInfo = logs[message.guild.id]
        if (!guildInfo) return message.channel.send('Logging isn\'t setup on this server yet')
        const run = getRunInfo(guildInfo, args[0])
        if (!run) return message.channel.send('Run Type not recognized\n' + this.getNotes(message.guild.id))

        /* RUN LOGGING LOGIC */

        // count
        if (args[args.length - 1].replace(/^\d{1,2}$/, '') == '') {
            count = args[args.length - 1]
            if (run.weight) count *= run.weight
        }
        let assistCount = count

        // assists count
        if (settings.backend.isLogAssistsCapped) {
            if (assistCount > settings.numerical.logAssistsCap) {
                assistCount = settings.numerical.logAssistsCap
            }
        }

        // confirm if needed
        let confirmed = false
        if (run.confirm) confirmed = await confirm(run, message, count)
        else confirmed = true
        if (!confirmed) return

        // send query
        promises.push(new Promise(res => {
            db.query(`INSERT INTO loggedusage (logged, userid, guildid, utime, amount) VALUES ('${run.name}', '${message.member.id}', '${message.guild.id}', '${Date.now()}', '${count}')`)
            db.query(`UPDATE users SET ${run.main} = ${run.main} + ${count}, ${run.currentweek} = ${run.currentweek} + ${count} WHERE id = '${message.author.id}'`, (err, rows) => {
                // return if any errors
                if (err) { res(null); return message.channel.send(`Error: ${err}`) }

                db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                    if (err) { res(null); return message.channel.send(`Error: ${err}`) }
                    if (rows.length < 1) { res(null); return message.channel.send('Current week stats could not be retrived. However, run was still logged') }
                    currentWeekEmbed.setDescription(`Run Logged for ${`<@!${message.author.id}>`}${message.member.displayName ? ` \`${message.member.displayName}\`` : ''}`)
                        .addFields({ name: 'Current week:', value: run.toDisplay.map(c => ` \`${rows[0][c].toString().padStart(3, ' ')}\` ${c.replace('currentweek', '').replace('Currentweek', '').replace('CurrentWeek', '').replace('rollingQuota', 'Rollover').replace('currentWeek', '').replace('lead', '').replace('Lead', '')}`).join('\n') })
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

        // assists
        if (run.allowAssists && guildInfo.assist) {
            desc = desc.concat('\n')
            message.mentions.members.each(m => {
                promises.push(new Promise(res => {
                    if (m.id !== message.author.id) {
                        desc += `<@!${m.id}> `
                        db.query(`UPDATE users SET ${guildInfo.assist.main} = ${guildInfo.assist.main} + ${assistCount}, ${guildInfo.assist.currentweek} = ${guildInfo.assist.currentweek} + ${assistCount} WHERE id = ${m.id}`, (err, rows) => {
                            if (err) return res(null)
                            db.query(`SELECT ${guildInfo.assist.currentweek} FROM users WHERE id = '${m.id}'`, (err, rows) => {
                                const s = `<@!${m.id}>${m.displayName ? ` \`${m.displayName}\`` : ''}. Current week: ${rows[0][guildInfo.assist.currentweek]} Assists`
                                if (currentWeekEmbed.data.fields.length == 1) currentWeekEmbed.addFields([{ name: 'Assists', value: s }])
                                else if (currentWeekEmbed.data.fields[currentWeekEmbed.data.fields.length - 1].value.length + s.length <= 1024) currentWeekEmbed.data.fields[currentWeekEmbed.data.fields.length - 1].value = currentWeekEmbed.data.fields[currentWeekEmbed.data.fields.length - 1].value.concat(`\n${s}`)
                                else currentWeekEmbed.addFields([{ name: '** **', value: s }])
                                res(null)
                            })
                        })
                    }
                }))
            })
        }

        await Promise.all(promises)

        embed.setDescription(desc)
        if (currentWeekEmbed.data.description) message.channel.send({ embeds: [currentWeekEmbed] })
        const logChannel = message.guild.channels.cache.get(settings.channels.leadinglog)
        if (logChannel) {logChannel.send({ embeds: [embed] })}
        if (!toUpdate) return

        if (quotas[message.guild.id]) {
            const runQuota = quotas[message.guild.id].quotas.filter(q => q.id == toUpdate)
            if (runQuota.length) {quota.update(message.guild, db, bot, settings, quotas[message.guild.id], runQuota[0])}
        }
    }
}

async function confirm(runInfo, message, count) {
    const multiplier = runInfo.multiply === null ? 1 : runInfo.multiply
    const confirmEmbed = new Discord.EmbedBuilder()
        .setColor(runInfo.color)
        .setTitle('Confirm')
        .setDescription(`Are you sure you want to log ${parseInt(count) * multiplier} ${runInfo.confirmSuffix}?`)
        .setFooter({ text: message.member.displayName })
        .setTimestamp()
    const rv = await message.channel.send({ embeds: [confirmEmbed] }).then(async confirmMessage => {
        if (await confirmMessage.confirmButton(message.author.id)) {
            await confirmMessage.delete()
            return true
        }
        await confirmMessage.delete()
        return false
    })
    return rv
}

function getRunInfo(guildInfo, key) {
    for (const i of guildInfo.main) {
        if (key.toLowerCase() == i.key.toLowerCase()) return i
        if (i.alias.includes(key.toLowerCase())) return i
    }
    return null
}
