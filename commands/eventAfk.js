const eventFile = require('../data/events.json')
const afkCheck = require('./afkCheck')
const botSettings = require('../settings.json')

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
        let isVet
        if (message.channel.id == settings.channels.eventcommands) isVet = false
        else if (message.channel.id == settings.channels.vetcommands) isVet = true
        else return;
        var eventType = args[0]
        let event = getEventType(eventType, eventFile)
        if (!event.enabled) return message.channel.send(`${event.name} is currently disabled.`);

        //create template from event info
        let eventTemplate = {
            isEvent: true,
            runType: event.name,
            runName: event.name,
            reqsImageUrl: "",
            keyEmoteID: event.keyEmojiId,
            vialEmoteID: event.portalEmojiId,
            isSplit: false,
            newChannel: true,
            vialReact: false,
            postAfkCheck: false,
            startDelay: 5000,
            vcCap: 50,
            timeLimit: 180,
            keyCount: 3,
            earlyLocationCost: 15,
            earlyLocationReacts: [{
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
            },

            ],
            reacts: [],
            embed: {
                color: event.color,
                description: `To join, **connect to the raiding channel by clicking its name**\nIf you have a key react with <${event.keyEmote}>\nTo indicate your class or gear choices, react with ${event.rushers ? `<${botSettings.emote.Plane}>` : ''} ${event.stun ? `<${botSettings.emote.Collo}>` : ''} ${event.ogmur ? `<${botSettings.emote.Ogmur}>` : ''} ${event.fungal ? `<${botSettings.emote.UTTomeoftheMushroomTribes}>` : ''} ${event.mseal ? `<${botSettings.emote.MarbleSeal}>` : ''} ${event.brain ? `<${botSettings.emote.Brain}>` : ''} ${event.mystic ? `<${botSettings.emote.Mystic}>` : ''} ${event.paralyze ? `<${botSettings.emote.Paralyze}>` : ''}${event.slow ? `<${botSettings.emote.Slow}>` : ''} ${event.daze ? `<${botSettings.emote.Qot}>` : ''} ${event.curse ? `<${botSettings.emote.Curse}>` : ''} ${event.expose ? `<${botSettings.emote.Expose}>` : ''} ${event.warrior ? `<${botSettings.emote.Warrior}>` : ''} ${event.paladin ? `<${botSettings.emote.Paladin}>` : ''} ${event.bard ? `<${botSettings.emote.Bard}>` : ''} ${event.priest ? `<${botSettings.emote.Priest}>` : ''} ${event.trickster ? `<${botSettings.emote.trickster}>` : ''} ${event.knight ? `<${botSettings.emote.Knight}>` : ''}\nIf you have the role <@&585533559280762888> react with <:nitro:701491230349066261> to get into VC`
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
        if (event.name.includes('Shatters')) {
            eventTemplate.reacts.push(botSettings.emoteIDs.switch1)
            eventTemplate.reacts.push(botSettings.emoteIDs.switch2)
            eventTemplate.reacts.push(botSettings.emoteIDs.switchS)
        }

        //keyCount
        if(event.keyCount) eventTemplate.keyCount = event.keyCount

        //keyPopPoints
        if(event.keyPopPoints) eventTemplate.keyPopPointsOverride = keyPopPoints

        //earlyLocationCost
        if(event.earlyLocationCost) eventTemplate.earlyLocationCost = earlyLocationCost

        //vcCap
        if(event.vcCap) eventTemplate.vcCap = event.vcCap

        //start afkcheck
        afkCheck.eventAfkExecute(message, args, bot, db, tokenDB, eventTemplate, isVet)
    },
    getEventType
}

function getEventType(arg, events) {
    for (let i in events) {
        if (i.toLowerCase() == arg.toLowerCase() || events[i].aliases.includes(arg.toLowerCase())) return events[i]
    }
}