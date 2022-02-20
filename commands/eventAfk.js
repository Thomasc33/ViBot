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

        let isVet
        if (event.isAdvanced && !settings.backend.allowAdvancedRuns) return message.channel.send(`Advanced runs are not enabled for this server.`);
        if (message.channel.id == settings.channels.eventcommands) isVet = false
        else if (message.channel.id == settings.channels.vetcommands) isVet = true
        else if (!(event.isExalt && settings.backend.exaltsInRSA && message.channel.id == settings.channels.raidcommands)) return;
        if (!event.enabled) return message.channel.send(`${event.name} is currently disabled.`);

        //create template from event info
        let eventTemplate = {
            isEvent: true,
            runType: event.name,
            runName: event.name,
            reqsImageUrl: event.reqsImageUrl || "",
            keyEmoteID: event.keyEmojiId,
            vialEmoteID: event.portalEmojiId,
            keyLogName: dbInfo[message.guild.id] ? dbInfo[message.guild.id].eventInfo.eventpops || null : null,
            isSplit: false,
            newChannel: oldStyleAfkGuilds.includes(message.guild.id) ? false : true,
            vialReact: false,
            postAfkCheck: oldStyleAfkGuilds.includes(message.guild.id) ? true : false,
            startDelay: 5000,
            vcCap: 45,
            timeLimit: 300,
            keyCount: 3,
            twoPhase: !!event.twoPhase,
            earlyLocationCost: 15,
            isAdvanced: settings.backend.allowAdvancedRuns && event.isAdvanced,
            isExalt: event.isExalt,
            earlyLocationReacts: event.earlyLocationReacts || [{
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
            }],
            reacts: [],
            embed: {
                color: event.color,
                description: `To join, **click here** {voicechannel}\nIf you have a key react with <${event.keyEmote}>\nTo indicate your class or gear choices, react with ${event.rushers ? `<${botSettings.emote.Plane}>` : ''} ${event.stun ? `<${botSettings.emote.Collo}>` : ''} ${event.ogmur ? `<${botSettings.emote.Ogmur}>` : ''} ${event.fungal ? `<${botSettings.emote.UTTomeoftheMushroomTribes}>` : ''} ${event.mseal ? `<${botSettings.emote.MarbleSeal}>` : ''} ${event.brain ? `<${botSettings.emote.Brain}>` : ''} ${event.mystic ? `<${botSettings.emote.Mystic}>` : ''} ${event.paralyze ? `<${botSettings.emote.Paralyze}>` : ''}${event.slow ? `<${botSettings.emote.Slow}>` : ''} ${event.daze ? `<${botSettings.emote.Qot}>` : ''} ${event.curse ? `<${botSettings.emote.Curse}>` : ''} ${event.expose ? `<${botSettings.emote.Expose}>` : ''} ${event.warrior ? `<${botSettings.emote.Warrior}>` : ''} ${event.paladin ? `<${botSettings.emote.Paladin}>` : ''} ${event.bard ? `<${botSettings.emote.Bard}>` : ''} ${event.priest ? `<${botSettings.emote.Priest}>` : ''} ${event.trickster ? `<${botSettings.emote.trickster}>` : ''} ${event.knight ? `<${botSettings.emote.Knight}>` : ''}\nIf you have the role <@&${settings.roles.nitro}> react with <:nitro:701491230349066261> to get into VC`
            },
        }
        eventTemplate['font-color'] = '#eeeeee'

        //add reacts to template
        if (event.rushers) eventTemplate.reacts.push(botSettings.emoteIDs.Plane)
        if (event.stun) eventTemplate.reacts.push(botSettings.emoteIDs.Collo)
        if (event.ogmur) eventTemplate.reacts.push(botSettings.emoteIDs.Ogmur)
        if (event.fungal) eventTemplate.reacts.push(botSettings.emoteIDs.UTTomeoftheMushroomTribes)
        if (event.mseal) eventTemplate.reacts.push(botSettings.emoteIDs.MarbleSeal)
        if (event.brain) eventTemplate.reacts.push(botSettings.emoteIDs.brain)
        if (event.stasis) eventTemplate.reacts.push(botSettings.emoteIDs.mystic)
        if (event.parylize) eventTemplate.reacts.push(botSettings.emoteIDs.Paralyze)
        if (event.slow) eventTemplate.reacts.push(botSettings.emoteIDs.Slow)
        if (event.daze) eventTemplate.reacts.push(botSettings.emoteIDs.Qot)
        if (event.curse) eventTemplate.reacts.push(botSettings.emoteIDs.Curse)
        if (event.expose) eventTemplate.reacts.push(botSettings.emoteIDs.Expose)
        if (event.warrior) eventTemplate.reacts.push(botSettings.emoteIDs.Warrior)
        if (event.paladin) eventTemplate.reacts.push(botSettings.emoteIDs.Paladin)
        if (event.bard) eventTemplate.reacts.push(botSettings.emoteIDs.Bard)
        if (event.priest) eventTemplate.reacts.push(botSettings.emoteIDs.Priest)
        if (event.trickster) eventTemplate.reacts.push(botSettings.emoteIDs.trickster)
        if (event.knight) eventTemplate.reacts.push(botSettings.emoteIDs.Knight)
        if (event.aether) eventTemplate.reacts.push(botSettings.emoteIDs.UTOrbofAether)

        if (event.name.includes('Shatters')) {
            eventTemplate.reacts.push(botSettings.emoteIDs.switch1)
            eventTemplate.reacts.push(botSettings.emoteIDs.switch2)
            eventTemplate.reacts.push(botSettings.emoteIDs.switchS)
        }

        //keyCount
        if (event.keyCount) eventTemplate.keyCount = event.keyCount

        //keyPopPoints
        if (event.keyPopPoints) eventTemplate.keyPopPointsOverride = event.keyPopPoints

        //earlyLocationCost
        if (event.earlyLocationCost) eventTemplate.earlyLocationCost = event.earlyLocationCost

        //vcCap
        if (event.vcCap) eventTemplate.vcCap = event.vcCap

        //ping Role
        if (event.rolePing) eventTemplate.pingRole = event.rolePing

        //start afkcheck
        afkCheck.eventAfkExecute(message, args, bot, db, tokenDB, eventTemplate, isVet)
    },
    getEventType,
    getMatchingEvents
}

function getMatchingEvents(arg, events, id) {
    let event = []
    if (id && events[id]) {
        for (let i in events[id]) {
            if (i.toLowerCase() == arg.toLowerCase() || (events[i].aliases && events[i].aliases.includes(arg.toLowerCase()))) event.push(events[id][i])
        }
    }
    for (let i in events) {
        if (i.toLowerCase() == arg.toLowerCase() || (events[i].aliases && events[i].aliases.includes(arg.toLowerCase()))) 
            if (!event.filter(e => e.name == events[i].name).length) event.push(events[i])
    }


    return event
}

function getEventType(arg, events, id) {
    return getMatchingEvents(arg, events, id)[0]
}

