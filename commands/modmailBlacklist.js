const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'modmailblacklist',
    alias: ['mmbl', 'mbl', 'modmailblacklisted'],
    args: '<add/remove> <member>',
    role: 'Officer',
    async execute(message, args, bot, db) {
        if (args.length == 0) {
            let blackListedEmbed = new Discord.MessageEmbed()
                .setTitle('Blacklisted Modmail Users')
                .setDescription('None!')
            db.query(`SELECT id FROM users WHERE modMailBlacklisted = true`, (err, rows) => {
                if (err) ErrorLogger.log(err, bot)
                for (let i in rows) fitStringIntoEmbed(blackListedEmbed, `<@!${rows[i]}>`, message.channel)
            })
        } else if (args.length == 1) {
            let member = message.mentions.members.first()
            if (member == null) member = message.guild.members.cache.get(args[0])
            if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
            if (member == null) { message.channel.send('User not found'); return; }
            db.query(`SELECT modMailBlacklisted FROM users WHERE id = '${member.id}'`, (err, rows) => {
                if (rows[0].modMailBlacklisted == 0) message.channel.send(`${member} is not mod mail blacklisted right now`)
                else message.channel.send(`${member} is mod mail blacklisted`)
            })
        } else {
            let blacklisted
            if (args[0].charAt(0).toLowerCase() == 'r') blacklisted = false
            else if (args[0].charAt(0).toLowerCase() == 'a') blacklisted = true
            else return message.channel.send('Please specify whether you with to add or remove from blacklist')

            let member = message.mentions.members.first()
            if (member == null) member = message.guild.members.cache.get(args[1])
            if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
            if (member == null) { message.channel.send('User not found'); return; }

            db.query(`UPDATE users SET modMailBlacklisted = ${blacklisted} WHERE id = '${member.id}'`, (err, rows) => {
                if(err) ErrorLogger.log(err, bot)
                message.react('✅')
            })
        }
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
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`, ${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`, ${string}`))
    }
}