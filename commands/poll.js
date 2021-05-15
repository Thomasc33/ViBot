const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'poll',
    description: 'Puts a poll in a raid status channel',
    args: '<\`c/v\` -or- \`us/eu\`>',
    requiredArgs: 1,
    role: 'eventrl',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (!settings) return message.channel.send('settings not setup')
        switch (args[0].toLowerCase()) {
            case 'c/v':
                var embed = new Discord.MessageEmbed()
                    .setColor('#fefefe')
                    .setTitle('Cult or Void?')
                    .setDescription(`<${botSettings.emote.malus}> or <${botSettings.emote.voidd}>`)
                    .setFooter(`Started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                var embedMessage = await message.channel.send(embed);
                embedMessage.react(botSettings.emote.malus)
                    .then(embedMessage.react(botSettings.emote.voidd))
                    .then(embedMessage.react(botSettings.emote.Plane))
                    .then(embedMessage.react(botSettings.emote.Vial))
                return;
            case 'us/eu':
                var embed = new Discord.MessageEmbed()
                    .setColor('#fefefe')
                    .setTitle('US or EU?')
                    .setDescription(`:flag_um: or :flag_eu:`)
                    .setFooter(`Started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                var embedMessage = await message.channel.send(embed);
                embedMessage.react('🇺🇲')
                    .then(embedMessage.react(`🇪🇺`))
                break;
            default: message.channel.send("Poll Type not recognized. Please try again")
        }
        message.delete()
    }
}