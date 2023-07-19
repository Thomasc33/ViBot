const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');

module.exports = {
    name: 'test',
    description: 'Holds testing code. Do not issue command if you do not know what is in it',
    requiredArgs: 0,
    guildspecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        return message.reply('Keeyoung is bad, and toast');
        const iconUrl = 'https://cdn.discordapp.com/avatars/' + message.member.id + '/' + message.member.user.avatar + '.webp'
        console.log(iconUrl)
        let embed = new Discord.EmbedBuilder()
            .setAuthor({ name: `${message.member.displayName}`, iconURL: `${iconUrl}` })
            .setColor('#FF0000')
            .setDescription(`${message.member} \`\`${message.member.displayName}\`\` Left the server as a staff member`)
            .setThumbnail(`${iconUrl}`)
            .addFields(
            {
                name: 'Highest Role',
                value: `${message.member.roles.highest}`,
                inline: false
            },
            {
                name: 'Roles',
                value: `${message.member.roles.cache.map(role => role).join(', ')}`,
                inline: false
            })
            .setFooter({ text: `ID: ${message.author.id}`, iconURL: `${iconUrl}` })
            .setTimestamp()
        message.channel.send({ embeds: [embed] })
    }
}
