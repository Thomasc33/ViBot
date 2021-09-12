const Discord = require('discord.js')

module.exports = {
    name: 'avatar',
    description: 'Posts avatar of user provided',
    args: '(user)',
    alias: ['ava'],
    role: 'eventrl',
    execute(message, args, bot) {
        let member = null
        if (args.length == 0) member = message.member
        if (!member) member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')
        let embed = new Discord.MessageEmbed()
            .setColor('#fefefe')
            .setDescription(member.toString())
            .setImage(member.user.avatarURL({ dynamic: true, size: 4096 }))
        message.channel.send({ embeds: [embed] })
    }
}