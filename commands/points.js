const Discord = require('discord.js')
const botSettings = require('../settings.json')

async function addPoints(message, args, db) {
    const search = args.shift()
    const member = message.guild.findMember(args.shift())
    if (!member) return message.channel.send(`${search} not found`)
    const count = args[0] && !isNaN(args[0]) ? args.shift() : 1
    db.query(`UPDATE users SET points = points + ${count} WHERE id = '${member.id}'`)
    await message.channel.send(`${member.nickname} was given ${count} points`)
}

async function removePoints(message, args, db) {
    const search = args.shift()
    const member = message.guild.findMember(search)
    if (!member) return message.channel.send(`${search} not found`)
    const count = args[0] && !isNaN(args[0]) ? args.shift() : 1
    db.query(`UPDATE users SET points = points - ${count} WHERE id = '${member.id}'`)
    await message.channel.send(`${count} points were taken away from ${member.nickname}`)
}

async function sendPoints(message, args, db) {
    const search = args.shift()
    const member = message.guild.findMember(search)
    if (!member) return message.channel.send(`${search} is not a valid user`)
    await message.member.send({ embeds: [await this.getPointEmbed(member, db)] })
}
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
        const settings = member.client.settings[guild.id]
        if (!settings) return null
        if (member.roles.highest.position >= member.guild.roles.cache.get(settings.roles.headrl).position || bot.adminUsers.includes(member.id)) return 'EO+ <user> | HRL+ <add/remove> <user>'
        if (member.roles.highest.position >= member.guild.roles.cache.get(settings.roles.eventrl).position || bot.adminUsers.includes(member.id)) return '<user> to see someones points'
        return null
    },
    dms: true,
    dmNeedsGuild: true,
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        if (!settings || !settings.backend.points) return
        if (message.member.roles.highest.position < message.guild.roles.cache.get(settings.roles.eventrl).position || !args.length) {
            await message.member.send({ embeds: [await this.getPointEmbed(message.member, db)] })
            message.react('✅')
        } else if (args.length == 1 || (message.member.roles.highest.position < message.guild.roles.cache.get(settings.roles.headrl).position && !bot.adminUsers.includes(message.member.id))) {
            await sendPoints(message, args, db)
        } else {
            switch (args.shift().toLowerCase()) {
                case 'add': await addPoints(message, args, db); break
                case 'remove': await removePoints(message, args, db); break
                default: await sendPoints(message, args, db)
            }
        }
        message.react('✅')
    },
    async dmExecution(message, args, bot, db) {
        return message.channel.send({ embeds: [await this.getPointEmbed(message.author, db)] })
    },
    async getPointEmbed(member, db) {
        const [rows] = db.promise().query(`SELECT * FROM users WHERE id = '${member.id}'`)
        if (!rows?.length) {
            return new Discord.EmbedBuilder()
                .setColor('Red')
                .setDescription(`No stats found for ${member}`)
        }
        return new Discord.EmbedBuilder()
            .setColor('#015c21')
            .setDescription(`<${botSettings.emote.hallsPortal}> __**Points for <@!${rows[0].id}> on Pub Halls**__ <${botSettings.emote.hallsPortal}>\n**Points:** ${rows[0].points}`)
    }
}
