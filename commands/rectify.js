const Discord = require('discord.js')

module.exports = {
    name: 'rectify',
    description: 'Removes the ? infront of peoples names',
    role: 'security',
    alias: ['r'],
    requiredArgs: 1,
    args: '<id/mention>',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        var user = message.guild.members.cache.get(args[0]);
        if (!user) user = message.mentions.members.first()
        if (!user) return message.channel.send('User not found. Try again')
        let newName = user.nickname.replace(/[-?]/g, '');
        let tag = user.user.tag.substring(0, user.user.tag.length - 5)
        let nick = ''
        if (tag == newName) {
            nick = newName.toLowerCase()
            if (tag == nick) {
                nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
            }
        } else nick = newName
        await user.setNickname(newName)
        let embed = new Discord.MessageEmbed()
            .setTitle('User Rectified')
            .setDescription(user)
            .addField('User', user.displayName, true)
            .addField('Rectified By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
        message.react('✅')
    }
}