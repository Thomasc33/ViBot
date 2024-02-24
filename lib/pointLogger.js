const Discord = require('discord.js')
const { settings } = require('./settings');

module.exports = {
    async earlyLocation(u, runInfo, guild, cost, bot, leftOver) {
        let pointChannel = guild.channels.cache.get(settings[guild.id]?.channels.pointlogging)
        if (!pointChannel) return
        let embed = new Discord.EmbedBuilder()
            .setAuthor({ name: `${u.tag}` })
            .setFooter({ text: `User ID: ${u.id}` })
        if (u.avatarURL()) embed.setAuthor({ name: `${u.tag}`, iconURL: u.avatarURL() })
        embed.setColor(runInfo.embed.color)
        embed.setDescription(`<@!${u.id}> spent ${cost} points for early location to a ${runInfo.runName} run\n\`${leftOver}\` points remaining`)
        pointChannel.send({ embeds: [embed] })
    },
    async pointLogging(pointsLog, guild, bot, runEmbed) {
        let pointChannel = guild.channels.cache.get(settings[guild.id]?.channels.pointlogging)
        if (!pointChannel) return
        let embed = new Discord.EmbedBuilder()
            .setColor(runEmbed.data.color)
            .setDescription('No Points Given')
        embed.data.author = runEmbed.data.author
        for (let i of pointsLog) {
            if (embed.data.description == 'No Points Given') embed.setDescription(`<@!${i.uid}>: Given \`${i.points}\` points for \`${i.reason}\``)
            else embed.data.description += `\n<@!${i.uid}>: Given \`${i.points}\` points for \`${i.reason}\``
        }
        let mid;
        await pointChannel.send({ embeds: [embed] })
            .then(m => { mid = m.id; }, reason => { console.error(reason) });
        return mid;
    }
}
