const Discord = require('discord.js')
const botSettings = require('../settings.json')
const pointLogger = require('../lib/pointLogger')
const adminUsers = ['277636691227836419', '258286481167220738', '178840516882989056', '120540036855889921']

module.exports = {
    name: 'points',
    description: 'Displays how many points a user has',
    args: 'None',
    role: 'raider',
    /**
     * 
     * @param {String} guildid 
     * @param {Discord.GuildMember} member 
     */
    getNotes(guild, member, bot) {
        let settings = member.client.settings[guild.id]
        if (!settings) return null
        if (member.roles.highest.position >= member.guild.roles.cache.get(settings.roles.headrl).position || adminUsers.includes(member.id)) return 'EO+ <user> | HRL+ <add/remove> <user>'
        if (member.roles.highest.position >= member.guild.roles.cache.get(settings.roles.eventrl).position || adminUsers.includes(member.id)) return '<user> to see someones points'
        else return null
    },
    dms: true,
    dmNeedsGuild: true,
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (!settings || !settings.backend.points) return
        if (message.member.roles.highest.position < message.guild.roles.cache.get(settings.roles.eventrl).position) {
            await message.member.send({ embeds: [await this.getPointEmbed(message.member, db)] })
            message.react('✅')
        } else if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.headrl).position || bot.adminUsers.includes(member.id)) {
            if (args.length == 0) return await message.member.send({ embeds: [await this.getPointEmbed(message.member, db)] }).then(message.react('✅'))
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
                    db.query(`UPDATE users SET points = points + ${count} WHERE id = '${member.id}'`)
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
                    db.query(`UPDATE users SET points = points - ${countt} WHERE id = '${memberr.id}'`)
                    message.channel.send(`${countt} points were taken away from ${memberr.nickname}`)
                    break;
                default:
                    let member1 = message.mentions.members.first()
                    if (!member1) member1 = message.guild.members.cache.get(args[0])
                    if (!member1) member1 = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
                    if (!member1) return message.channel.send(`${args[1]} is not a valid user`)
                    await message.member.send({ embeds: [await this.getPointEmbed(member1, db)] })
                    break;
            }
        } else {
            if (args.length == 0) await message.member.send({ embeds: [await this.getPointEmbed(message.member, db)] })
            else {
                let member = message.mentions.members.first()
                if (!member) member = message.guild.members.cache.get(args[0])
                if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
                if (!member) return message.channel.send(`${member} not found`)
                await message.member.send({ embeds: [await this.getPointEmbed(member, db)] })
            }
            message.react('✅')
        }
    },
    async dmExecution(message, args, bot, db, guild) {
        return message.channel.send({ embeds: [await this.getPointEmbed(message.author, db)] })
    },
    getPointEmbed(member, db) {
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM users WHERE id = '${member.id}'`, async (err, rows) => {
                if (err || (rows && rows.length == 0)) reject()
                let pointEmbed = new Discord.EmbedBuilder()
                    .setColor('#015c21')
                    .setDescription(`<${botSettings.emote.hallsPortal}> __**Points for <@!${rows[0].id}> on Pub Halls**__ <${botSettings.emote.hallsPortal}>\n**Points:** ${rows[0].points}`)
                resolve(pointEmbed)
            })
        })
    }
}