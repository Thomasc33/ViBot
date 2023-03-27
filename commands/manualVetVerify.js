const Discord = require('discord.js')
const { manualVetVerifyLog } = require('../commands/vetVerification.js')
module.exports = {
    name: 'manualvetverify',
    description: 'Adds Veteran Raider Role to user',
    args: '<id/mention>',
    requiredArgs: 1,
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    alias: ['mvv'],
    execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const vetBanRole = message.guild.roles.cache.get(settings.roles.vetban)
        const vetRaiderRole = message.guild.roles.cache.get(settings.roles.vetraider);
        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send("User not found")
        if (member.roles.cache.has(vetBanRole.id)) return message.channel.send("User is vet banned")
        member.roles.add(vetRaiderRole)
        let embed = new Discord.EmbedBuilder()
            .setTitle('Manual Veteran Verify')
            .setDescription(member.toString())
            .addFields([{name: 'User', value: member.displayName, inline: true}])
            .addFields([{name: 'Verified By', value: `<@!${message.author.id}>`, inline: true}])
            .setTimestamp(Date.now());
        message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
        let confirmEmbed = new Discord.EmbedBuilder().setDescription(`${member} has been given ${vetRaiderRole}`)
        message.channel.send({ embeds: [confirmEmbed] })
        manualVetVerifyLog(message, message.author.id, bot, db)
    }
}