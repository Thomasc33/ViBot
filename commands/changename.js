const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'changename',
    description: 'Changes the name of a user and logs it automatically',
    alias: ['cn'],
    args: '<User id/mention> <new name> <proof>',
    requiredArgs: 3,
    role: 'security',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length == 0) return;
        var member = message.mentions.members.first()
        if (member == null) {
            member = message.guild.members.cache.get(args.shift());
        } else { args.shift() }
        const altName = args.shift();
        var proof = ' ';
        for (i = 0; i < args.length; i++) {
            proof = proof.concat(args[i]) + ' ';
        }
        if (message.attachments.size != 0) {
            proof = proof.concat(` ${message.attachments.first().proxyURL}`)
        }
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
                        .setTimestamp(Date.now());
                    message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
                    if (proof != ' ') {
                        message.guild.channels.cache.get(settings.channels.modlogs).send(proof);
                    }
                    message.channel.send('Done!');
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