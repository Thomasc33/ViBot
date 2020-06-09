const Discord = require('discord.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: "find",
    description: "Finds users from a nickname",
    args: '[Users]',
    role: 'Almost Raid Leader',
    execute(message, args, bot) {
        if (args.length == 0) return;
        var suspendedButVerifed = message.guild.roles.cache.find(r => r.name === "Suspended but Verified");
        var suspendedRole = message.guild.roles.cache.find(r => r.name === "Suspended");
        var notFoundString = ''
        //combines users into an array
        for (let i in args) {
            let u = '';
            u = args[i];

            var member = message.guild.members.cache.get(u)
            if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()));

            if (member == null) {
                if (notFoundString == '') notFoundString = `${u}`
                else notFoundString = notFoundString.concat(`${u}, `)

            } else {
                var embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setDescription(`Server member found with the nickname ${u}: <@!${member.id}>`)
                    .addFields(
                        { name: 'Highest Role', value: `<@&${member.roles.highest.id}>`, inline: true },
                        { name: 'Suspended', value: `❌`, inline: true },
                        { name: 'Voice Channel', value: 'Not Connected', inline: true }
                    );
                if (member.roles.cache.has(suspendedButVerifed.id)) {
                    embed.fields[1].value = `:white_check_mark: \n<@&${suspendedButVerifed.id}>`;
                    embed.setColor('#ff0000');
                }
                if (member.roles.cache.has(suspendedRole.id)) {
                    embed.fields[1].value = `:white_check_mark: \n<@&${suspendedRole.id}>`;
                    embed.setColor('#ff0000');
                }
                if (member.voice.channel != null) {
                    embed.fields[2].value = member.voice.channel.name;
                }
                message.channel.send(embed);
            }
        }
        if (notFoundString != '') {
            var embed = new Discord.MessageEmbed()
                .setColor('#ffff00')
                .setTitle('Users not found:')
                .setDescription(notFoundString);
            message.channel.send(embed)
        }
    }
}