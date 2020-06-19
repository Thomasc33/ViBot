const Discord = require('discord.js')
module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'Developer',
    async execute(message, args, bot, db) {
        let embed = new Discord.MessageEmbed()
            .setTitle('Bruh')
            .setDescription('None!')
        for (let i = 0; i < 10000; i++) {
            fitStringIntoEmbed(embed, 't')
        }
        function fitStringIntoEmbed(embed, string) {
            if (embed.description == 'None!') {
                embed.setDescription(string)
            } else if (embed.description.length + string.length >= 2048) {
                if (embed.fields.length == 0) {
                    embed.addField('-', string)
                } else if (embed.fields[embed.fields.length - 1].value.length + string.length >= 1024) {
                    if (embed.length + string.length + 1 >= 6000) {
                        message.channel.send(embed)
                        embed.setDescription('None!')
                        embed.fields = []
                    } else {
                        embed.addField('-', string)
                    }
                } else {
                    if (embed.length + string.length >= 6000) {
                        message.channel.send(embed)
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
        message.channel.send(embed)
    }
}