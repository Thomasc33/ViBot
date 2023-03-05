module.exports = {
    convert: function() {
        const events = require('./data/events.json')
        const converted = {}
        for (const key of Object.keys(events)) {
            console.log(key)
            const event = events[key];
            if (event.name)
                converted[key] = this.convertEvent(event);
        }
        fs.writeFileSync('./rework-events.json', JSON.stringify(converted, null, 4), err => { if (err) console.log(err) })

    },
    convertEvent: function(event) {
        const conversion = {
            runType: event.name,
            runName: event.name,
            aliases: event.aliases,
            enabled: !!event.enabled,
            keyEmoteID: event.keyEmojiId,
            vialEmoteID: event.portalEmojiId,
            pingRole: null,
            headcountEmote: event.portalEmojiId,
            headcountOnAfk: false,
            isSplit: false,
            vialReact: false,
            twoPhase: !!event.twoPhase,
            startDelay: 5000,
            vcCap: 45,
            timeLimit: 300,
            keyCount: 3,
            color: event.color,
            isExalt: !!event.isExalt,
            reacts: [],
            keyPopPoints: event.keyPopPoints,
            earlyLocationCost: 15,
            earlyLocationReacts: []
        }
        for (const key of Object.keys(reactMap)) {
            if (event[key]) {
                conversion.reacts.push(reactMap[key])
            }
        }

        return conversion;
    }
}

const reactMap1 = {
    "rushers": "720404844187353099",
    "stun": "723019533593608233",
    "ogmur": "723019533597802507",
    "fungal": "720404621331267697",
    "mseal": "701491230306992219",
    "brain": "701491229975773225",
    "stasis": "723018431275859969",
    "paralyze": "723019533560053761",
    "slow": "723019533580894279",
    "daze": "944786433082818591",
    "curse": "723019533681426472",
    "expose": "723019533555597332",
    "warrior": "701491230395072522",
    "paladin": "701491230298734642",
    "knight": "701491229925310575",
    "bard": "723018431586238532",
    "trickster": "723018431275728918",
    "priest": "723018431326322719",
    "aether": "720265038664826959"
}

const reactMap = {
    "rushers": "Plane",
    "stun": "Collo",
    "ogmur": "Ogmur",
    "fungal": "UTTomeoftheMushroomTriebs",
    "mseal": "MarbleSeal",
    "brain": "brain",
    "stasis": "mystic",
    "paralyze": "Paralyze",
    "slow": "Slow",
    "daze": "Qot",
    "curse": "Curse",
    "expose": "Expose",
    "warrior": "Warrior",
    "paladin": "Paladin",
    "knight": "Knight",
    "bard": "Bard",
    "trickster": "trickster",
    "priest": "Priest",
    "aether": "UTOrbofAether"
}