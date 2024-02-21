import { createPool, FieldPacket, OkPacket, Pool, ProcedureCallPacket, Query, QueryError, QueryOptions, ResultSetHeader, RowDataPacket } from 'mysql2';
type QueryResult = OkPacket | OkPacket[] | ResultSetHeader | ResultSetHeader[] | RowDataPacket[] | RowDataPacket[][] | ProcedureCallPacket;
type QueryCallback = (err: QueryError | null, result: QueryResult, fields: FieldPacket[]) => any;

const botSettings = require('./settings.json');
const dbSchemas = require('./data/schemas.json');
const metrics = require('./metrics.js');
const { Point } = require('@influxdata/influxdb-client');

let dbs: DbWrap[] | null = null;
const uniqueDBs = [];

const verbose = !process.title.includes('runner');

class DbWrap {
    #db;

    constructor(db: Pool) {
        this.#db = db;
    }

    getPoolInternal() {
        return this.#db;
    }

    query(sql: string, values?: any[] | QueryCallback, callback?: QueryCallback): Query {
        if (!callback && typeof values == 'function') callback = values;
        if (!Array.isArray(values)) values = undefined;
        const start = Date.now();
        return this.#db.query(sql, values, (err, rows, fields) => {
            const runtime = Date.now() - start;
            callback?.(err, rows, fields);
            if (Array.isArray(values)) {
                const point = new Point('mysql_raw_querytimes')
                    .intField(sql, runtime)
                    .tag('functiontype', 'sync');
                if (err) point.stringField('error', err);
                metrics.writePoint(point);
            }
        });
    }

    promise() {
        const dbPromise = this.#db.promise();
        return {
            async query(sql: string, values?: any[] | QueryCallback, callback?: QueryCallback): Promise<[QueryResult, FieldPacket[]]> {
                if (!callback && typeof values == 'function') callback = values;
                if (!Array.isArray(values)) values = undefined;
                const start = Date.now();
                const { result, error } = await dbPromise.query(sql, values).then(result => ({ result })).catch(error => ({ error })) as { result?: [QueryResult, FieldPacket[]], error?: any };
                const runtime = Date.now() - start;
                if (Array.isArray(values)) {
                    const point = new Point('mysql_raw_querytimes')
                        .intField(sql, runtime)
                        .tag('functiontype', 'async');
                    if (error) point.stringField('error', error);
                    metrics.writePoint(point);
                }
                if (error) throw error;
                return result!;
            }
        };
    }

    escape(...params: any[]) {
        //@ts-ignore
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
            const pool = createPool(dbInfo);
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
    getDB(guildId: string) {
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
