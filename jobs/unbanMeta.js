const RepeatedJob = require('./jobs/RepeatedJob.js')
const iterServersWithQuery = require('./jobs/util.js').iterServersWithQuery

function tryUnsuspend(bot, row, isVetBan) {
    let settings = bot.settings[guildId]
    const guildId = row.guildid;
    const proofLogID = row.logmessage;
    const guild = bot.guilds.cache.get(guildId);
    const member = guild.members.cache.get(row.id);

    if (!member) {
        if (!isVetBan) guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${row.id}> has been unsuspended automatically. However, they are not in the server`)
        return bot.dbs[g.id].query(`UPDATE ${isVetBan ? "vetbans" : "suspensions"} SET suspended = false WHERE id = '${row.id}'`)
    }

    try {
        if (isVetBan) {
            await member.roles.remove(settings.roles.vetban)
            setTimeout(() => { member.roles.add(settings.roles.vetraider); }, 1000)
            setTimeout(() => {
                if (!member.roles.cache.has(settings.roles.vetraider))
                    member.roles.add(settings.roles.vetraider).catch(er => ErrorLogger.log(er, bot, g))
            }, 5000)
        } else {
            let roles = []
            const rolesString = row.roles;
            rolesString.split(' ').forEach(r => { if (r !== '') roles.push(r) })

            await member.edit({ roles: roles }).catch(er => ErrorLogger.log(er, bot, g))
            setTimeout(() => {
                if (member.roles.cache.has(settings.roles.tempsuspended))
                    member.edit({ roles: roles }).catch(er => ErrorLogger.log(er, bot, g))
            }, 5000)
        }
        const unsuspendPing = `<@!${row.id}> has been ${isVetBan ? "un-vet-banned" : "unsuspended"} automatically`;
        try {
            let messages = await guild.channels.cache.get(settings.channels.suspendlog).messages.fetch({ limit: 100 })
            let m = messages.get(proofLogID)
            if (!m) {
                guild.channels.cache.get(settings.channels.suspendlog).send(unsuspendPing)
            } else {
                let embed = new Discord.EmbedBuilder()
                embed.data = m.embeds.shift().data;
                embed.setColor('#00ff00')
                    .setDescription(embed.data.description.concat(`\nUn${isVetBan ? "-vet-banned" : "suspended"} automatically`))
                    .setFooter({ text: 'Unsuspended at' })
                    .setTimestamp(Date.now())
                    m.edit({ embeds: [embed] })
            }
        } catch (er) {
            guild.channels.cache.get(settings.channels.suspendlog).send(unsuspendPing)
        } finally {
            await bot.dbs[g.id].query(`UPDATE ${isVetBan ? "vetbans" : "suspensions"} SET suspended = false WHERE id = '${row.id}'`)
        }
    } catch (er) {
        ErrorLogger.log(er, bot, g)
    }
}

class UnbanVet extends RepeatedJob {
    run(bot) {
        const dbQuery = `SELECT * FROM vetbans WHERE suspended = true`;
        iterServersWithQuery(bot, dbQuery, function(bot, row) {
            if (Date.now() > parseInt(row.uTime)) {
                tryUnsuspend(bot, row, true)
            }
        })
    }
}

class Unsuspend extends RepeatedJob {
    run(bot) {
        const dbQuery = `SELECT * FROM suspensions WHERE suspended = true AND perma = false`;
        iterServersWithQuery(bot, dbQuery, function(bot, row) {
            if (Date.now() > parseInt(row.uTime)) {
                tryUnsuspend(bot, row, false)
            }
        })
    }
}

module.exports = { UnbanVet,  Unsuspend }
