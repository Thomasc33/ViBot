const Discord = require('discord.js');

module.exports = {
    name: "find",
    description: "finds users from a nickname",
    execute(message, args, bot) {
        var suspendedButVerifed = message.guild.roles.cache.find(r => r.name === "Suspended but Verified");
        var suspendedRole = message.guild.roles.cache.find(r => r.name === "Suspended");

        //combines users into an array
        for (let i in args) {
            let u = '';
            u = args[i];
            let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()));

            if (member == null) {
                var embed = new Discord.MessageEmbed()
                    .setColor('#ffff00')
                    .setDescription(`I could not find anyone in the server with the nickname ${u}`);

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
            }
            message.channel.send(embed);

        }
    }
}