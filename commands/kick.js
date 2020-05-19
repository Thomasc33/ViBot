const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'kick',
    description: 'Kicks user from server and logs it',
    args: '<id/mention> <reason>',
    role: 'Security',
    execute(message, args, bot) {
        if(args.length == 0) return;
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) {
            message.channel.send(`You may not kick other staff members`);
            return;
        }
        var reason = ' ';
        for (i = 1; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' ';
        }
        message.channel.send(`Are you sure you want to kick ${member.displayName}? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', m => {
            if (m.author != message.author) return;
            try {
                if (m.content.toLowerCase().charAt(0) == 'y') {
                    message.channel.send(`Kicking now`);
                    member.send(`You have been kicked from ${message.guild.name} for:\n${reason}`)
                    member.kick(reason).catch(er => { ErrorLogger.log(er, bot); message.channel.send(`Could not kick because: \`${er.message}\``); return; })
                    let embed = new Discord.MessageEmbed()
                        .setTitle('User Kicked')
                        .setDescription(member)
                        .addField('User', member.displayName, true)
                        .addField('Kicked By', `<@!${m.author.id}>`, true)
                        .setTimestamp(Date.now());
                    message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
                    if (reason != ' ') {
                        message.guild.channels.cache.find(c => c.name === 'mod-logs').send(reason);
                    }
                    message.channel.send("Success")
                }
            } catch (er) {
                message.channel.send("Error kicking user. Please try again")
                return;
            }
        })
    }
}
