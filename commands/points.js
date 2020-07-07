const Discord = require('discord.js')
const botSettings = require('../settings.json')

module.exports = {
    name: 'points',
    description: 'Displays how many points a user has',
    role: 'Verified Raider',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (message.member.roles.highest.position < message.guild.roles.cache.find(r => r.name === settings.eo).position) {
            await message.member.send(await this.getPointEmbed(message.member, db))
            message.react('✅')
        } else if (message.member.roles.highest.position >= message.guild.roles.cache.find(r => r.name === settings.hrl).position || message.member.roles.has(message.guild.roles.cache.find(r => r.name === settings.developer))) {
            if (args.length == 0) return await message.member.send(await this.getPointEmbed(message.member, db))
            switch (args[0].toLowerCase()) {
                case 'add':
                    let member = message.mentions.members.first()
                    if (!member) member = message.guild.members.cache.get(args[1])
                    if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
                    if (!member) return message.channel.send(`${args[1]} not found`)
                    let count = 1
                    if (args[2] && args[2].replace(/[^0-9]/g, '') == args[2]) {
                        count = args[2]
                    }
                    db.query(`UPDATE users SET points = points + ${count}`)
                    message.channel.send(`${member.nickname} was given ${count} points`)
                    break;
                case 'remove':
                    let memberr = message.mentions.members.first()
                    if (!memberr) memberr = message.guild.members.cache.get(args[1])
                    if (!memberr) memberr = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
                    if (!memberr) return message.channel.send(`${args[1]} not found`)
                    let countt = 1
                    if (args[2] && args[2].replace(/[^0-9]/g, '') == args[2]) {
                        countt = args[2]
                    }
                    db.query(`UPDATE users SET points = points - ${countt}`)
                    message.channel.send(`${countt} points were taken away from ${memberr.nickname}`)
                    break;
                default:
                    let member1 = message.mentions.members.first()
                    if (!member1) member1 = message.guild.members.cache.get(args[0])
                    if (!member1) member1 = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
                    await message.member.send(await this.getPointEmbed(member1, db))
                    break;
            }
        } else {
            if (args.length == 0) await message.member.send(await this.getPointEmbed(message.member))
            else {
                let member = message.mentions.members.first()
                if (!member) member = message.guild.members.cache.get(args[0])
                if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
                await message.member.send(await this.getPointEmbed(member, db))
            }
            message.react('✅')
        }
    },
    getPointEmbed(member, db) {
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM users WHERE id = '${member.id}'`, async (err, rows) => {
                if (err || (rows && rows.length == 0)) reject()
                let pointEmbed = new Discord.MessageEmbed()
                    .setColor('#015c21')
                    .setDescription(`<${botSettings.emote.hallsPortal}> __**Points for ${rows[0].ign} on Pub Halls**__ <${botSettings.emote.hallsPortal}>\n**Points:** ${rows[0].points}`)
                resolve(pointEmbed)
            })
        })
    }
}