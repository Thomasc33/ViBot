const Discord = require('discord.js')
const moment = require('moment')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'mutes',
    description: 'prints all muted members of the server',
    role: 'security',
    args: '[IGN | mention | id]',
    async execute(message, args, bot, db) {
        const memberSearch = args.shift()
        let member
        if (memberSearch) {
            member = message.guild.members.cache.get(memberSearch)
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()))
            if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D/gi, ''))
        }

        const embed = new Discord.EmbedBuilder()
            .setAuthor({ name: member ? `Mutes for ${member.nickname || member.user.tag} in ${message.guild.name}` : `Muted members in ${message.guild.name}` })
            .setDescription('None!')
        if (!member) {
            db.query(`SELECT * FROM mutes WHERE muted = true AND guildid = ${message.guild.id}`, async (err, rows) => {
                if (err) ErrorLogger.log(err, bot, message.guild)
                const members = message.guild.roles.cache.get(require('../guildSettings.json')[message.guild.id].roles.muted).members.clone()
                if (rows && rows.length) {
                    for (const row of rows) {
                        members.delete(row.id)
                        fitStringIntoEmbed(embed, `<@!${row.id}> by <@!${row.modid}> ending <t:${(parseInt(row.uTime) / 1000).toFixed(0)}:R> at <t:${(parseInt(row.uTime) / 1000).toFixed(0)}:f>`, message.channel)
                    }
                }
                message.channel.send({ embeds: [embed] })
                embed.data.fields = []
                embed.setDescription('None!')
                embed.setAuthor({ name: `Mutes in ${message.guild.name} not set by ${message.guild.members.cache.get(bot.user.id).nickname || bot.user.tag}` })
                members.forEach(m => fitStringIntoEmbed(embed, `${m}`, message.channel))
                message.channel.send({ embeds: [embed] })
            })
        } else {
            db.query(`SELECT * FROM mutes WHERE id = ${member.id} AND guildid = ${message.guild.id} ORDER BY muted DESC`, async (err, rows) => {
                if (err) ErrorLogger.log(err, bot, message.guild)
                if (!rows || !rows.length) {return message.channel.send({ embeds: [embed] })}
                for (const row of rows) {
                    if (row.muted) {fitStringIntoEmbed(embed, `**Ends <t:${(parseInt(row.uTime) / 1000).toFixed(0)}:R> at <t:${(parseInt(row.uTime) / 1000).toFixed(0)}:f> by <@!${row.modid}>: ${row.reason}**`)} else {fitStringIntoEmbed(embed, `Ended <t:${(parseInt(row.uTime) / 1000).toFixed(0)}:R> at <t:${(parseInt(row.uTime) / 1000).toFixed(0)}:f> by <@!${row.modid}>: ${row.reason}`)}
                }
                message.channel.send({ embeds: [embed] })
            })
        }
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `\n${string}`.length >= 2048) {
        if (!embed.data.fields) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields && embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
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
