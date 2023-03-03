const RepeatedJob = require('./jobs/RepeatedJob.js')
const ErrorLogger = require(`./lib/logError`)
const iterServersWithQuery = require('./jobs/util.js').iterServersWithQuery

class Mute extends RepeatedJob {
    run(bot) {
        iterServersWithQuery(bot, `SELECT * FROM mutes WHERE muted = true`, function(bot, row) {
            if (Date.now() > parseInt(row.uTime)) {
                const guildId = row.guildid;
                let settings = bot.settings[guildId]
                const guild = bot.guilds.cache.get(guildId);
                if (guild) {
                    const member = guild.members.cache.get(row.id);
                    if (!member) return bot.dbs[g.id].query(`UPDATE mutes SET muted = false WHERE id = '${row.id}'`)
                    try {
                        await member.roles.remove(settings.roles.muted)
                        await bot.dbs[g.id].query(`UPDATE mutes SET muted = false WHERE id = '${row.id}'`)
                    } catch (er) {
                        ErrorLogger.log(er, bot, g)
                    }
                }
            }
        })
    }
}

module.exports = { Mute }
