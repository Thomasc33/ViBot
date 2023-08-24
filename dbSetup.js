const botSettings = require('./settings.json')
const dbSchemas = require('./data/schemas.json')
const mysql = require('mysql2')

let dbs = null
const uniq_dbs = []

const verbose = !process.title.includes('runner')

async function setup_connections(bot) {
    dbs = {}

    const liveGuilds = bot.guilds.cache.filter((g) => !bot.emojiServers.includes(g.id) && !bot.devServers.includes(g.id))
    liveGuilds.filter((g) => !dbSchemas[g.id]).forEach((g) => { if (verbose) console.log(`Missing schema in schema.json for guild: ${g.id}`) })

    const dbInfos = []

    Object.entries(dbSchemas).forEach(([guildId, dbConfig]) => {
        if (!bot.guilds.cache.some((g) => g.id == guildId)) {
            if (verbose) console.log(`Unused db configuration in schema.json for guild: ${guildId}`)
            return
        }
        const dbInfo = {
            port: botSettings.defaultDbInfo.port || 3306,
            host: dbConfig.host || botSettings.defaultDbInfo.host,
            user: dbConfig.user || botSettings.defaultDbInfo.user,
            password: dbConfig.password || botSettings.defaultDbInfo.password,
            database: dbConfig.schema,
            maxIdle: 5
        }

        // If a different guild as an identical config, share the connection pool
        const matchingGuild = dbInfos.find(([info]) => Object.keys(info).every((k) => info[k] == dbInfo[k]))
        if (matchingGuild) {
            dbs[guildId] = dbs[matchingGuild[1]]
        } else {
            dbs[guildId] = mysql.createPool(dbInfo)
            uniq_dbs.push(dbs[guildId])
            dbInfos.push([dbInfo, guildId])
            if (verbose) console.log(`Connected to database: ${dbConfig.schema}`)
        }
    })
}

async function init(bot) {
    // Guard so that this only runs once
    if (dbs !== null) return
    await setup_connections(bot)
}

async function reconnect_dont_do_this(bot) {
    const old_conns = Object.values(dbs)
    await setup_connections(bot)
    console.log(old_conns)
    old_conns.forEach(pool => pool._closed && pool.end(() => {}))
}

module.exports = {
    init,
    reconnect_dont_do_this,
    getDB(guildId) {
        if (dbs === null) throw new Error("Can't get DB before initialization")

        return dbs[guildId]
    },
    guildSchema(guildId) {
        return dbSchemas[guildId].schema
    },
    guildHasDb(guildId) {
        return Boolean(dbs[guildId])
    },
    endAll() {
        uniq_dbs.forEach(db => {
            db.end()
        })
        dbs = null
    }
}
