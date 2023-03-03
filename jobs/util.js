function iterServers(bot, f) {
    bot.guilds.cache.each(g => {
        if (bot.emojiServers.includes(g.id)) { return }
        if (bot.devServers.includes(g.id)) { return }
        f(bot, g)
    })
}

function iterServersWithQuery(bot, query, f) {
    let checked = []
    iterServers(bot, function(bot, g) {
        if (bot.dbs[g.id] && !checked.includes(bot.dbs[g.id].config.databse)) {
            checked.push(bot.dbs[g.id].config.databse) //prevents people from being unsuspended twice
            const dbQuery = isVets ? `SELECT * FROM vetbans WHERE suspended = true` : `SELECT * FROM suspensions WHERE suspended = true AND perma = false`;
            bot.dbs[g.id].query(dbQuery, async (err, rows) => {
                if (err) ErrorLogger.log(err, bot, g)
                for (let i in rows) {
                    f(bot, rows[i])
                }
            })
        }

    })
}

module.exports = { iterServersWithQuery, iterServers }
