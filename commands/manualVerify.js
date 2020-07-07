const Discord = require('discord.js')
module.exports = {
    name: 'manualverify',
    description: 'Manually verifies a user',
    role: 'Security',
    alias: ['mv'],
    args: '<id/mention> <ign>',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.find(r => r.name === settings.psuspended);
        const sbvRole = message.guild.roles.cache.find(r => r.name === settings.tempsuspend);
        const raiderRole = message.guild.roles.cache.find(r => r.name === settings.raider);
        var member = message.mentions.members.first()
        if (member == null) {
            member = message.guild.members.cache.get(args[0]);
        }
        if (member == null) {
            message.channel.send("User not found")
            return;
        }
        if (member.roles.cache.has(suspendedRole.id) || member.roles.cache.has(sbvRole.id)) {
            message.channel.send("User is suspended")
            return;
        }
        await member.roles.add(raiderRole)
        let tag = member.user.tag.substring(0, member.user.tag.length - 5)
        let nick = ''
        if (tag == args[1]) {
            nick = args[1].toLowerCase()
            if (tag == nick) {
                nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
            }
        } else nick = args[1]
        await member.setNickname(nick)
        let embed = new Discord.MessageEmbed()
            .setTitle('Manual Verify')
            .setDescription(member)
            .addField('User', member.displayName, true)
            .addField('Verified By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        message.guild.channels.cache.find(c => c.name === settings.modlog).send(embed);
        message.channel.send(`${member} has been given ${raiderRole}`)
    }
}