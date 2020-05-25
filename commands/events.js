const Events = require('../events.json')
const Discord = require('discord.js')

module.exports = {
    name: 'events',
    description: 'Shows all current enabled event run types',
    role: 'Event Organizer',
    execute(message, args, bot) {
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Current event run types')
        for (x in Events) {
            if (Events[x].enabled) {
                embed.addField(x, `<${Events[x].keyEmote}>`, true)
            }
        }
        message.channel.send(embed)
    }
}