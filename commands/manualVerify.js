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
        const raiderRole = message.guild.roles.cache.get(settings.roles.raider)
        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) return message.channel.send("User not found")
        if (member.roles.cache.has(suspendedRole.id) || member.roles.cache.has(sbvRole.id)) return message.channel.send("User is suspended")
        if (member.roles.cache.has(raiderRole.id)) return message.channel.send('User is already verified')
        if (member.roles.cache.has(settings.roles.eventraider)) await member.roles.remove(settings.roles.eventraider)
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
        message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
        message.channel.send(`${member} has been given ${raiderRole}`)
        member.user.send(`You have been verified on \`${message.guild.name}\`. Please head over to rules, faq, and raiding-rules channels to familiarize yourself with the server. Happy raiding`)
    }
}