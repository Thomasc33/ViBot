const Discord = require('discord.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { createEmbed } = require('../lib/extensions.js')
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'supporter',
    description: 'Checks supporter usage',
    alias: ['supporters', 'supporterusage'],
    role: 'raider',
    args: [
        slashArg(SlashArgType.User, 'user', {
            required: false,
            description: 'Supporter to check usage for',
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        const botSettings = bot.settings[message.guild.id]
        const member = message.guild.members.cache.get(args[0]) || message.mentions.members.first() || message.member
        const supporterRoles = botSettings.lists.perkRoles.map(role => message.guild.roles.cache.get(botSettings.roles[role]))
        if (!member.roles.cache.hasAny(...supporterRoles.map(role => role.id))) {
            return await message.reply({ embeds: [createEmbed(message, `This user \`${member.displayName}\` ${member} does not have one of the required Supporter Roles ${supporterRoles.join(', ')}.`, null)], ephemeral: true })
        }
        const supporterNumber = member.supporterHierarchy(botSettings)
        const supporterRole = message.guild.roles.cache.get(member.supporterRoleHierarchy(botSettings))
        if (!supporterRole) {
            return await message.reply({ embeds: [createEmbed(message, `This server does not have at least one of the required Supporter Roles ${supporterRoles.join(', ')} correctly defined.`, null)], ephemeral: true })
        }
        let cooldown = botSettings.supporter[`supporterCooldownSeconds${supporterNumber}`]
        let uses = botSettings.supporter[`supporterUses${supporterNumber}`]
        let lastUseCheck = Date.now() - (cooldown * 1000)
        let [rows,] = await db.promise().query(`SELECT * FROM supporterusage WHERE guildid = ? AND userid = ? AND utime > ?`, [message.guild.id, member.id, lastUseCheck])
        let cooldown_text = ''
        if (cooldown < 3600) cooldown_text = `\`${(cooldown/60).toFixed(0)}\` minutes`
        else cooldown_text = `\`${(cooldown/3600).toFixed(0)}\` hours`
        const embed = createEmbed(message, `Your highest Supporter Role is ${supporterRole}.\nYour perks are limited to \`${uses}\` times every ${cooldown_text}.\n`, null)
        embed.setTitle(`Supporter Usage for \`${member.displayName}\``)
        switch (rows.length) {
            case (rows.length > uses):
                embed.description += `Your next use is available <t:${(((cooldown*1000)+parseInt(rows[0].utime))/1000).toFixed(0)}:R>`
            case (rows.length > 0):
                embed.description += `You have used your perks \`${rows.length}\` times in the last ${cooldown_text}.\n`
                for (const row of rows) embed.addFields({ name: ' ', value: `Used Supporter Perks <t:${(row.utime/1000).toFixed(0)}:R>` })
                break
            default:
                embed.description += `You have not used your perks in the last ${cooldown_text}.\n`
                break

        }
        await message.reply({ embeds: [embed], ephemeral: true})
    },
}