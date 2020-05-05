const Discord = require('discord.js')

module.exports = {
    name: 'addalt',
    description: 'Adds the username of an alt to a user',
    execute(message, args, bot) {
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Developer").position) return;
        var member = message.mentions.members.first()
        if (member == null) {
            member = message.guild.members.cache.get(args.shift);
        } else { args.shift() }
        const mention = args.shift();
        const altName = args.shift();
        var proof = ' ';
        for (i = 2; i < args.length; i++) {
            proof = proof.concat(args[i]) + ' ';
        }
        if (message.attachments.size != 0) {
            proof = proof.concat(` ${message.attachments.first().proxyURL}`)
        }
        message.channel.send(`Are you sure you want to add the alt ${altName} to <@!${mention}>? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', message => {
            try {
                if (m.content.toLowerCase().charAt(0) == 'y') {
                    console.log(member.nickname)
                    member.setNickname(`${member.nickname} | ${altName}`);
                    let embed = new Discord.MessageEmbed()
                        .setTitle('Alt Added')
                        .setDescription(`<@!${mention}>`)
                        .addField('Main', member.nickname, true)
                        .addField('New Alt', altName, true)
                        .addField('Added By', `<@!${message.author.id}>`)
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
                message.channel.send('Error adding alt. `;addalt <id> <alt name> <proof>')
                console.log(er);
            }
        })

    }
}