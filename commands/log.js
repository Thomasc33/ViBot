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
    getNotes(guild) {
        return logs[guild.id] ? `Types: ${logs[guild.id].main.map(log => log.key + ' (' + log.name + ')').join(', ')}` : 'No loginfo for this server'
    },

    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const { member } = message
        const mentions = message.mentions.members.map(m => m).filter(m => m.id != member.id)

        const guildInfo = logs[message.guild.id]
        if (!guildInfo) return message.channel.send('Logging isn\'t setup on this server yet')

        const key = args[0].toLowerCase()
        const run = guildInfo.main.find(section => key == section.key.toLowerCase() || section.alias?.some(a => a.toLowerCase() == key))
        if (!run) return message.channel.send('Run Type not recognized\n' + this.getNotes(message.guild.id))

        const count = /^\d{1,2}$/.test(args[args.length - 1]) ? Number(args[args.length - 1]) : 1
        const assistCount = settings.backend.isLogAssistsCapped ? Math.min(count, settings.numerical.logAssistsCap) : count

        const confirmed = !run.confirm || await confirm(run, message, count)
        if (!confirmed) return

        const changes = [
            run,
            ...(run.additionalLogs || []).filter(add => add.roles.some(roles => roles.every(role => settings.roles[role] && member.roles.cache.get(settings.roles[role]))))
        ]

        const promises = [db.promise().query('INSERT INTO loggedusage (logged, userid, guildid, utime, amount) VALUES (?, ?, ?, ?, ?)', [run.name, member.id, member.guild.id, Date.now(), count])]
        changes.forEach(change => {
            const promise = db.promise().query('UPDATE users SET ?? = ?? + ? WHERE id = ?', [change.currentweek, change.currentweek, count, member.id])
                .then(() => change.main && db.promise().query('UPDATE users SET ?? = ?? + ? WHERE id = ?', [change.main, change.main, count, member.id]))
            promises.push(promise)
        })

        const toDisplay = changes.reduce((prev, next) => {
            if (next.overwriteDisplay) return [...next.toDisplay]
            prev.push(...next.toDisplay)
            return prev
        }, [])
        const toUpdate = changes.map(change => change.toUpdate).filter((v, i, a) => a.indexOf(v) === i)

        if (run.allowAssists && guildInfo.assist) {
            promises.push(...mentions.map(m =>
                db.promise().query('UPDATE users SET ?? = ?? + ?, ?? = ?? + ? WHERE id = ?', [guildInfo.assist.main, guildInfo.assist.main, assistCount, guildInfo.assist.currentweek, guildInfo.assist.currentweek, assistCount, m.id])
                    .then(() => db.promise().query('SELECT ?? FROM users WHERE id = ?', [guildInfo.assist.currentweek, m.id]))
                    .then(([[row]]) => ({ member: m, assisted: row[guildInfo.assist.currentweek] }))
                    .catch(() => {})
            ))
        }

        const results = await Promise.all(promises)
        const assists = results.filter(r => r?.member && r.assisted)

        const [[row]] = await db.promise().query('SELECT * FROM users WHERE id = ?', [member.id])

        const currentWeekEmbed = new Discord.EmbedBuilder()
            .setColor(run.color)
            .setThumbnail(run.icon || null)
            .setDescription(`Run Logged for ${member} \`${member.displayName}\``)
            .addFields({ name: 'Current week:', value: toDisplay.map(disp => ` \`${row[disp].toString().padStart(3, ' ')}\` ${disp.replaceAll(/currentweek|lead/gi, '').replace('rollingQuota', 'Rollover').deCamelCase()}`).join('\n') })

        if (run.icon) currentWeekEmbed.setThumbnail(run.icon)
        if (assists.length) currentWeekEmbed.addFields({ name: 'Assists', value: assists.map(a => `${a.member} \`${a.member.displayName}\`. Current week: ${a.assisted} Assists`).join('\n') })

        message.channel.send({ embeds: [currentWeekEmbed] })

        const leadingLogEmbed = new Discord.EmbedBuilder()
            .setAuthor({ name: message.member.displayName, iconURL: message.author.displayAvatarURL() })
            .setColor(run.color)
            .setDescription(run.desc || '`Successful` run')

        if (mentions.length) leadingLogEmbed.addFields({ name: 'Assists', value: mentions.join(' ') })

        message.guild.channels.cache.get(settings.channels.leadinglog)?.send({ embeds: [leadingLogEmbed] })

        const guildQuota = quotas[message.guild.id]
        if (guildQuota) {
            toUpdate.forEach(update => {
                const runQuota = guildQuota.quotas.filter(q => q.id == update)
                if (runQuota.length) quota.update(message.guild, db, bot, settings, guildQuota, runQuota)
            })
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
    return await message.channel.send({ embeds: [confirmEmbed] })
        .then(async confirmMessage => {
            const result = await confirmMessage.confirmButton(message.author.id)
            await confirmMessage.delete()
            return result
        })
}
