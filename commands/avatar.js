const Discord = require('discord.js')

module.exports = {
    name: 'avatar',
    description: 'Posts avatar of user provided',
    args: '<ign>',
    alias: 'ava',
    role: 'Almost Raid Leader',
    execute(message, args, bot) {
        let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let embed = new Discord.MessageEmbed()
            .setColor('#fefefe')
            .setDescription(member)
            .setImage(member.user.avatarURL())
        message.channel.send(embed)
    }
}