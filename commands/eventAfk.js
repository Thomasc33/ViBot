const eventFile = require('../data/events.json')
const afkCheck = require('./afkCheck')
const botSettings = require('../settings.json')
const dbInfo = require('../data/database.json')
const oldStyleAfkGuilds = ['451171819672698920']
const emojis = require('../data/emojis.json')
module.exports = {
    name: 'eventafk',
    description: 'Starts a new style afk check for event dungeons',
    args: '<dungeon> [Location]',
    requiredArgs: 1,
    role: 'eventrl',
    alias: ['eafk'],
    async execute(message, args, bot, db, tokenDB) {
        //settings
        let settings = bot.settings[message.guild.id]

        //check for vet run
        var eventType = args[0]
        let event = getEventType(eventType, eventFile, message.guild.id)
        if (!event) return message.channel.send(`${eventType} does not exist.`);
        event = {
            ...event,
            isEvent: true,
            newChannel: !oldStyleAfkGuilds.includes(message.guild.id),
            postAfkCheck: !!oldStyleAfkGuilds.includes(message.guild.id),
            runLogName: event.runLogName,
            startDelay: 5000,
            vcCap: 45,
            timeLimit: 300,
            keyCount: 3,
            color: event.color,
            twoPhase: !!event.twoPhase,
            earlyLocationCost: 15,
            isAdvanced: settings.backend.allowAdvancedRuns && event.isAdvanced,
            twoPhase: !!event.twoPhase,
            keyPopPointsOverride: event.keyPopPoints,
            embed: {
                color: event.color,
                description: `To join, **click here** {voicechannel}\nIf you have a key react with <${event.keyEmote}>\nTo indicate your class or gear choices, react with ${event.reacts.map(m => `${bot.emojis.cache.get(botSettings.emoteIDs[m])}`).join(' ')}\nIf you have the role <@&${settings.roles.nitro}>${settings.roles.supporter ? `, <@&${settings.roles.supporter}>` : ''} react with <:nitro:701491230349066261> to get into VC`,
                thumbnail: event.thumbnail
            }
        }

        if (!event.pingRole) 'eventBoi'
        event.reacts = event.reacts.map(r => botSettings.emoteIDs[r])

        if (!event.earlyLocationReacts) event.earlyLocationReacts = [{
            "emoteID": "723018431275859969",
            "pointsGiven": 2,
            "limit": 3,
            "shortName": "mystic",
            "checkRealmEye": {
                "class": "mystic",
                "ofEight": "8",
                "mheal": "85",
                "orb": "2"
            }
        }];

        let isVet = message.channel.id == settings.channels.vetcommands;
        if (event.isAdvanced && !settings.backend.allowAdvancedRuns) return message.channel.send(`Advanced runs are not enabled for this server.`);
        if (!event.enabled) return message.channel.send(`${event.name} is currently disabled.`);

        //start afkcheck
        afkCheck.eventAfkExecute(message, args, bot, db, tokenDB, event, isVet)
    },
    getEventType,
    getMatchingEvents,
    getEventTypeFromServer
}

function getMatchingEvents(arg, events, id) {
    let event = []
    let guildSpecifics = []
    if (id && events[id]) for (let i in events[id])
        if (i.toLowerCase() == arg.toLowerCase() || (events[i].aliases && events[i].aliases.includes(arg.toLowerCase()))) { event.push(events[id][i]); guildSpecifics.push(events[id][i]) }

    for (let i in events) if (i.toLowerCase() == arg.toLowerCase() || (events[i].aliases && events[i].aliases.includes(arg.toLowerCase())))
        if (!event.filter(e => e.name == events[i].name).length)
            if (!guildSpecifics.filter(a => events[i].runName == a.name).length) event.push(events[i])

    return event
}

function getEventType(arg, events, id) {
    return getMatchingEvents(arg, events, id)[0]
}

function getEventTypeFromServer(char, guildid) {
    for (let i in eventFile[guildid]) {
        if (char.toLowerCase() == eventFile[guildid][i].symbol) return eventFile[guildid][i];
        if (eventFile[guildid][i].aliases) {
            if (eventFile[guildid][i].aliases.includes(char.toLowerCase())) return eventFile[guildid][i];
        }
    }
    return null
}

