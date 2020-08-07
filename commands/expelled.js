const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'expelled',
    alias: ['expel'],
    role: 'security',
    args: '<list> | <add/remove> [names/ids]',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (args[0].toLowerCase() == 'list') {
            db.query(`SELECT * FROM veriblacklist`, async (err, rows) => {
                if (err) ErrorLogger.log(err, bot)
                let embed = new Discord.MessageEmbed()
                    .setTitle(`Expelled / Veriblacklisted users`)
                    .setDescription('None!')
                for (let i in rows) {
                    fitStringIntoEmbed(embed, `${rows[i].id}`, message.channel)
                }
                message.channel.send(embed)
            })
        } else if (args[0].charAt(0).toLowerCase() == 'a') {
            if (!args[1]) return message.channel.send(`Please specify a user`)
            args.shift()
            let query = `INSERT INTO veriblacklist (id, modid) VALUES`
            for (let i in args) {
                query += ` ('${args[i]}', '${message.author.id}'),`
            }
            db.query(query.substring(0, query.length - 1), err => {
                if (err) message.channel.send(`Error Occured\n\`\`\`${err.message}\`\`\``)
            })
            message.react('✅')
        } else if (args[0].charAt(0).toLowerCase() == 'r') {
            if (!args[1]) return message.channel.send(`Please specify a user`)
            args.shift()
            for (let i in args) {
                db.query(`DELETE FROM veriblacklist WHERE id = '${args[i]}'`)
            }
            message.react('✅')
        } else return message.channel.send(`Command entered incorrectly. Please try again`)
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + `, ${string}`.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + `, ${string}`.length >= 1024) {
            if (embed.length + `, ${string}`.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + `, ${string}`.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`, ${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`, ${string}`))
    }
}