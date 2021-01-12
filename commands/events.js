const Events = require('../data/events.json')
const Discord = require('discord.js')

module.exports = {
    name: 'events',
    description: 'Shows all current enabled event run types',
    role: 'eventrl',
    execute(message, args, bot) {
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Current event run types')
        for (x in Events) {
            if (Events[x].enabled) {
                if (embed.fields.length == 25) {
                    message.channel.send(embed);
                    embed.fields = []
                }
                embed.addField(x, `<${Events[x].keyEmote}>`, true)
            }
        }
        message.channel.send(embed)
    }
}