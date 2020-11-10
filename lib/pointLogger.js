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
    }
}

