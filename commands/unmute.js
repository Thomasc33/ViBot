const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const fs = require('fs')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'unmute',
    description: 'Removes muted role from user',
    args: '<ign/mention/id>',
    requiredArgs: 1,
    role: 'security',
    args: [
        slashArg(SlashArgType.User, 'member', {
            description: 'Member in the Server'
        }),
    ],
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild)
    },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()))
        if (!member) { message.reply('User not found. Please try again'); return }
        if (member.roles.highest.position >= message.member.roles.highest.position) return message.reply(`${member} has a role greater than or equal to you and cannot be unmuted by you`)
        const { muted } = settings.roles
        if (!member.roles.cache.has(muted)) {
            message.reply(`${member} is not muted`)
            return
        }
        db.query(`SELECT * FROM mutes WHERE id = '${member.id}' AND muted = true`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot, message.guild)
            if (!rows || rows.length == 0) {
                const embed = new Discord.EmbedBuilder()
                    .setTitle('Confirm Action')
                    .setColor('#ff0000')
                    .setDescription(`I don't have any log of ${member} being muted. Are you sure you want to unmute them?`)
                const confirmMessage = await message.channel.send({ embeds: [embed] })
                const reactionCollector = new Discord.ReactionCollector(confirmMessage, { filter: (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌') })
                reactionCollector.on('collect', async (r, u) => {
                    confirmMessage.delete()
                    if (r.emoji.name !== '✅') return
                    member.roles.remove(muted).catch(er => ErrorLogger.log(er, bot, message.guild))
                    message.channel.send(`${member} has been unmuted`)
                })
                await confirmMessage.react('✅')
                await confirmMessage.react('❌')
            } else {
                const { reason } = rows[0]
                const unmuteUTime = parseInt(rows[0].uTime)
                const embed = new Discord.EmbedBuilder()
                    .setTitle('Confirm Action')
                    .setColor('#ff0000')
                    .setDescription(`Are you sure you want to unmute ${member}\nReason: ${reason}\nMuted by <@!${rows[0].modid}>\nUnmute: <t:${(unmuteUTime / 1000).toFixed(0)}:R> at <t:${(unmuteUTime / 1000).toFixed(0)}:f>`)
                const confirmMessage = await message.channel.send({ embeds: [embed] })
                const reactionCollector = new Discord.ReactionCollector(confirmMessage, { filter: (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌') })
                await confirmMessage.react('✅')
                await confirmMessage.react('❌')
                reactionCollector.on('collect', async (r, u) => {
                    confirmMessage.delete()
                    if (r.emoji.name !== '✅') return
                    await member.roles.remove(muted).catch(er => ErrorLogger.log(er, bot, message.guild))
                    message.reply(`${member} has been unmuted`)
                    db.query(`UPDATE mutes SET muted = false WHERE id = '${member.id}'`)
                })
            }
        })
    }
}
