const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { createEmbed } = require('../lib/extensions.js')
const { slashArg, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'supporter',
    description: 'Checks supporter usage',
    alias: ['supporters', 'supporterusage'],
    role: 'raider',
    args: [
        slashArg(SlashArgType.User, 'user', {
            required: false,
            description: 'Supporter to check usage for'
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        const botSettings = bot.settings[message.guild.id]
        const member = message.guild.findMember(args.join('')) || message.mentions.members.first() || message.member
        const supporterRoles = botSettings.lists.perkRoles.map(role => message.guild.roles.cache.get(botSettings.roles[role]))
        if (!member.roles.cache.hasAny(...supporterRoles.map(role => role?.id))) {
            return await message.reply({ embeds: [createEmbed(message, `This user \`${member.displayName}\` ${member} does not have one of the required Supporter Roles ${supporterRoles.join(', ')}.`, null)], ephemeral: true })
        }
        const supporterNumber = member.supporterHierarchy(botSettings)
        const supporterRole = message.guild.roles.cache.get(member.supporterRoleHierarchy(botSettings))
        if (!supporterRole) {
            return await message.reply({ embeds: [createEmbed(message, `This server does not have at least one of the required Supporter Roles ${supporterRoles.join(', ')} correctly defined.`, null)], ephemeral: true })
        }
        const cooldown = botSettings.supporter[`supporterCooldownSeconds${supporterNumber}`]
        const uses = botSettings.supporter[`supporterUses${supporterNumber}`]
        const lastUseCheck = Date.now() - (cooldown * 1000)
        const [rows,] = await db.promise().query('SELECT * FROM supporterusage WHERE guildid = ? AND userid = ? AND utime > ?', [message.guild.id, member.id, lastUseCheck])
        let cooldownText = ''
        if (cooldown < 3600) cooldownText = `\`${(cooldown / 60).toFixed(0)}\` minutes`
        else cooldownText = `\`${(cooldown / 3600).toFixed(0)}\` hours`
        const embed = createEmbed(message, `Your highest Supporter Role is ${supporterRole}.\nYour Supporter Perk usage is currently at \`${rows.length}\` out of \`${uses}\` uses and regenerates after ${cooldownText}.\n`, null)
        embed.setTitle(`Supporter Usage for \`${member.displayName}\``)
        if (rows.length > 0) {
            embed.data.description += `Your next use will regenerate <t:${(((cooldown * 1000) + parseInt(rows[0].utime)) / 1000).toFixed(0)}:R>.\n`
            let supporterUses = ''
            for (const row of rows) supporterUses += `- <t:${(row.utime / 1000).toFixed(0)}:R>\n`
            embed.addFields({ name: 'Uses', value: supporterUses })
        }
        await message.reply({ embeds: [embed], ephemeral: true })
    }
}
