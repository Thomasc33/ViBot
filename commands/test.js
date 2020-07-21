const Discord = require('discord.js')
const realmeyescrape = require('../realmEyeScrape')
const points = require('./points')
module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'Developer',
    async execute(message, args, bot, db) {
        if (message.member.voice.channel.members) {
            let loggingQuery = `SELECT id FROM users WHERE `
            message.member.voice.channel.members.each(m => { loggingQuery += `id = '${m.id}' OR ` })
            loggingQuery = loggingQuery.substring(0, loggingQuery.length - 4)
            db.query(loggingQuery, (err, rows) => {
                if (err) return
                dbIds = []
                for (let i in rows) dbIds.push(rows[i].id)
                if (rows.length < message.member.voice.channel.members.size) {
                    let unlogged = message.member.voice.channel.members.keyArray().filter(e => !dbIds.includes(e))
                    console.log(unlogged)
                    for (let i in unlogged) {
                        console.log(i)
                    }
                }
            })
        }
    }
}