const Discord = require('discord.js')

module.exports = {
    name: 'kick',
    description: 'Kicks user from server and logs it',
    args: '<id/mention> <reason>',
    role: 'Moderator',
    execute(message, args, bot) {
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Head Raid Leader").position) return;
        if (message.guild.members.cache.get(message.author.id).roles.highest.position <= message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) {
            message.channel.send(`You may not kick other staff members`);
            return;
        }
        var member = message.mentions.members.first()
        if (member == null) {
            member = message.guild.members.cache.get(args[0]);
        }
        var reason = ' ';
        for (i = 1; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' ';
        }
        message.channel.send(`Are you sure you want to kick ${member.nickname}? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', m => {
            if (m.author != message.author) return;
            try {
                if (m.content.toLowerCase().charAt(0) == 'y') {
                    message.channel.send(`Kicking now`);
                    try {
                        member.kick(reason)
                    } catch (er) {
                        message.channel.send("Could not kick because: " + er.message)
                    }
                    let embed = new Discord.MessageEmbed()
                        .setTitle('User Kicked')
                        .setDescription(member)
                        .addField('User', member.nickname, true)
                        .addField('Kicked By', `<@!${m.author.id}>`, true)
                        .setTimestamp(Date.now());
                    message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
                    if (reason != ' ') {
                        message.guild.channels.cache.find(c => c.name === 'mod-logs').send(reason);
                    }
                }
            } catch (er) {
                message.channel.send("Error kicking user. Please try again")
                return;
            }
        })
    }
}
