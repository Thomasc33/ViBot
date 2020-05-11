const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')
var bot
module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: 'hc',
    args: '<c/v/fsv>',
    role: 'Almost Raid Leader',
    async execute(message, args, bott) {
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again in dylanbot-commands or veteran-bot-commands");
            return;
        }
        bot = bott;
        var textChannel;
        if (message.channel.name == 'veteran-bot-commands') {
            textChannel = message.guild.channels.cache.find(c => c.name === 'veteran-status-announcements');
        } else {
            textChannel = message.guild.channels.cache.find(c => c.name === 'raid-status-announcements');
        }

        switch (args[0].charAt(0).toLowerCase()) {
            case 'c':
                var embed = new Discord.MessageEmbed()
                    .setColor('#ff0000')
                    .setTitle(`Headcount for **Cult Run** started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                    .setDescription(`React with <${botSettings.emote.malus}> to participate.
                    React with <${botSettings.emote.LostHallsKey}> if you have a key and are willing to pop.
                    React with <${botSettings.emote.Plane}> if you plan on rushing.`)
                    .setTimestamp(Date.now());
                var embedMessage = await textChannel.send(embed);

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
                var embedMessage = await textChannel.send(embed);

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
                var embedMessage = await textChannel.send(embed);

                fsvReact(embedMessage);
                break;
            default:
                message.channel.send("Poll Type not recognized. Please try again")
                return;
        }
    }
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