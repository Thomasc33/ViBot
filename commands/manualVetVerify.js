const Discord = require('discord.js')

module.exports = {
    name: 'manualvetverify',
    description: 'Adds Veteran Raider Role to user',
    args: '<id/mention>',
    requiredArgs: 1,
    role: 'security',
    alias: ['mvv'],
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        const vetBanRole = message.guild.roles.cache.get(settings.roles.vetban)
        const vetRaiderRole = message.guild.roles.cache.get(settings.roles.vetraider);
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) return message.channel.send("User not found")
        if (member.roles.cache.has(vetBanRole.id)) return message.channel.send("User is vet banned")
        member.roles.add(vetRaiderRole)
        let embed = new Discord.MessageEmbed()
            .setTitle('Manual Veteran Verify')
            .setDescription(member)
            .addField('User', member.displayName, true)
            .addField('Verified By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
        message.channel.send(`${member} has been given ${vetRaiderRole}`)
    }
}