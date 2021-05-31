const mysql = require('mysql')
const dbInfo = require('../database.json')
const dbs = {}

/**
 * Performs basic DB query on guild specific DB
 * @param {String} guildid 
 * @param {String} query 
 * @returns {Array} rows
 */
function query(guildid, query) {
    return new Promise((res, rej) => {
        if (!dbs[guildid]) rej(`Missing DB For guild: ${guildid}`)
        dbs[guildid].query(query, (err, rows) => {
            if (err) rej(err)
            else res(rows)
        })
    })
}


module.exports = {
    dbs,
    query
}