const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'poll',
    description: 'Puts a poll in a raid status channel',
    args: '<\`c/v\` -or- \`us/eu>\`',
    role: 'Almost Raid Leader',
    async execute(message, args, bot) {
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again in dylanbot-commands or veteran-bot-commands");
            return;
        }
        var textChannel;
        if (message.channel.name == 'veteran-bot-commands') {
            textChannel = message.guild.channels.cache.find(c => c.name === 'veteran-status-announcements');
        } else {
            textChannel = message.guild.channels.cache.find(c => c.name === 'raid-status-announcements');
        }

        switch (args[0].toLowerCase()) {
            case 'c/v':
                var embed = new Discord.MessageEmbed()
                    .setColor('#fefefe')
                    .setTitle('Cult or Void?')
                    .setDescription(`<${botSettings.emote.malus}> or <${botSettings.emote.voidd}>`)
                    .setFooter(`Started by ${message.guild.members.cache.get(message.author.id).nickname}`)

                var embedMessage = await textChannel.send(embed);

                embedMessage.react(botSettings.emote.malus)
                    .then(embedMessage.react(botSettings.emote.voidd))
                return;
            case 'us/eu':
                var embed = new Discord.MessageEmbed()
                    .setColor('#fefefe')
                    .setTitle('US or EU?')
                    .setDescription(`:flag_um: or :flag_eu:`)
                    .setFooter(`Started by ${message.guild.members.cache.get(message.author.id).nickname}`)

                var embedMessage = await textChannel.send(embed);

                embedMessage.react('🇺🇲')
                    .then(embedMessage.react(`🇪🇺`))
                break;
            default:
                message.channel.send("Poll Type not recognized. Please try again")
                break;
        }
    }
}