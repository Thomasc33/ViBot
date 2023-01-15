const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');

module.exports = {
    name: 'test',
    description: 'Holds testing code',
    args: [],
    requiredArgs: 0,
    getNotes(guildId, member) {
        return ''
    },
    guildSpecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first() || message.guild.members.cache.get(args[0])
        if (!member) return message.channel.send('User not found in the server')
        let notes = this.getNotes(message.guild.id, member)
        let embed = new Discord.MessageEmbed()
            .setTitle('User Info')
            .setDescription(member.toString())
            .addFields([
                { name: 'Name', value: member.nickname || member.user.username, inline: true },
                { name: 'ID', value: member.id, inline: true },
                { name: 'Account Created', value: member.user.createdAt, inline: true },
                { name: 'Joined Server', value: member.joinedAt, inline: true },
                { name: 'Roles', value: member.roles.cache.filter(role => role.id != message.guild.id).map(role => role).join(', ') || 'None', inline: true },
                { name: 'Notes', value: notes || 'None', inline: true }
            ])
            .setTimestamp(Date.now())
            .setThumbnail(member.user.displayAvatarURL())
        message.channel.send({ embeds: [embed] })
    }
}
