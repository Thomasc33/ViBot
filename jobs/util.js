const ErrorLogger = require('../lib/logError')
const { getDB, guildSchema } = require('../dbSetup.js')

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
        const db = getDB(g.id)
        if (db && !checked.includes(guildSchema(g.id))) {
            checked.push(guildSchema(g.id)) // Prevents people from being unsuspended twice
            try {
                const [rows,] = await db.promise().query(query)
                await Promise.all(rows.map(row => Promise.resolve(f(bot, row, g))))
            } catch (err) {
                ErrorLogger.log(err, bot, g)
            }
        }
    })
}

module.exports = { iterServersWithQuery, iterServers }
