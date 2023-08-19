const ErrorLogger = require('./logError')
const express = require('express')
const { getDB } = require('../dbSetup.js')
const router = express.Router()
const afkKeysToRemove = new Set(['location', 'raidCommandsEmbed', 'raidCommandsMessage', 'raidInfoEmbed', 'raidInfoMessage', 'raidChannelsEmbed', 'raidChannelsMessage', 'message', 'guild', 'leader'])

router.get('/', function (req, res) {
    res.status(200).json({ message: ':)' });
});

router.get('/user/id/:uid', (req, res) => {
    const { bot } = require('../index')
    const db = getDB('343704644712923138')
    if (!db) return res.status(500).json({ message: 'DB Not Initiated' })

    let id = req.params.uid
    if (!id || id == '' || isNaN(id)) return res.status(402).json({ code: 402, message: 'UID Invalid' })

    db.query(`SELECT * FROM users WHERE id = '${id}'`, (err, rows) => {
        if (err) return ErrorLogger.log(err, bot)
        if (!rows || rows.length == 0) {
            res.status(403)
            res.json({ code: 403, message: 'User not found' })
            return
        }
        let data = {
            id: rows[0].id,
            eventruns: rows[0].eventruns,
            keypops: rows[0].keypops,
            eventpops: rows[0].eventpops,
            cultsLead: rows[0].cultsLead,
            voidsLead: rows[0].voidsLead,
            assists: rows[0].assists,
            currentweekCult: rows[0].currentweekCult,
            currentweekVoid: rows[0].currentweekVoid,
            currentweekAssists: rows[0].currentweekAssists,
            solocult: rows[0].solocult,
            vialStored: rows[0].vialStored,
            vialUsed: rows[0].vialUsed,
            cultRuns: rows[0].cultRuns,
            voidRuns: rows[0].voidRuns,
            isVet: rows[0].isVet,
            eventsLead: rows[0].eventsLead,
            currentweekEvents: rows[0].currentweekEvents,
            o3runs: rows[0].o3runs,
            o3leads: rows[0].o3leads,
            points: rows[0].points,
            lastnitrouse: rows[0].lastnitrouse,
            shieldRunePops: rows[0].shieldRunePops,
            swordRunePops: rows[0].swordRunePops,
            helmetRunePops: rows[0].helmetRunePops,
            currentweeko3: rows[0].currentweeko3,
            assistso3: rows[0].assistso3,
            currentweekAssistso3: rows[0].currentweekAssistso3,
            isRusher: rows[0].isRusher,
            veriBlacklisted: rows[0].veriBlacklisted,
            o3eventsLead: rows[0].o3eventsLead,
            currentweekEventso3: rows[0].currentweekEventso3
        }
        return res.status(200).json(data)
    })
})

router.get('/user/nick/:uid/:guild', (req, res) => {
    const { bot } = require('../index')
    const db = getDB('343704644712923138')

    if (!bot) return res.status(400).json(JSON.stringify('Bot not instantiated'))
    if (!db) return res.status(500).json(JSON.stringify('DB not found'))

    let guildid = req.params.guild
    if (!guildid || isNaN(guildid) || guildid == '') return res.status(402).json({ code: 402, message: 'Guild ID Invalid' })

    let uid = req.params.uid
    if (!uid || uid == '') return res.status(402).json({ code: 402, message: 'UID Invalid' })

    let guild = bot.guilds.cache.get(guildid)
    if (!guild) return res.status(403).json({ code: 403, message: 'Guild Not Found' })

    let member = guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(uid.toLowerCase()));
    if (!member) return res.status(403).json({ code: 403, message: 'User not found' })

    db.query(`SELECT * FROM users WHERE id = '${member.id}'`, (err, rows) => {
        if (err) return ErrorLogger.log(err, bot)
        if (!rows || rows.length == 0) {
            res.status(403)
            res.json({ code: 403, message: 'User not found' })
            return
        }
        let data = {
            nick: member.nickname,
            id: rows[0].id,
            eventruns: rows[0].eventruns,
            keypops: rows[0].keypops,
            eventpops: rows[0].eventpops,
            cultsLead: rows[0].cultsLead,
            voidsLead: rows[0].voidsLead,
            assists: rows[0].assists,
            currentweekCult: rows[0].currentweekCult,
            currentweekVoid: rows[0].currentweekVoid,
            currentweekAssists: rows[0].currentweekAssists,
            solocult: rows[0].solocult,
            vialStored: rows[0].vialStored,
            vialUsed: rows[0].vialUsed,
            cultRuns: rows[0].cultRuns,
            voidRuns: rows[0].voidRuns,
            isVet: rows[0].isVet,
            eventsLead: rows[0].eventsLead,
            currentweekEvents: rows[0].currentweekEvents,
            o3runs: rows[0].o3runs,
            o3leads: rows[0].o3leads,
            points: rows[0].points,
            lastnitrouse: rows[0].lastnitrouse,
            shieldRunePops: rows[0].shieldRunePops,
            swordRunePops: rows[0].swordRunePops,
            helmetRunePops: rows[0].helmetRunePops,
            currentweeko3: rows[0].currentweeko3,
            assistso3: rows[0].assistso3,
            currentweekAssistso3: rows[0].currentweekAssistso3,
            isRusher: rows[0].isRusher,
            veriBlacklisted: rows[0].veriBlacklisted
        }
        return res.status(200).json(data)
    })
})

router.get('/members/:guild', (req, res) => {
    const { bot } = require('../index')

    if (!bot) return res.status(400).json(JSON.stringify('Bot not instantiated'))

    let guildid = req.params.guild
    if (!guildid || isNaN(guildid) || guildid == '') return res.status(402).json({ code: 402, message: 'Guild ID Invalid' })

    let guild = bot.guilds.cache.get(guildid)
    if (!guild) return res.status(403).json({ code: 403, message: 'Guild Not Found' })

    if (!req.body || !(req.body instanceof Array)) return res.status(400).json("400 Bad Request")

    // remove duplicate ids before proceeding
    let ids = [...new Set(req.body)];

    // limit the api to only 100 ids at a time, should be the ceiling for each raid.
    if (!ids || ids.length == 0 || ids.length > 100) return res.status(400).json("400 Bad Request")

    let members = []

    for (let i = 0; i < ids.length; i++) {
        // ignore invalid ids
        if (!(typeof ids[i] == 'string') || ids[i] == '' || isNaN(ids[i])) continue
        
        let member = guild.members.cache.find(user => user.id.includes(ids[i]));
        
        if (!member) continue

        members.push({
            "id": member.id,
            "nickname": member.nickname,
            "avatar": member.user.displayAvatarURL({ extension: 'png', size: 128 }),
            "roles": member.roles.cache.map(role => role.id),
            "vc": member.voice.channel == null ? null : { "name": member.voice.channel.name, "id": member.voice.channel.id },
            "deaf": member.voice.deaf == null ? false : member.voice.deaf
        })
    }
    res.status(200).json(members)
})

router.get('/afkchecks', (req, res) => {
    const { bot } = require('../index')
    let afkChecks = { ...bot.afkChecks }
    return res.status(200).json(Object.fromEntries(
        Object.entries(afkChecks).map(([key, value]) => {
            let newValue = Object.fromEntries(
                Object.entries(value).filter(([k]) => !afkKeysToRemove.has(k))
            );
            return [key, newValue];
        })
    ))
})

router.post('/currentweek/update', (req, res) => {
    const { bot } = require('../index')

    if (!req.body) return res.status(400).json(JSON.stringify('No body'))
    if (!req.body.guildid) return res.status(400).json(JSON.stringify('No guildid'))

    if (!req.body.currentweektype) return res.status(400).json(JSON.stringify('No currentweektype'))

    let found = false
    for (let i of bot.guilds.cache.keys()) if (i == req.body.guildid) found = true
    if (!found) {
        res.status(400)
        return res.json(JSON.stringify('Bad guildid'))
    }
    let guild = bot.guilds.cache.get(req.body.guildid)
    let currentweektypes = ['currentweek', 'eventcurrentweek', 'parsecurrentweek']
    let index = req.body.currentweektype
    if (isNaN(parseInt(index)) || parseInt(index) >= currentweektypes.length) {
        res.status(400)
        return res.json(JSON.stringify('Bad currentweektype'))
    }
    let currentweektype = currentweektypes[parseInt(index)]
    if (!bot.settings[guild.id].backend[currentweektype]) {
        res.status(403)
        return res.json(JSON.stringify('Currentweek type disabled'))
    }
    switch (parseInt(index)) {
        case 0:
            currentWeek.update(guild, getDB(guild.id), bot)
            res.status(200)
            return res.json(JSON.stringify('Success'))
        case 1:
            ecurrentWeek.update(guild, getDB(guild.id), bot)
            res.status(200)
            return res.json(JSON.stringify('Success'))
        case 2:
            pcurrentWeek.update(guild, getDB(guild.id), bot)
            res.status(200)
            return res.json(JSON.stringify('Success'))
        default:
            res.status(404)
            return res.json(JSON.stringify('Default statement hit on currentweek type'))
    }
})

module.exports = router
