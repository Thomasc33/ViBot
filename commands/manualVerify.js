const Discord = require('discord.js')
module.exports = {
    name: 'manualverify',
    description: 'Manually verifies a user',
    role: 'security',
    alias: ['mv'],
    requiredArgs: 2,
    args: '<id/mention> <ign>',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        const sbvRole = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
        const raiderRole = message.guild.roles.cache.get(settings.roles.raider)
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) return message.channel.send("User not found")
        if (member.roles.cache.has(suspendedRole.id) || member.roles.cache.has(sbvRole.id)) return message.channel.send("User is suspended")
        await member.roles.add(raiderRole)
        if (member.roles.cache.has(settings.roles.eventraider)) await member.roles.remove(settings.roles.eventraider)
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
        message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
        message.channel.send(`${member} has been given ${raiderRole}`)
    }
}