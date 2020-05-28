const Discord = require('discord.js')
module.exports = {
    name: 'manualverify',
    description: 'Manually verifies a user',
    role: 'Security',
    alias: 'mv',
    args: '<id/mention> <ign>',
    async execute(message, args, bot) {
        message.channel.send('Feature has been disabled');
        return;
        const suspendedRole = message.guild.roles.cache.find(r => r.name === 'Suspended');
        const sbvRole = message.guild.roles.cache.find(r => r.name === 'Suspended but Verified');
        const raiderRole = message.guild.roles.cache.find(r => r.name === 'Verified Raider');
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
        await member.setNickname(args[1])
        let embed = new Discord.MessageEmbed()
            .setTitle('Manual Verify')
            .setDescription(member)
            .addField('User', member.displayName, true)
            .addField('Verified By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
        message.channel.send(`${member} has been given ${raiderRole}`)
    }
}