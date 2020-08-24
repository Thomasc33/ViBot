const Discord = require('discord.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: "find",
    description: "Finds users from a nickname",
    args: '[Users]',
    requiredArgs: 1,
    role: 'almostrl',
    execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (args.length == 0) return;
        var suspendedButVerifed = message.guild.roles.cache.get(settings.roles.tempsuspended)
        var suspendedRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        var notFoundString = ''
        let expelled = []
        //combines users into an array
        for (let i in args) {
            let u = args[i];
            db.query(`SELECT * FROM veriblacklist WHERE id = '${u}'`, (err, rows) => {
                if (rows.length > 0) expelled.push(u)
            })
            var member = message.guild.members.cache.get(u)
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()));
            if (!member) {
                if (notFoundString == '') notFoundString = `${u}`
                else notFoundString = notFoundString.concat(`, ${u}`)
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
        if (expelled.length > 0) {
            let expelledString = ''
            for (let i in expelled) {
                if (expelledString == '') expelledString = expelled[i]
                else expelledString += `, ${expelled[i]}`
            }
            let expelledEmbed = new Discord.MessageEmbed()
                .setColor(`#ff0000`)
                .setTitle(`The following users are expelled`)
                .setDescription(expelledString)
        }
    }
}