const botSettings = require('./settings.json');
const dbSchemas = require('./data/schemas.json');
const mysql = require('mysql2');
const metrics = require('./metrics.js');
const { Point } = require('@influxdata/influxdb-client');

let dbs = null;
const uniqueDBs = [];

const verbose = !process.title.includes('runner');

class DbWrap {
    #db;

    constructor(db) {
        this.#db = db;
    }

    getPoolInternal() {
        return this.#db;
    }

    query(query, params, cb) {
        let args;
        if (!params || (!cb && typeof params == 'function')) {
            args = [query];
            cb = params;
        } else {
            args = [query, params];
        }
        const start = new Date();
        return this.#db.query(...args, (err, ...results) => {
            const runtime = new Date() - start;
            if (cb) {
                cb(err, ...results);
            }
            if (Array.isArray(params)) {
                const point = new Point('mysql_raw_querytimes')
                    .intField(query, runtime)
                    .tag('functiontype', 'sync');
                if (err) point.stringField('error', err);
                metrics.writePoint(point);
            }
        });
    }

    promise() {
        const dbPromise = this.#db.promise();
        return {
            async query(query, params, cb) {
                const start = new Date();
                let error = null;
                let rv = null;
                try {
                    rv = await dbPromise.query(query, params, cb).catch(() => {});
                } catch (e) {
                    error = e;
                }
                const runtime = new Date() - start;
                if (Array.isArray(params)) {
                    const point = new Point('mysql_raw_querytimes')
                        .intField(query, runtime)
                        .tag('functiontype', 'async');
                    if (error) point.stringField('error', error);
                    metrics.writePoint(point);
                }

                if (error) throw error;
                return rv;
            }
        };
    }

    escape(...params) {
        return this.#db.escape(...params);
    }
}

async function setupConnections(bot) {
    dbs = {};

    const liveGuilds = bot.guilds.cache.filter((g) => !bot.emojiServers.includes(g.id) && !bot.devServers.includes(g.id));
    liveGuilds.filter((g) => !dbSchemas[g.id]).forEach((g) => { if (verbose) console.log(`Missing schema in schema.json for guild: ${g.id}`); });

    const dbInfos = [];

    Object.entries(dbSchemas).forEach(([guildId, dbConfig]) => {
        if (!bot.guilds.cache.some((g) => g.id == guildId)) {
            if (verbose) console.log(`Unused db configuration in schema.json for guild: ${guildId}`);
            return;
        }
        const dbInfo = {
            port: botSettings.defaultDbInfo.port || 3306,
            host: dbConfig.host || botSettings.defaultDbInfo.host,
            user: dbConfig.user || botSettings.defaultDbInfo.user,
            password: dbConfig.password || botSettings.defaultDbInfo.password,
            database: dbConfig.schema,
            maxIdle: 5
        };

        // If a different guild as an identical config, share the connection pool
        const matchingGuild = dbInfos.find(([info]) => Object.keys(info).every((k) => info[k] == dbInfo[k]));
        if (matchingGuild) {
            dbs[guildId] = dbs[matchingGuild[1]];
        } else {
            const pool = mysql.createPool(dbInfo);
            dbs[guildId] = new DbWrap(pool, bot, dbInfo.database);
            uniqueDBs.push(dbs[guildId]);
            dbInfos.push([dbInfo, guildId]);
            if (verbose) console.log(`Connected to database: ${dbConfig.schema}`);
        }
    });
}

async function init(bot) {
    // Guard so that this only runs once
    if (dbs !== null) return;
    await setupConnections(bot);
}

async function reconnectDontDoThis(bot) {
    const oldConns = Object.values(dbs);
    await setupConnections(bot);
    console.log(oldConns);
    oldConns.forEach(pool => pool._closed && pool.end(() => { }));
}

module.exports = {
    init,
    reconnectDontDoThis,
    getDB(guildId) {
        if (dbs === null) throw new Error("Can't get DB before initialization");
        return dbs[guildId];
    },
    guildSchema(guildId) {
        return dbSchemas[guildId].schema;
    },
    guildHasDb(guildId) {
        return Boolean(dbs[guildId]);
    },
    endAll() {
        uniqueDBs.forEach(db => {
            db.end();
        });
        dbs = null;
    }
};
