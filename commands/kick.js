const Discord = require('discord.js')

module.exports = {
    name: 'kick',
    execute(message, args, bot) {
        message.channel.send('Feature coming soon™️');
        return;
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Head Raid Leader").position) return;
        
        if (member == null) {
            member = message.guild.members.cache.get(args[0]);
        }
        var proof = ' ';
        for (i = 1; i < args.length; i++) {
            proof = proof.concat(args[i]) + ' ';
        }
        if (message.attachments.size != 0) {
            proof = proof.concat(` ${message.attachments.first().proxyURL}`)
        }
        message.channel.send(`Are you sure you want to kick ${member.nickname}? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', m => {
            if (m.author != message.author) return;
            try {
                if (m.content.toLowerCase().charAt(0) == 'y') {
                    message.channel.send(`Kicking now`);

                    let embed = new Discord.MessageEmbed()
                        .setTitle('User Kicked')
                        .setDescription(`<@!${member}>`)
                        .addField('User', member.nickname, true)
                        .addField('Kicked By', `<@!${m.author.id}>`, true)
                        .setTimestamp(Date.now());
                    message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
                    if (proof != ' ') {
                        message.guild.channels.cache.find(c => c.name === 'mod-logs').send(proof);
                    }
                }
            } catch (er) {
                message.channel.send("Error kicking user. Please try again")
                return;
            }
        })
    }
}
