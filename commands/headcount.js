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
        let settings = bott.settings[message.guild.id]
        if (!(message.channel.parent.name.toLowerCase() === 'raiding' || message.channel.parent.name.toLowerCase() === 'veteran raiding' || message.channel.parent.name.toLowerCase() === 'events')) {
            return message.channel.send("Try again in a correct category");
        }
        bot = bott;
        var textChannel;
        if (message.channel.parent.name.toLowerCase() === 'veteran raiding') textChannel = message.guild.channels.cache.get(settings.channels.vetstatus)
        else if (message.channel.parent.name.toLowerCase() === 'raiding') textChannel = message.guild.channels.cache.get(settings.channels.raidstatus)
        else if (message.channel.parent.name.toLowerCase() === 'events') textChannel = message.guild.channels.cache.get(settings.channels.eventstatus)

        if (message.channel.parent.name.toLowerCase() !== 'events') {
            switch (args[0].charAt(0).toLowerCase()) {
                case 'c':
                    var embed = new Discord.MessageEmbed()
                        .setColor('#ff0000')
                        .setTitle(`Headcount for **Cult Run** started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                        .setDescription(`React with <${botSettings.emote.malus}> to participate.
                    React with <${botSettings.emote.LostHallsKey}> if you have a key and are willing to pop.
                    React with <${botSettings.emote.Plane}> if you plan on rushing.`)
                        .setTimestamp(Date.now());
                    var embedMessage = await textChannel.send(`@here`, embed);

                    cultReact(embedMessage);
                    break;
                case 'v':
                    var embed = new Discord.MessageEmbed()
                        .setColor('#8c00ff')
                        .setTitle(`Headcount for **Void Run** started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                        .setDescription(`React with <${botSettings.emote.voidd}> to participate.
                React with <${botSettings.emote.LostHallsKey}> if you have a key and are willing to pop.
                React with <${botSettings.emote.Vial}> if you have a vial.`)
                        .setTimestamp(Date.now());
                    var embedMessage = await textChannel.send(`@here`, embed);

                    voidReact(embedMessage);
                    break;
                case 'f':
                    var embed = new Discord.MessageEmbed()
                        .setColor('#8c00ff')
                        .setTitle(`Headcount for **Full-Skip Void** started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                        .setDescription(`React with <${botSettings.emote.SkipBoi}> to participate.
                    React with <${botSettings.emote.LostHallsKey}> if you have a key and are willing to pop.
                    React with <${botSettings.emote.Vial}> if you have a vial.
                    React with <${botSettings.emote.Brain}> if you are a brain trickster.
                    React with <${botSettings.emote.Mystic}> if you are a mystic.`)
                        .setTimestamp(Date.now());
                    var embedMessage = await textChannel.send(`@here`, embed);

                    fsvReact(embedMessage);
                    break;
                default:
                    message.channel.send("Poll Type not recognized. Please try again")
                    return;
            }
        } else {
            var eventType = args[0]
            if (!eventFile[eventType]) {
                message.channel.send("Event type unrecognized. Check ;events and try again")
                return;
            }
            var event = eventFile[eventType]
            if (!event.enabled) {
                message.channel.send(`${event.name} is currently disabled.`);
                return;
            }
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
            if (event.puri) embed.addField('Puri', `<${botSettings.emote.TomeofPurification}>`, true)
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

            eventReact(embedMessage, event);
        }
    }
}

async function eventReact(pingMessage, event) {
    await pingMessage.react(event.portalEmojiId)
    await pingMessage.react(event.keyEmojiId)
    if (event.rushers) await pingMessage.react(botSettings.emoteIDs.Plane)
    if (event.stun) await pingMessage.react(botSettings.emoteIDs.Collo)
    if (event.ogmur) await pingMessage.react(botSettings.emoteIDs.Ogmur)
    if (event.puri) await pingMessage.react(botSettings.emoteIDs.TomeofPurification)
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

async function cultReact(message) {
    message.react(botSettings.emote.malus)
        .then(message.react(botSettings.emote.LostHallsKey))
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .then(message.react(botSettings.emote.Plane))
        .catch(er => ErrorLogger.log(er, bot));
}
async function voidReact(message) {
    message.react(botSettings.emote.voidd)
        .then(message.react(botSettings.emote.LostHallsKey))
        .then(message.react(botSettings.emote.Vial))
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .catch(er => ErrorLogger.log(er, bot));
}
async function fsvReact(message) {
    message.react(botSettings.emote.SkipBoi)
        .then(message.react(botSettings.emote.LostHallsKey))
        .then(message.react(botSettings.emote.Vial))
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .then(message.react(botSettings.emote.Brain))
        .then(message.react(botSettings.emote.Mystic))
        .catch(err => ErrorLogger.log(er, bot));
}