const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'warns',
    description: 'Displays all warns for a user',
    role: 'eventrl',
    requiredArgs: 1,
    args: '<user>',
    async execute(message, args, bot, db) {
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('Member not found. Please try again')
        db.query(`SELECT * FROM warns WHERE id = '${member.user.id}'`, async function (err, rows) {
            if (err) ErrorLogger.log(err, bot)
            if (rows == []) return message.channel.send(`${member.nickname} has no warns in the database`)
            let embed = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setTitle(`Warns for ${member.nickname}`)
                .setDescription('None!')
                .setFooter(member.user.id)
            for (let i in rows) {
                fitStringIntoEmbed(embed, `${parseInt(i) + 1}:\n${rows[i].reason}\n Mod: <@!${rows[i].modid}>\n`, message.channel)
            }
            function fitStringIntoEmbed(embed, string, channel) {
                if (embed.description == 'None!') {
                    embed.setDescription(string)
                } else if (embed.description.length + `\n${string}`.length >= 2048) {
                    if (embed.fields.length == 0) {
                        embed.addField('-', string)
                    } else if (embed.fields[embed.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
                        if (embed.length + `\n${string}`.length >= 6000) {
                            channel.send(embed)
                            embed.setDescription('None!')
                            embed.fields = []
                        } else {
                            embed.addField('-', string)
                        }
                    } else {
                        if (embed.length + `\n${string}`.length >= 6000) {
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
            message.channel.send(embed)
        })
    }
}