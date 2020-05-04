const Discord = require('discord.js')

module.exports = {
    name: 'changename',
    execute(message, args, bot) {
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Developer").position) return;
        const mention = args.shift();
        const altName = args.shift();
        var proof = ' ';
        for (i = 0; i < args.length; i++) {
            proof = proof.concat(args[i]) + ' ';
        }
        if (message.attachments.size != 0) {
            proof = proof.concat(` ${message.attachments.first().proxyURL}`)
        }
        var member = message.guild.members.cache.get(mention);
        message.channel.send(`Are you sure you want to change <@!${mention}> to ${altName}? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', m => {
            if (m.author != message.author) return;
            try {
                if (m.content.charAt(0) == 'y') {
                    member.setNickname(altName);
                    let embed = new Discord.MessageEmbed()
                        .setTitle('Name Changed')
                        .setDescription(`<@!${mention}>`)
                        .addField('Old Name', member.nickname, true)
                        .addField('New Name', altName, true)
                        .addField('Change By', `<@!${m.author.id}>`)
                        .setTimestamp(Date.now());
                    message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
                    if (proof != ' ') {
                        message.guild.channels.cache.find(c => c.name === 'mod-logs').send(proof);
                    }
                } else {
                    message.channel.send('Response not recognized. Please try suspending again');
                    return;
                }
            } catch (er) {
                message.channel.send('Error changing name. `;changename <id> <alt name> <proof>')
                console.log(er);
            }
        })

    }
}