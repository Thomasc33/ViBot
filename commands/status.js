const Discord = require('discord.js');

module.exports = {
    name: 'status',
    description: 'returns bot status',
    async execute(message, args, bot) {
        const m = await message.channel.send('Pinging...');
        let latency = m.createdTimestamp - message.createdTimestamp;
        var embed = new Discord.MessageEmbed()
            .setColor('#ffffff')
            .setTitle('ViBot Status')
            .addField('Ping', `${latency}ms`, true)
            .addField('Uptime', `${Math.floor(bot.uptime / 1000)} seconds`, true)
            .setFooter('ViBot v1.2.1')
            .setTimestamp(Date.now());
        m.edit('', embed);
    }
}