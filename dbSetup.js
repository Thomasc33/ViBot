const botSettings = require('./settings.json')
const dbSchemas = require('./data/schemas.json')
const mysql = require('mysql2')
const Discord = require('discord.js')
const loggingInfo = require('./data/loggingInfo.json')
const metrics = require('./metrics.js')
const { Point } = require('@influxdata/influxdb-client')

let dbs = null
const uniq_dbs = []

const verbose = !process.title.includes('runner')
let pool_id = 0

class DbWrap {
    #db
    #channel
    #pool_id

    constructor(db, bot, schema) {
        this.#db = db
        this.#pool_id = pool_id
        pool_id += 1
        const guild = bot.guilds.cache.get(loggingInfo.info.guildid)
        const channel_id = loggingInfo.info[schema == 'testinghalls' ? 'channelTestSql' : 'channelSql']
        this.#channel = guild.channels.cache.get(channel_id)
    }

    getPoolInternal() {
        return this.#db
    }

    query(query, params, cb) {
        let msg_fut
        let args
        if (!params || (!cb && typeof params == 'function')) {
            args = [query]
            cb = params
            msg_fut = this.#channel.send(`:alarm_clock: (${this.#pool_id}) Executing query \`${query}\` ${cb ? 'CB' : ''}`)
        } else {
            args = [query, params]
            msg_fut = this.#channel.send(`:alarm_clock: (${this.#pool_id}) Executing query \`${query}\` with params \`${params}\` ${cb ? 'CB' : ''}`)
        }
        const start = new Date()
        return this.#db.query(...args, (...resp) => {
            const runtime = new Date() - start
            if (cb) {
                cb(...resp)
            }
            if (Array.isArray(args[1])) {
                console.log('wp')
                metrics.writePoint(new Point('mysql_raw_querytimes')
                    .intField(args[0], runtime)
                    .tag('functiontype', 'sync'))
            }
            const resp_string = JSON.stringify(resp.slice(0, 2), null, 2)
            if (resp_string.length > 1500) {
                const attachment = new Discord.AttachmentBuilder(Buffer.from(resp_string), { name: 'query.txt' })
                msg_fut.then((msg) => { msg.edit(msg.content.replace(':alarm_clock:', `:white_check_mark: (${runtime}ms)`)); msg.reply({ content: `Execution complete in ${runtime}ms.`, files: [attachment] }) })
            } else {
                msg_fut.then((msg) => { msg.edit(msg.content.replace(':alarm_clock:', `:white_check_mark: (${runtime}ms)`)); msg.reply(`Execution complete in ${runtime}ms. Response:\n\`\`\`${resp_string}\`\`\``) })
            }
        })
    }

    promise() {
        const db_promise = this.#db.promise()
        const channel = this.#channel
        const pool_id = this.#pool_id
        return {
            async query(query, params, cb) {
                let msg_fut
                if (!params || (!cb && typeof params == 'function')) {
                    msg_fut = channel.send(`:alarm_clock: (${pool_id}) Executing query \`${query}\``)
                } else {
                    msg_fut = channel.send(`:alarm_clock: (${pool_id}) Executing query \`${query}\` with params \`${params}\``)
                }
                const start = new Date()
                const rv = await db_promise.query(query, params, cb)
                const runtime = new Date() - start
                if (Array.isArray(params)) {
                    console.log('wp2')
                    metrics.writePoint(new Point('mysql_raw_querytimes')
                        .intField(query, runtime)
                        .tag('functiontype', 'async'))
                }
                const resp_string = JSON.stringify(rv[0], null, 2)
                if (resp_string.length > 1500) {
                    const attachment = new Discord.AttachmentBuilder(Buffer.from(resp_string), { name: 'query.txt' })
                    msg_fut.then((msg) => { msg.edit(msg.content.replace(':alarm_clock:', `:white_check_mark: (${runtime}ms)`)); msg.reply({ content: `Execution complet in ${runtime}ms.`, files: [attachment] }) })
                } else {
                    msg_fut.then((msg) => { msg.edit(msg.content.replace(':alarm_clock:', `:white_check_mark: (${runtime}ms)`)); msg.reply(`Execution complete in ${runtime}ms. Response:\n\`\`\`${resp_string}\`\`\``) })
                }
                return rv
            }
        }
    }

    escape(...params) {
        return this.#db.escape(...params)
    }
}

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
            const pool = mysql.createPool(dbInfo)
            dbs[guildId] = new DbWrap(pool, bot, dbInfo.database)
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
