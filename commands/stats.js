const Discord = require('discord.js')
const botSettings = require('../settings.json')
module.exports = {
    name: 'stats',
    description: 'Gives users stats',
    args: '(user)',
    role: 'Verified Raider',
    dms: true,
    async execute(message, args, bot, db) {
        if (args.length == 0) var member = message.author
        else var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let embed = await this.getStatsEmbed(member.id, message.guild, db).catch(er => {
            console.log(er)
            message.channel.send('User has not been logged yet. Database is updated every 24-48 hours')
        })
        if (embed) {
            message.author.send(embed)
            message.react('✅')
        }
    },
    async dmExecution(message, args, bot, db, guild) {
        if (args.length == 0) var member = message.author
        else var member = message.mentions.members.first()
        if (!member) member = guild.members.cache.get(args[0])
        if (!member) member = guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let embed = await this.getStatsEmbed(member.id, guild, db).catch(er => {
            message.channel.send('User has not been logged yet. Database is updated every 24-48 hours')
        })
        if (embed) {
            message.author.send(embed)
            message.react('✅')
        }
    },
    async getStatsEmbed(id, guild, db) {
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM users WHERE id = '${id}'`, (err, rows) => {
                if (err) { reject(); return; }
                if (rows.length == 0) { reject('No user found'); return; }
                console.log(rows)
                let guildMember = guild.members.cache.get(id)
                let embed = new Discord.MessageEmbed()
                    .setColor('#015c21')
                    .setDescription(`<${botSettings.emote.hallsPortal}> __**Stats for**__ <@!${id}> <${botSettings.emote.hallsPortal}>
                    
                    <${botSettings.emote.LostHallsKey}> __**Keys Popped**__ <${botSettings.emote.LostHallsKey}>
                    Halls: ${rows[0].keypops}
                    Other: ${rows[0].eventpops}
                    
                    <${botSettings.emote.hallsPortal}>__**Runs Done**__<${botSettings.emote.hallsPortal}>
                    Cult: ${rows[0].cultRuns}
                    Void: ${rows[0].voidRuns}
                    Solo cults: ${rows[0].solocult}
                    Other: ${rows[0].eventruns}
                    
                    <${botSettings.emote.hallsPortal}>__**Runs Led**__<${botSettings.emote.hallsPortal}>
                    Cult: ${rows[0].cultsLead}
                    Void: ${rows[0].voidsLead}
                    Events: ${rows[0].eventsLead}
                    Assists: ${rows[0].assists}
                    
                    <${botSettings.emote.Vial}>__**Vials**__<${botSettings.emote.Vial}>
                    Dropped: ${rows[0].vialStored}
                    Used: ${rows[0].vialUsed}`)
                if (guildMember) embed.setThumbnail(guildMember.user.avatarURL())
                resolve(embed)
            })
        })
    }
}