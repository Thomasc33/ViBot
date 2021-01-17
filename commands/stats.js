const Discord = require('discord.js')
const botSettings = require('../settings.json')
const axios = require('axios')
module.exports = {
    name: 'stats',
    description: 'Gives users stats',
    args: '(user)',
    role: 'raider',
    dms: true,
    async execute(message, args, bot, db) {
        if (args.length == 0) var member = message.author
        else var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send(`\`${args[0]}\` not found`)
        let embed = await this.getStatsEmbed(member.id, message.guild, db).catch(er => {
            message.channel.send('User has not been logged yet. Database is updated every 24-48 hours')
        })
        if (embed) {
            message.author.send(embed)
            message.react('✅')
        }
    },
    async dmExecution(message, args, bot, db, guild) {
        let member
        if (args.length == 0) member = message.author
        else if (message.mentions.members) member = message.mentions.members.first()
        if (!member) member = guild.members.cache.get(args[0])
        if (!member) member = guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let embed = await this.getStatsEmbed(member.id, guild, db).catch(er => {
            message.channel.send('User has not been logged yet. People are logged after they complete their first run')
        })
        if (embed) {
            message.author.send(embed)
            message.react('✅')
        }
    },
    async getStatsEmbed(id, guild, db) {
        return new Promise((resolve, reject) => {
            db.query(`SELECT * FROM users WHERE id = '${id}'`, async (err, rows) => {
                if (err) return reject()
                if (rows.length == 0) return reject('No user found');
                let guildMember = guild.members.cache.get(id)
                let embed = new Discord.MessageEmbed()
                if (guild.id == '708026927721480254') {
                    await this.updateO3Runs(id, guild, db)
                    embed.setColor('#015c21')
                        .setDescription(`<${botSettings.emote.o3}> __**Stats for**__ <@!${id}> <${botSettings.emote.o3}>
                    *This includes stats from Pub Halls*

                    🔑 __**Keys Popped**__ 🔑
                    Halls: ${rows[0].keypops}
                    Other: ${rows[0].eventpops}
                    
                    <${botSettings.emote.o3}>__**Runs Done**__<${botSettings.emote.o3}>
                    Cult: ${rows[0].cultRuns}
                    Void: ${rows[0].voidRuns}
                    Oryx Three: ${rows[0].o3runs}
                    
                    <${botSettings.emote.o3}>__**Runs Led**__<${botSettings.emote.o3}>
                    Oryx Three: ${rows[0].cultsLead}
                    Realm Clearing: ${rows[0].o3leads}
                    Assists: ${rows[0].assists}
                    Oryx Assists: ${rows[0].assistso3}

                    <${botSettings.emote.HelmRune}>__**Runes**__<${botSettings.emote.SwordRune}>
                    Runes Popped: ${rows[0].runesused} 
                    
                    🎟️__**Points**__🎟️
                    Points: ${rows[0].points}`)
                }
                else embed
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
                    ${rows[0].parses ? 'Parses: ' + rows[0].parses : ''}
                    
                    <${botSettings.emote.hallsPortal}>__**Runs Led**__<${botSettings.emote.hallsPortal}>
                    Cult: ${rows[0].cultsLead}
                    Void: ${rows[0].voidsLead}
                    Events: ${parseInt(rows[0].eventsLead) * 10} minutes
                    Assists: ${rows[0].assists}
                    
                    <${botSettings.emote.Vial}>__**Vials**__<${botSettings.emote.Vial}>
                    Dropped: ${rows[0].vialStored}
                    Used: ${rows[0].vialUsed}
                    
                    🎟️__**Points**__🎟️
                    Points: ${rows[0].points}`)
                if (guildMember) embed.setThumbnail(guildMember.user.avatarURL())
                resolve(embed)
            })
        })
    },
    async updateO3Runs(id, guild, db) {
        return new Promise(async (res, rej) => {
            let ign = guild.members.cache.get(id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]
            if (!ign) return res();
            let resu = await axios.post(`https://api.losthalls.org/getProfile`, { ign: ign })
            if (!resu || resu.data.satus == 203 || !resu.data.profile.oryx3.participation.completions) return res();
            db.query(`UPDATE users SET o3runs = ${resu.data.profile.oryx3.participation.completions} WHERE id = '${id}'`, (err, rows) => {
                return res();
            })
        })
    }
}