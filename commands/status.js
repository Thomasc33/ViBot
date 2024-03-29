const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')
const package = require('../package.json')

module.exports = {
    name: 'status',
    description: 'returns bot status',
    alias: ['ping'],
    role: 'almostrl',
    async execute(message, args, bot) {
        const m = await message.channel.send('Pinging...').catch(er => { ErrorLogger.log(er, bot, message.guild); return; });
        let latency = m.createdTimestamp - message.createdTimestamp;
        var embed = new Discord.EmbedBuilder()
            .setColor('#ffffff')
            .setTitle('ViBot Status')
            .addFields([{ name: 'Ping', value: `${latency}ms`, inline: true }])
            .addFields([{ name: 'Uptime', value: this.uptimeString(bot), inline: false }])
            .setFooter({ text: `ViBot v${package.version.replace('^', '')}` })
            .setTimestamp(Date.now());
        m.edit({ content: null, embeds: [embed] });
    },
    uptimeString(bot) {
        return `${Math.floor(bot.uptime / 86400000)} Days ${Math.floor((bot.uptime - Math.floor(bot.uptime / 86400000) * 86400000) / 3600000)} Hours ${Math.round((bot.uptime - Math.floor(bot.uptime / 86400000) * 86400000 - Math.floor((bot.uptime - Math.floor(bot.uptime / 86400000) * 86400000) / 3600000) * 3600000) / 60000)} Minutes`
    }
}
