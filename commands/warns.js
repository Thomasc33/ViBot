const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')
module.exports = {
    name: 'warns',
    description: 'Displays all warns for all inputted users',
    role: 'eventrl',
    requiredArgs: 1,
    args: '[Users]',
    async execute(message, args, bot, db) {
        if (args.length == 0) return;
        var notFoundString = ''
        //combines users into an array
        for (let i in args) {
            let u = args[i];
            var member = message.guild.members.cache.get(u)
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()));
            if (!member) {
                if (notFoundString == '') notFoundString = `${u}`
                else notFoundString = notFoundString.concat(`, ${u}`)
                continue
            }
            db.query(`SELECT * FROM warns WHERE id = '${member.user.id}' and (guildid = '${message.guild.id}' OR guildid is null)`, async function (err, rows) {
                if (err) ErrorLogger.log(err, bot)
                let embed = new Discord.EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle(`Warns for ${member.nickname}`)
                    .setDescription('None!')
                    .setFooter({ text: member.user.id })
                for (let i in rows) {
                    fitStringIntoEmbed(embed, `**\`${parseInt(i) + 1}\`** by <@!${rows[i].modid}>${rows[i].time ? ' ' + moment().to(new Date(parseInt(rows[i].time))) : ''}:\n  \`\`\`${rows[i].reason}\`\`\``, message.channel)
                }
                function fitStringIntoEmbed(embed, string, channel) {
                    if (embed.data.description == 'None!') {
                        embed.setDescription(string)
                    } else if (embed.data.description.length + `\n${string}`.length >= 2048) {
                        if (!embed.data.fields) {
                            embed.addFields({ name: '-', value: string })
                        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
                            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
                                channel.send({ embeds: [embed] })
                                embed.setDescription(string)
                                embed.data.fields = []
                            } else {
                                embed.addFields({ name: '-', value: string })
                            }
                        } else {
                            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
                                channel.send({ embeds: [embed] })
                                embed.setDescription(string)
                                embed.data.fields = []
                            } else {
                                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
                            }
                        }
                    } else {
                        embed.setDescription(embed.data.description.concat(`\n${string}`))
                    }
                }
                message.channel.send({ embeds: [embed] })
            })
        }
        if (notFoundString != '') {
            var embed = new Discord.EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('Users not found:')
                .setDescription(notFoundString);
            message.channel.send({ embeds: [embed] })
        }
    }
}