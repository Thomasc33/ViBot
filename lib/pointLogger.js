const Discord = require('discord.js')

module.exports = {
    async earlyLocation(u, run, guild, cost, bot) {
        let settings = bot.settings[guild.id]
        if (!settings) return
        let pointChannel = guild.channels.cache.get(settings.channels.pointlogging)
        if (!pointChannel) return
        let embed = new Discord.MessageEmbed()
            .setAuthor(`${u.tag}`)
            .setFooter(`User ID: ${u.id}`)
        if (u.avatarURL()) embed.author.iconURL = u.avatarURL()
        switch (run) {
            case 1: //cult
                embed.setDescription(`<@!${u.id}> spent ${settings.points.cultlocation} points for early location to a cult run`)
                    .setColor(`#ff0000`)
                break;
            case 2: //void
                embed.setDescription(`<@!${u.id}> spent ${settings.points.voidlocation} points for early location to a void run`)
                    .setColor(`#2f075c`)
                break;
            case 3: //fsv
                embed.setDescription(`<@!${u.id}> spent ${settings.points.fsvlocation} points for early location to a fullskip run`)
                    .setColor(`#2f075c`)
                break;
        }
        pointChannel.send(embed)
    }
}

