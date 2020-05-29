const Discord = require('discord.js')

module.exports = {
    name: 'avatar',
    description: 'Posts avatar of user provided',
    args: '(user)',
    alias: 'ava',
    role: 'Almost Raid Leader',
    execute(message, args, bot) {
        let member
        if (args.length == 0) member = message.member
        member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0])
        if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let embed = new Discord.MessageEmbed()
            .setColor('#fefefe')
            .setDescription(member)
            .setImage(member.user.avatarURL({ dynamic: true, size: 4096 }))
        message.channel.send(embed)
    }
}