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
        var embed = new Discord.EmbedBuilder().setAuthor({ name: message.member.displayName, iconURL: message.author.avatarURL() || undefined })
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
            db.query(`INSERT INTO loggedusage (logged, userid, guildid, utime) VALUES ('${run.name}', '${message.member.id}', '${message.guild.id}', '${Date.now()}')`);
            db.query(`UPDATE users SET ${run.main} = ${run.main} + ${count}, ${run.currentweek} = ${run.currentweek} + ${count} WHERE id = '${message.author.id}'`, (err, rows) => {
                //return if any errors
                if (err) { res(null); return message.channel.send(`Error: ${err}`) }

                db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                    if (err) { res(null); return message.channel.send(`Error: ${err}`) }
                    if (rows.length < 1) { res(null); return message.channel.send('Current week stats could not be retrived. However, run was still logged') }
                    currentWeekEmbed.setDescription(`Run Logged for ${`<@!${message.author.id}>`}${message.member.displayName ? ` \`${message.member.displayName}\`` : ''}`)
                        .addFields({ name: 'Current week:', value: run.toDisplay.map(c => ` \`${rows[0][c]}\` ${c.replace('currentweek', '').replace('rollingQuota', 'Rollover')}`).join('\n') })
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
                                let s = `<@!${m.id}>${m.displayName ? ` \`${m.displayName}\`` : ''}. Current week: ${rows[0][guildInfo.assist.currentweek]} Assists`
                                if (currentWeekEmbed.data.fields.length == 1) currentWeekEmbed.addFields([{name: 'Assists', value: s}])
                                else if (currentWeekEmbed.data.fields[currentWeekEmbed.data.fields.length - 1].value.length + s.length <= 1024) currentWeekEmbed.data.fields[currentWeekEmbed.data.fields.length - 1].value = currentWeekEmbed.data.fields[currentWeekEmbed.data.fields.length - 1].value.concat(`\n${s}`)
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
        if (currentWeekEmbed.data.description) message.channel.send({ embeds: [currentWeekEmbed] })
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
            .setFooter({ text: message.member.displayName })
            .setTimestamp()
        await message.channel.send({ embeds: [confirmEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(message.author.id)) {
                await confirmMessage.delete()
                return res(true)
            } else await confirmMessage.delete(); return res(false)
        })
    })
}

function getRunInfo(guildInfo, key) {
    for (let i of guildInfo.main) {
        if (key.toLowerCase() == i.key.toLowerCase()) return i;
        if (i.alias.includes(key.toLowerCase())) return i
    }
    return null
}