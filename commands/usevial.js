const ErrorLogger = require('../lib/logError')
const Discord = require('discord.js')

module.exports = {
    name: 'usevial',
    alias: ['uv'],
    description: 'Adds popped vial to user',
    guildSpecific: true,
    args: '<user>',
    requiredArgs: 1,
    role: 'vetaffiliate',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) { message.channel.send('User not found'); return; }
        db.query(`SELECT * FROM users WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            let points
            if (settings.backend.points) {
                if (member.roles.cache.has(settings.roles.nitro) || member.roles.cache.has(settings.roles.supporter)) points = settings.points.vialpop * settings.points.nitromultiplier
                else points = settings.points.vialpop
                db.query(`UPDATE users SET vialUsed = ${parseInt(rows[0].vialUsed) + 1}, points = points + ${points} WHERE id = '${member.id}'`)
            } else {
                db.query(`UPDATE users SET vialUsed = ${parseInt(rows[0].vialUsed) + 1} WHERE id = '${member.id}'`)
            }
            message.channel.send({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setDescription(`Vial logged. They now have ${parseInt(rows[0].vialUsed) + 1} vials popped`)
                        .setTimestamp()
                        .setColor('#0c045c')
                        .setThumbnail('https://cdn.discordapp.com/emojis/701491230567039018.png?v=1')
                ]
            })
            message.guild.channels.cache.get(settings.channels.viallog).send({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setDescription(`Vial pop added to ${member} (${member.nickname}), logged by ${message.member} (${parseInt(rows[0].vialUsed) + 1} total pops)${settings.backend.points ? `\n${points} points added \`${parseInt(rows[0].points) + points}\` total` : ''}`)
                        .setTimestamp()
                        .setColor('#0c045c')
                        .setThumbnail('https://cdn.discordapp.com/emojis/701491230567039018.png?v=1')
                ]
            })
        })
    }
}