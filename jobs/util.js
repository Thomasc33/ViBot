const ErrorLogger = require('../lib/logError')

async function iterServers(bot, f) {
    await Promise.all(bot.guilds.cache.map(g => {
        if (bot.emojiServers.includes(g.id)) { return }
        if (bot.devServers.includes(g.id)) { return }
        return Promise.resolve(f(bot, g))
    }))
}

async function iterServersWithQuery(bot, query, f) {
    const checked = []
    await iterServers(bot, async (bot, g) => {
        if (bot.dbs[g.id] && !checked.includes(bot.dbs[g.id].config.databse)) {
            checked.push(bot.dbs[g.id].config.databse) // Prevents people from being unsuspended twice
            try {
                const rows = await bot.dbs[g.id].promise().query(query)
                await Promise.all(rows.map(row => Promise.resolve(f(bot, row, g))))
            } catch (err) {
                ErrorLogger.log(err, bot, g)
            }
        }
    })
}

module.exports = { iterServersWithQuery, iterServers }
