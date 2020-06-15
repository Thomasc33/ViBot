const Discord = require('discord.js')

module.exports = {
    name: 'manualvetverify',
    description: 'Adds Veteran Raider Role to user',
    args: '<id/mention>',
    role: 'Security',
    alias: ['mvv'],
    execute(message, args, bot) {
        const vetBanRole = message.guild.roles.cache.find(r => r.name === 'Banned Veteran Raider');
        const vetRaiderRole = message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Developer").position) return;
        var member = message.mentions.members.first()
        if (member == null) {
            member = message.guild.members.cache.get(args[0]);
        }
        if (member == null) {
            message.channel.send("User not found")
            return;
        }
        if (member.roles.cache.has(vetBanRole.id)) {
            message.channel.send("User is vet banned")
            return;
        }
        member.roles.add(vetRaiderRole)
        let embed = new Discord.MessageEmbed()
            .setTitle('Manual Veteran Verify')
            .setDescription(member)
            .addField('User', member.displayName, true)
            .addField('Verified By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
        message.channel.send(`${member} has been given ${vetRaiderRole}`)
    }
}