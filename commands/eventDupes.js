const Discord = require('discord.js')

module.exports = {
    name: 'eventdupes',
    description: 'Displays all users who have both Event Raider and Verified Raider',
    role: 'security',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (!settings.roles.eventraider) return
        let eventbois = message.guild.roles.cache.get(settings.roles.eventraider)
        let raider = message.guild.roles.cache.get(settings.roles.raider)
        if (!eventbois || !raider) return

        let embed = new Discord.MessageEmbed()
            .setTitle('Users with Event bois and Verified Raider')
            .setColor('#ff0000')
            .setDescription('None')
        message.guild.members.cache.each(m => {
            if (m.roles.cache.has(eventbois.id) && m.roles.cache.has(raider.id)) {
                if (embed.description == 'None') {
                    embed.setDescription(`${m}`)
                } else {
                    if (embed.description.length > 2048) {
                        message.channel.send({ embeds: [embed] })
                        embed.setDescription(`${m}`)
                    } else {
                        embed.setDescription(`${embed.description}\n${m}`)
                    }
                }
            }
        })
        message.channel.send({ embeds: [embed] })
    }
}