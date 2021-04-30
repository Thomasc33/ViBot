const Discord = require('discord.js')

module.exports = {
    name: 'suspectalt',
    alias: ['suspect', 'sa'],
    description: 'Adds a ? infront of someones name',
    role: 'security',
    requiredArgs: 1,
    args: '<id/mention>',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        var user = message.mentions.members.first()
        if (user == null) user = message.guild.members.cache.get(args[0]);
        if (user == null) {
            message.channel.send('User not found. Try again')
            return;
        }
        await user.setNickname(`?${user.nickname}`)
        let embed = new Discord.MessageEmbed()
            .setTitle('Suspected Alt')
            .setDescription(user)
            .addField('User', user.displayName, true)
            .addField('Suspected By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        await message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
        message.react('✅')
    }
}