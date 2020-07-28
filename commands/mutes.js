const Discord = require('discord.js')

module.exports = {
    name: 'mutes',
    description: 'prints all muted members of the server',
    role: 'security',
    async execute(message, args, bot) {
        let embed = new Discord.MessageEmbed()
            .setTitle('Muted members in your server')
            .setDescription(`None!`)
        for (let i in bot.mutes) {
            if (bot.mutes[i].guild !== message.guild.id) return;
            let string = `<@!${i}> : Until ${new Date(bot.mutes[i].time).toDateString()}`
            fitStringIntoEmbed(embed, string, message.channel)

        }
        message.channel.send(embed)
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + string.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + string.length >= 1024) {
            if (embed.length + string.length + 1 >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + string.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`\n${string}`))
    }
}