const Discord = require('discord.js')

module.exports = {
    name: 'rectify',
    description: 'Removes the ? infront of peoples names',
    role: 'Security',
    args: '<id/mention>',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        var user = message.guild.members.cache.get(args[0]);
        if (user == null) user = message.mentions.members.first()
        if (user == null) {
            message.channel.send('User not found. Try again')
            return;
        }
        await user.setNickname(user.nickname.replace(/[-?]/g, ''))
        let embed = new Discord.MessageEmbed()
            .setTitle('User Rectified')
            .setDescription(user)
            .addField('User', user.displayName, true)
            .addField('Rectified By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        message.guild.channels.cache.find(c => c.name === settings.modlog).send(embed);
        message.react('✅')
    }
}