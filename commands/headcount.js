const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError')
const afkCheck = require('./afkCheck')
const eventAfk = require('./eventAfk')
const eventFile = require('../data/events.json')

var bot
module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    requiredArgs: 1,
    args: '<run type>',
    getNotes(guildid, member) {
        return `**Run Types:**\n*Regular Afk Checks:*\n${afkCheck.getNotes(guildid, member)}\n*Events:*\nSee \`;events\``
    },
    role: 'eventrl',
    async execute(message, args, bott) {
        //settings
        let settings = bott.settings[message.guild.id]
        if (![settings.categories.raiding, settings.categories.event, settings.categories.veteran].includes(message.channel.parent.name.toLowerCase())) return message.channel.send("Try again in a correct category");
        if (!bot) bot = bott;

        //get raid status
        var textChannel;
        if (message.channel.parent.name.toLowerCase() === settings.categories.veteran) textChannel = message.guild.channels.cache.get(settings.channels.vetstatus)
        else if (message.channel.parent.name.toLowerCase() === settings.categories.raiding) textChannel = message.guild.channels.cache.get(settings.channels.raidstatus)
        else if (message.channel.parent.name.toLowerCase() === settings.categories.event) textChannel = message.guild.channels.cache.get(settings.channels.eventstatus)

        //check to see if an event exists under args[0]
        if (message.channel.parent.name.toLowerCase() !== settings.categories.raiding && eventAfk.getEventType(args[0], eventFile)) return eventHC()
        if (message.channel.parent.name.toLowerCase() !== 'events') {
            let runType = afkCheck.getRunType(args[0].charAt(0).toLowerCase(), message.guild.id)
            if (!runType) return message.channel.send('Run Type not recognized')

            let embed = new Discord.MessageEmbed()
                .setAuthor(`Headcount for ${runType.runName} by ${message.member.nickname}`)
                .setDescription(`${runType.headcountEmote ? `React with ${bot.emojis.cache.get(runType.headcountEmote)} if you are coming\n` : ''}React with ${bot.emojis.cache.get(runType.keyEmoteID)} if you have a key\nOtherwise react with your gear/class choices below`)
                .setColor(runType.embed.color)
                .setTimestamp()
            if (message.author.avatarURL()) embed.author.iconURL = message.author.avatarURL()
            const pingRole = runType.pingRole || runType.rolePing;
            let m = await textChannel.send({ content: `${pingRole ? '<@&' + settings.roles[pingRole] + '> ' : ''}@here`, embeds: [embed] })
            if (runType.headcountEmote)
                m.react(runType.headcountEmote)
            await m.react(runType.keyEmoteID)
            if (runType.vialReact) await m.react(botSettings.emoteIDs.Vial)
            for (let i of runType.earlyLocationReacts) await m.react(i.emoteID)
            for (let i of runType.reacts) await m.react(i)

        } else eventHC().catch(er => { message.channel.send(er.toString()) })

        async function eventHC() {
            return new Promise(async (res, rej) => {
                var eventType = args[0]
                var event = eventAfk.getEventType(eventType, eventFile)
                if (!event) return rej('No event found')
                if (!event.enabled) return rej(`${event.name} is currently disabled.`);

                if (!event.name.toLowerCase().includes(['random', 'exalts'])) {
                    var embed = new Discord.MessageEmbed()
                        .setColor('#8c00ff')
                        .setTitle(`Headcount for ${event.name} started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                        .setDescription(`React with with emotes below to indicate what you have`)
                        .setTimestamp(Date.now())
                        .addField('Participate', `<${event.portalEmote}>`, true)
                        .addField('Key', `<${event.keyEmote}>`, true);
                    if (event.rushers) embed.addField('Rushers', `<${botSettings.emote.Plane}>`, true)
                    if (event.stun) embed.addField('Stun', `<${botSettings.emote.Collo}>`, true)
                    if (event.ogmur) embed.addField('(P)ogmur', `<${botSettings.emote.Ogmur}>`, true)
                    if (event.fungal) embed.addField('Fungal Tome', `<${botSettings.emote.UTTomeoftheMushroomTribes}>`, true)
                    if (event.mseal) embed.addField('Mseal', `<${botSettings.emote.MarbleSeal}>`, true)
                    if (event.brain) embed.addField('Decoy', `<${botSettings.emote.Brain}>`, true)
                    if (event.stasis) embed.addField('Mystic', `<${botSettings.emote.Mystic}>`, true)
                    if (event.parylize) embed.addField('Paralyze', `<${botSettings.emote.Paralyze}>`, true)
                    if (event.slow) embed.addField('Slow', `<${botSettings.emote.Slow}>`, true)
                    if (event.daze) embed.addField('Daze', `<${botSettings.emote.Qot}>`, true)
                    if (event.curse) embed.addField('Curse', `<${botSettings.emote.Curse}>`, true)
                    if (event.expose) embed.addField('Expose', `<${botSettings.emote.Expose}>`, true)
                    if (event.warrior) embed.addField('Warrior', `<${botSettings.emote.Warrior}>`, true)
                    if (event.paladin) embed.addField('Paladin', `<${botSettings.emote.Paladin}>`, true)
                    if (event.bard) embed.addField('Bard', `<${botSettings.emote.Bard}>`, true)
                    if (event.priest) embed.addField('Priest', `<${botSettings.emote.Priest}>`, true)
                    var embedMessage = await textChannel.send({ content: `@here ${event.rolePing ? `${settings.roles[event.rolePing] ? `<@&${settings.roles[event.rolePing]}>` : ''}` : ''}`, embeds: [embed] });
                    await eventReact(embedMessage, event);
                    res()
                } else {
                    if (event.name.toLowerCase() == 'random') { // to do
                        var embed = new Discord.MessageEmbed()
                            .setColor('#8c00ff')
                            .setTitle(`Headcount for ${event.name} started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                            .setDescription(`React with with emotes below to indicate what you have`)
                            .setTimestamp(Date.now())
                            .addField('Participate', `<${event.portalEmote}>`, true)
                            .addField('Key', `<${event.keyEmote}>`, true);
                        if (event.rushers) embed.addField('Rushers', `<${botSettings.emote.Plane}>`, true)
                        if (event.stun) embed.addField('Stun', `<${botSettings.emote.Collo}>`, true)
                        if (event.ogmur) embed.addField('(P)ogmur', `<${botSettings.emote.Ogmur}>`, true)
                        if (event.fungal) embed.addField('Fungal Tome', `<${botSettings.emote.UTTomeoftheMushroomTribes}>`, true)
                        if (event.mseal) embed.addField('Mseal', `<${botSettings.emote.MarbleSeal}>`, true)
                        if (event.brain) embed.addField('Decoy', `<${botSettings.emote.Brain}>`, true)
                        if (event.stasis) embed.addField('Mystic', `<${botSettings.emote.Mystic}>`, true)
                        if (event.parylize) embed.addField('Paralyze', `<${botSettings.emote.Paralyze}>`, true)
                        if (event.slow) embed.addField('Slow', `<${botSettings.emote.Slow}>`, true)
                        if (event.daze) embed.addField('Daze', `<${botSettings.emote.Qot}>`, true)
                        if (event.curse) embed.addField('Curse', `<${botSettings.emote.Curse}>`, true)
                        if (event.expose) embed.addField('Expose', `<${botSettings.emote.Expose}>`, true)
                        if (event.warrior) embed.addField('Warrior', `<${botSettings.emote.Warrior}>`, true)
                        if (event.paladin) embed.addField('Paladin', `<${botSettings.emote.Paladin}>`, true)
                        if (event.bard) embed.addField('Bard', `<${botSettings.emote.Bard}>`, true)
                        if (event.priest) embed.addField('Priest', `<${botSettings.emote.Priest}>`, true)
                        var embedMessage = await textChannel.send({ content: `@here ${event.rolePing ? `${settings.roles[event.rolePing] ? `<@&${settings.roles[event.rolePing]}>` : ''}` : ''}`, embeds: [embed] });
                        await eventReact(embedMessage, event);
                        res()
                    }
                    else if (event.name.toLowerCase() = 'exalts') {
                        var embed = new Discord.MessageEmbed()
                            .setColor('#8c00ff')
                            .setTitle(`Headcount for ${event.name} started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                            .setDescription(`React with with emotes below to indicate what you have`)
                            .setTimestamp(Date.now())
                            .addField('Nests', `To participate: <:nest:723001215407095899>\nIf you have a key: <:nestK:723001429693956106>`)
                            .addField('Fungals', `To participate: <:fungal:723001215696240660>\nIf you have a key: <:fungalK:723001429614395402>`)
                            .addField('Shatters', `To participate: <:shatters:723001214865899532>\nIf you have a key: <:shattersK:723001429903802478>`)
                        let embedMessage = await textChannel.send({ content: `@here ${settings.roles[shattsReact] ? `<@&${settings.roles[shattsReact]}>` : ''} ${settings.roles[fungalReact] ? `<@&${settings.roles[fungalReact]}>` : ''} ${settings.roles[nestReact] ? `<@&${settings.roles[nestReact]}>` : ''}`, embeds: [embed] })
                        await embedMessage.react('723001215407095899')
                        await embedMessage.react('723001215696240660')
                        await embedMessage.react('723001214865899532')
                        await embedMessage.react('723001429693956106')
                        await embedMessage.react('723001429614395402')
                        await embedMessage.react('723001429903802478')
                    }
                }
            })
        }
    }
}

async function eventReact(pingMessage, event) {
    await pingMessage.react(event.portalEmojiId)
    await pingMessage.react(event.keyEmojiId)
    if (event.rushers) await pingMessage.react(botSettings.emoteIDs.Plane)
    if (event.stun) await pingMessage.react(botSettings.emoteIDs.Collo)
    if (event.ogmur) await pingMessage.react(botSettings.emoteIDs.Ogmur)
    if (event.fungal) await pingMessage.react(botSettings.emoteIDs.UTTomeoftheMushroomTribes)
    if (event.mseal) await pingMessage.react(botSettings.emoteIDs.MarbleSeal)
    if (event.brain) await pingMessage.react(botSettings.emoteIDs.brain)
    if (event.stasis) await pingMessage.react(botSettings.emoteIDs.mystic)
    if (event.parylize) await pingMessage.react(botSettings.emoteIDs.Paralyze)
    if (event.slow) await pingMessage.react(botSettings.emoteIDs.Slow)
    if (event.daze) await pingMessage.react(botSettings.emoteIDs.Qot)
    if (event.curse) await pingMessage.react(botSettings.emoteIDs.Curse)
    if (event.expose) await pingMessage.react(botSettings.emoteIDs.Expose)
    if (event.warrior) await pingMessage.react(botSettings.emoteIDs.Warrior)
    if (event.paladin) await pingMessage.react(botSettings.emoteIDs.Paladin)
    if (event.bard) await pingMessage.react(botSettings.emoteIDs.Bard)
    if (event.priest) await pingMessage.react(botSettings.emoteIDs.Priest)
}