const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'changename',
    description: 'Changes the name of a user and logs it automatically',
    alias: ['cn'],
    args: '<User id/mention> <new name> <proof>',
    requiredArgs: 2,
    role: 'security',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length == 0) return;
        var member = message.mentions.members.first()
        if (member == null) {
            member = message.guild.members.cache.get(args.shift());
        } else { args.shift() }
        const altName = args.shift();
        let image = message.attachments.first().proxyURL
        if (!image) image = args[2]
        if (!image) return message.channel.send(`Please provide an image`)
        if (!validURL(image)) return message.channel.send(`Error attaching the image. Please try again`)
        message.channel.send(`Are you sure you want to change <@!${member.id}> to ${altName}? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', m => {
            if (m.author != message.author) return;
            try {
                if (m.content.toLowerCase().charAt(0) == 'y') {
                    member.setNickname(altName);
                    let embed = new Discord.MessageEmbed()
                        .setTitle('Name Changed')
                        .setDescription(`<@!${member.id}>`)
                        .addField('Old Name', member.nickname, true)
                        .addField('New Name', altName, true)
                        .addField('Change By', `<@!${m.author.id}>`)
                        .setTimestamp(Date.now())
                        .setImage(image)
                    message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
                    message.react('✅')
                    collector.stop()
                } else {
                    message.channel.send('Response not recognized. Please try again');
                    return;
                }
            } catch (er) {
                message.channel.send('Error changing name. `;changename <id> <alt name> <proof>')
                ErrorLogger.log(er, bot)
            }
        })

    }
}