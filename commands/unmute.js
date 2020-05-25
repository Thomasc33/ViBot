const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'unmute',
    description: 'Removes muted role from user',
    args: '<ign/mention/id>',
    role: 'Security',
    async execute(message, args, bot) {
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (member == null) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.member.roles.highest.position) {
            message.channel.send(`${member} has a role greater than or equal to you and cannot be unmuted by you`);
            return;
        }
        let muted = message.guild.roles.cache.find(r => r.name === 'Muted')
        if (!member.roles.cache.has(muted.id)) {
            message.channel.send(`${member} is not muted`)
            return;
        }
        member.roles.remove(muted.id).catch(er => ErrorLogger.log(er, bot))
        message.channel.send(`${member} has been unmuted`)
    }
}