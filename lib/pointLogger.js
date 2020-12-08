const Discord = require('discord.js')

module.exports = {
    async earlyLocation(u, runInfo, guild, cost, bot, leftOver) {
        let settings = bot.settings[guild.id]
        if (!settings) return
        let pointChannel = guild.channels.cache.get(settings.channels.pointlogging)
        if (!pointChannel) return
        let embed = new Discord.MessageEmbed()
            .setAuthor(`${u.tag}`)
            .setFooter(`User ID: ${u.id}`)
        if (u.avatarURL()) embed.author.iconURL = u.avatarURL()
        embed.setColor(runInfo.embed.color)
        embed.setDescription(`<@!${u.id}> spent ${cost} points for early location to a ${runInfo.runName} run\n\`${leftOver}\` points remaining`)
        pointChannel.send(embed)
    },
    async pointLogging(pointsLog, guild, bot, runEmbed) {
        let settings = bot.settings[guild.id]
        if (!settings) return
        let pointChannel = guild.channels.cache.get(settings.channels.pointlogging)
        if (!pointChannel) return
        let embed = new Discord.MessageEmbed()
            .setColor(runEmbed.hexColor)
            .setDescription('No Points Given')
        embed.author = runEmbed.author
        for (let i of pointsLog) {
            if(embed.description == 'No Points Given') embed.setDescription(`<@!${i.uid}>: Given \`${i.points}\` points for \`${i.reason}\``)
        }
        pointChannel.send(embed)
    }
}

