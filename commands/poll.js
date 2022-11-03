const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError');
const emojis = require("../data/emojis.json")

module.exports = {
    name: 'poll',
    description: 'Puts a poll in a raid status channel',
    args: '<\`c/v\` -or- \`us/eu\` -or- \`r/a\` -or- \`exalts\`> -or- \`fc/n\`',
    requiredArgs: 1,
    role: 'eventrl',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (!settings) return message.channel.send('settings not setup')
        message.delete()
        switch (args[0].toLowerCase()) {
            case 'c/v':
                var embed = new Discord.EmbedBuilder()
                    .setColor('#fefefe')
                    .setTitle('Cult or Void?')
                    .setDescription(`<${botSettings.emote.malus}> or <${botSettings.emote.voidd}>`)
                    .setFooter({ text: `Started by ${message.guild.members.cache.get(message.author.id).nickname}` })
                var embedMessage = await message.channel.send({ embeds: [embed] });
                embedMessage.react(botSettings.emote.malus)
                    .then(embedMessage.react(botSettings.emote.voidd))
                    .then(embedMessage.react(botSettings.emote.Plane))
                    .then(embedMessage.react(botSettings.emote.Vial))
                return;
            case 'us/eu':
                var embed = new Discord.EmbedBuilder()
                    .setColor('#fefefe')
                    .setTitle('US or EU?')
                    .setDescription(`:flag_um: or :flag_eu:`)
                    .setFooter({ text: `Started by ${message.guild.members.cache.get(message.author.id).nickname}` })
                var embedMessage = await message.channel.send({ embeds: [embed] });
                embedMessage.react('🇺🇲')
                    .then(embedMessage.react(`🇪🇺`))
                break;
            case 'r/a':
                var embed = new Discord.EmbedBuilder()
                    .setColor('#fefefe')
                    .setTitle('Regular or Advanced?')
                    // .setDescription(`:flag_um: or :flag_eu:`)
                    .setFooter({ text: `Started by ${message.guild.members.cache.get(message.author.id).nickname}` })
                var embedMessage = await message.channel.send({ embeds: [embed] });
                embedMessage.react('🇷')
                    .then(embedMessage.react(`🇦`))
                break;
                case 'exalts':
                var embed = new Discord.EmbedBuilder()
                    .setColor('#fefefe')
                    .setTitle('Which exalted dungeon?')
                    .setDescription(`<${botSettings.emote.voidd}> or <${botSettings.emote.malus}> or <${botSettings.emote.shattersPortal}> or <${botSettings.emote.fungalPortal}> or <${botSettings.emote.nestPortal}>`)
                    .setFooter({ text: `Started by ${message.guild.members.cache.get(message.author.id).nickname}` })
                var embedMessage = await message.channel.send({ embeds: [embed] });
                embedMessage.react(botSettings.emote.voidd)
                    .then(embedMessage.react(botSettings.emote.malus))
                    .then(embedMessage.react(botSettings.emote.shattersPortal))
                    .then(embedMessage.react(botSettings.emote.fungalPortal))
                    .then(embedMessage.react(botSettings.emote.nestPortal))
                break;
                case 'fc/n':
                var embed = new Discord.EmbedBuilder()
                    .setColor('#fefefe')
                    .setTitle('Fungal or Nest?')
                    .setDescription(`<${botSettings.emote.fungalPortal}> or <${botSettings.emote.nestPortal}>`)
                    .setFooter({ text: `Started by ${message.guild.members.cache.get(message.author.id).nickname}` })
                var embedMessage = await message.channel.send({ embeds: [embed] });
                embedMessage.react(botSettings.emote.fungalPortal)
                    .then(embedMessage.react(botSettings.emote.nestPortal))
                break;
            default: message.channel.send("Poll Type not recognized. Please try again")
        }
    }
}