const Discord = require('discord.js')

module.exports = {
    name: 'eventdupes',
    description: 'Displays all users who have both Event Bois and Verified Raider',
    role: 'Security',
    async execute(message, args, bot) {
        let eventbois = message.guild.roles.cache.find(r => r.name === 'Event Boi')
        let raider = message.guild.roles.cache.find(r => r.name === 'Verified Raider')

        let embed = new Discord.MessageEmbed()
            .setTitle('Users with Event bois and Verified Raider')
            .setColor('#ff0000')
            .setDescription('None')
        let memberArray = message.guild.members.cache.array()

        for (let i in memberArray) {
            let m = memberArray[i]

            if (m.roles.cache.has(eventbois.id) && m.roles.cache.has(raider.id)) {
                if (embed.description == 'None') {
                    embed.setDescription(`${m}`)
                } else {
                    if (embed.description.length > 2048) {
                        message.channel.send(embed)
                        embed.setDescription(`${m}`)
                    } else {
                        embed.setDescription(`${embed.description}\n${m}`)
                    }
                }
            }
        }
        message.channel.send(embed)
    }
}