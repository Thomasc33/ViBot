const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError')
const eventFile = require('../data/events.json')

var bot
module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    requiredArgs: 1,
    args: '<c/v/fsv/event>',
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

        //normal execution
        if (message.channel.parent.name.toLowerCase() !== 'events') {
            let afkTemplates = require('../afkTemplates.json')
            let runType = null;
            switch (args[0].charAt(0).toLowerCase()) {
                case 'c':
                    runType = afkTemplates.cult;
                    break;
                case 'v':
                    runType = afkTemplates.void;
                    break;
                case 'f':
                    runType = afkTemplates.fullSkipVoid;
                    break;
                case 'x':
                    runType = afkTemplates.splitCult;
                    break;
                default:
                    if (message.member.roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles.vetrl).position) return message.channel.send('Run Type Not Recognized')
                    else runType = await getTemplate(message, afkTemplates, args[0]).catch(er => message.channel.send(`Unable to get template. Error: \`${er}\``))
                    break;
            }
            if (!runType) eventHC().catch(er => { message.channel.send('Run Type not recognized') })
        } else eventHC().catch(er => { message.channel.send(er) })

        async function eventHC() {
            return new Promise(async (res, rej) => {
                var eventType = args[0]
                if (!eventFile[eventType]) return rej("Event type unrecognized. Check ;events and try again")

                var event = eventFile[eventType]
                if (!event.enabled) return rej(`${event.name} is currently disabled.`);

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
                var embedMessage = await textChannel.send(embed);
                await eventReact(embedMessage, event);
                res()
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

async function getTemplate(message, afkTemplates, runType) {
    return new Promise(async (res, rej) => {
        if (afkTemplates[message.author.id] && afkTemplates[message.author.id][runType.toLowerCase()]) return res(afkTemplates[message.author.id][runType.toLowerCase()])
        else rej(`No templates for user under: ${runType}`)
    })
}