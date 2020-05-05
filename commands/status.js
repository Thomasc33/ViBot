const Discord = require('discord.js');

module.exports = {
    name: 'status',
    description: 'returns bot status',
    alias: 'ping',

    role: 'Almost Raid Leader',
    async execute(message, args, bot) {
        const m = await message.channel.send('Pinging...').catch(er => { console.log(er); return; });
        let latency = m.createdTimestamp - message.createdTimestamp;
        var embed = new Discord.MessageEmbed()
            .setColor('#ffffff')
            .setTitle('ViBot Status')
            .addField('Ping', `${latency}ms`, true)
            .addField('Uptime', `${Math.floor(bot.uptime / 86400000)} Days ${Math.floor((bot.uptime - Math.floor(bot.uptime / 86400000) * 86400000) / 3600000)} Hours ${Math.round((bot.uptime - Math.floor(bot.uptime / 86400000) * 86400000 - Math.floor((bot.uptime - Math.floor(bot.uptime / 86400000) * 86400000) / 3600000) * 3600000) / 60000)} Minutes`, true)
            .setFooter('ViBot v1.2.2')
            .setTimestamp(Date.now());
        m.edit('', embed);
    }
}