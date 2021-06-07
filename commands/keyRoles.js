const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const dbInfo = require('../data/database.json')
const botSettings = require('../settings.json')

module.exports = {
    name: 'keyroles',
    description: 'Makes sure everyone that should have a key popper role does',
    role: 'security',
    args: 'None | <check> <user/all>',
    execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        if (args.length == 0) {
            let keyCountEmbed = new Discord.MessageEmbed()
                .setDescription(`<@&${settings.roles.topkey}>: ${settings.numerical.topkey} Pops\n<@&${settings.roles.bottomkey}>: ${settings.numerical.bottomkey} Pops`)
                .setColor('#ff0000')
            message.channel.send(keyCountEmbed)
        } else {
            if (args[0].toLowerCase() == 'check') {
                if (args[1].toLowerCase() == 'all') {
                    this.checkAll(message.guild, bot, db)
                } else {
                    let member = message.mentions.members.first()
                    if (!member) member = message.guild.members.cache.get(args[1])
                    if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
                    if (!member) return message.channel.send('User not found')
                    this.checkUser(member, bot, db)
                }
                message.react('✅')
            } else {
                message.channel.send(`Check syntax and try again`)
            }
        }
    },
    async checkAll(guild, bot, db) {
        let settings = bot.settings[guild.id]
        if (!settings || !dbInfo[guild.id] || !dbInfo[guild.id].mainKeyType) return
        db.query(`SELECT ${dbInfo[guild.id].mainKeyType}, id FROM users WHERE ${dbInfo[guild.id].mainKeyType} >= 15`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            for (let i in rows) {
                let u = rows[i]
                if (u[dbInfo[guild.id].mainKeyType] >= 15) {
                    let m = guild.members.cache.get(u.id)
                    if (!m) continue;
                    if (!m.roles.cache.has(settings.roles.bottomkey)) m.roles.add(settings.roles.bottomkey)
                }
                if (u[dbInfo[guild.id].mainKeyType] >= 50) {
                    let m = guild.members.cache.get(u.id)
                    if (!m) continue;
                    if (!m.roles.cache.has(settings.roles.topkey)) m.roles.add(settings.roles.topkey)
                }
            }
        })
    },
    async checkUser(member, bot, db) {
        let settings = bot.settings[member.guild.id]
        if (!settings || !dbInfo[member.guild.id] || !dbInfo[member.guild.id].mainKeyType) return
        db.query(`SELECT ${dbInfo[member.guild.id].mainKeyType} FROM users WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (!rows || !rows[0]) return db.query(`INSERT INTO users (id) VALUES ('${member.id}')`)
            if (!rows[0][dbInfo[member.guild.id].mainKeyType]) return
            if (rows[0][dbInfo[member.guild.id].mainKeyType] >= 15) if (!member.roles.cache.has(settings.roles.bottomkey)) member.roles.add(settings.roles.bottomkey)
            if (rows[0][dbInfo[member.guild.id].mainKeyType] >= 50) if (!member.roles.cache.has(settings.roles.topkey)) member.roles.add(settings.roles.topkey)
        })
    }
}