const ErrorLogger = require('../lib/logError')
const dbInfo = require('../data/database.json')
const Discord = require('discord.js')

module.exports = {
    name: 'addvial',
    alias: ['av'],
    description: 'Adds stored vial to user',
    guildSpecific: true,
    args: '<user>',
    requiredArgs: 1,
    role: 'almostrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let vialStoredName = dbInfo[message.guild.id] ? dbInfo[message.guild.id].userInfo.vialStored : null
        if (!vialStoredName) return message.channel.send('No known column name for Vial Storage')
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')
        db.query(`SELECT * FROM users WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            db.query(`UPDATE users SET ${vialStoredName} = ${parseInt(rows[0][vialStoredName]) + 1} WHERE id = '${member.id}'`)
            message.channel.send({ embeds: [new Discord.MessageEmbed().setDescription(`Vial logged. They now have ${parseInt(rows[0][vialStoredName]) + 1} vials stored`).setTimestamp().setColor('#0c045c').setThumbnail('https://cdn.discordapp.com/emojis/701491230567039018.png?v=1')] })
            message.guild.channels.cache.get(settings.channels.viallog).send({ embeds: [new Discord.MessageEmbed().setDescription(`Vial added to ${member} (${member.nickname}), logged by ${message.member} (${parseInt(rows[0][vialStoredName]) + 1} remaining vials)`).setTimestamp().setColor('#0c045c').setThumbnail('https://cdn.discordapp.com/emojis/701491230567039018.png?v=1')] })
        })
    }
}