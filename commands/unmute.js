const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const fs = require('fs')

module.exports = {
    name: 'unmute',
    description: 'Removes muted role from user',
    args: '<ign/mention/id>',
    requiredArgs: 1,
    role: 'security',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be unmuted by you`);
        let muted = settings.roles.muted
        if (!member.roles.cache.has(muted)) {
            message.channel.send(`${member} is not muted`)
            return;
        }
        db.query(`SELECT * FROM mutes WHERE id = '${member.id}' AND muted = true`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (!rows || rows.length == 0) {
                let embed = new Discord.MessageEmbed()
                    .setTitle('Confirm Action')
                    .setColor('#ff0000')
                    .setDescription(`I don't have any log of ${member} being muted. Are you sure you want to unmute them?`)
                let confirmMessage = await message.channel.send(embed)
                let reactionCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
                reactionCollector.on('collect', async (r, u) => {
                    confirmMessage.delete()
                    if (r.emoji.name !== '✅') return;
                    member.roles.remove(muted).catch(er => ErrorLogger.log(er, bot))
                    message.channel.send(`${member} has been unmuted`)
                })
                await confirmMessage.react('✅')
                await confirmMessage.react('❌')
            } else {
                const reason = rows[0].reason
                const unmuteDate = new Date(rows[0].uTime)
                let embed = new Discord.MessageEmbed()
                    .setTitle('Confirm Action')
                    .setColor('#ff0000')
                    .setDescription(`Are you sure you want to unmute ${member}\nReason: ${reason}\nMuted by <@!${rows[0].modid}>\nMuted until: ${unmuteDate.toDateString()}`)
                let confirmMessage = await message.channel.send(embed)
                let reactionCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
                await confirmMessage.react('✅')
                await confirmMessage.react('❌')
                reactionCollector.on('collect', async (r, u) => {
                    confirmMessage.delete()
                    if (r.emoji.name !== '✅') return;
                    await member.roles.remove(muted).catch(er => ErrorLogger.log(er, bot))
                    message.channel.send(`${member} has been unmuted`)
                    db.query(`UPDATE mutes SET muted = false WHERE id = '${member.id}'`)
                })
            }
        })
    }
}