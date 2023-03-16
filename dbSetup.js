const botSettings = require('./settings.json')
const dbSchemas = require('./data/schemas.json')
const mysql = require('mysql2')

let dbs = null
let uniq_dbs = []

module.exports = {
    async init(bot) {
        // Guard so that this only runs once
        if (dbs !== null) return
        dbs = {}

        let liveGuilds = bot.guilds.cache.filter((g) => !bot.emojiServers.includes(g.id) && !bot.devServers.includes(g.id))
        liveGuilds.filter((g) => !dbSchemas[g.id]).forEach((g) => console.log(`Missing schema in schema.json for guild: ${g.id}`))

        let dbInfos = []

        Object.entries(dbSchemas).forEach(([guildId, dbConfig]) => {
            if (!bot.guilds.cache.some((g) => g.id == guildId)) return console.log(`Unused db configuration in schema.json for guild: ${guildId}`)
            let dbInfo = {
                port: botSettings.defaultDbInfo.port || 3306,
                host: dbConfig.host || botSettings.defaultDbInfo.host,
                user: dbConfig.user || botSettings.defaultDbInfo.user,
                password: dbConfig.password || botSettings.defaultDbInfo.password,
                database: dbConfig.schema
            }

            // If a different guild as an identical config, share the connection pool
            let matchingGuild = dbInfos.find(([info, _]) => Object.keys(info).every((k) => info[k] == dbInfo[k]))
            if (matchingGuild) {
                dbs[guildId] = dbs[matchingGuild[1]]
            } else {
                dbs[guildId] = mysql.createPool(dbInfo)
                uniq_dbs.push(dbs[guildId])
                dbInfos.push([dbInfo, guildId])
                console.log(`Connected to database: ${dbConfig.schema}`)
            }
        })
    },
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
    },
}
