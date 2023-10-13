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
        if (message.member.roles.highest.position < message.guild.roles.cache.get(botSettings.roles.minimumSupporterCheckRole) && args.length > 0) return await message.reply({ embeds: [createEmbed(message, `You do not have the required role ${message.guild.roles.cache.get(botSettings.roles.minimumSupporterCheckRole)} to use this command.`, null)], ephemeral: true })
        const member = message.guild.findMember(args.join('')) || message.member
        const supporterRoles = botSettings.lists.perkRoles.map(role => message.guild.roles.cache.get(botSettings.roles[role]))
        const supporterError = []

        let rolesText = ''
        let cooldownText = ''
        let useText = ''
        for (const role of supporterRoles) {
            const supporterNumber = role.supporterHierarchy(botSettings)
            const cooldown = botSettings.supporter[`supporterCooldownSeconds${supporterNumber}`]
            const uses = botSettings.supporter[`supporterUses${supporterNumber}`]
            if (supporterNumber == 0) {supporterError.push(role); continue}
            if (!botSettings.supporter[`supporterCooldownSeconds${supporterNumber}`]) {supporterError.push(role); continue}
            if (!botSettings.supporter[`supporterUses${supporterNumber}`]) {supporterError.push(role); continue}
            rolesText += `${role}\n`
            cooldownText += (cooldown < 86400) ? ((cooldown < 3600) ? `\`${(cooldown / 60).toFixed(0)}\` Minutes\n` : `\`${(cooldown / 3600).toFixed(0)}\` Hours\n`) : `\`${(cooldown / 86400).toFixed(0)}\` Days\n`
            useText += `\`${uses}\`\n`
        }
        if (supporterError.length > 0) return await message.reply({ embeds: [createEmbed(message, `The server has incorrectly defined one of the following Supporter Roles:\n${supporterRoles.join(', ')}`, null)], ephemeral: true })
        if (member.roles.highest.position < message.guild.roles.cache.get(botSettings.roles.minimumSupporterCheckRole)) return await message.reply({ embeds: [createEmbed(message, `You do not have the required role ${message.guild.roles.cache.get(botSettings.roles.minimumSupporterCheckRole)} to use this command.`, null)], ephemeral: true })

        const embed = createEmbed(message, `Available Supporter Perks for ${member}\n`, null)
        embed.setAuthor({ name: member.displayName, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        embed.setTitle('Current Uses')
        if (!member.roles.cache.hasAny(...supporterRoles.map(role => role?.id))) {
            embed.data.description = `Supporter Perks are unavailable for ${member}\nAvailable Supporter Role information for this server`
            embed.addFields({ name: 'Supporter Roles', value: rolesText, inline: true },
                { name: 'Cooldown', value: cooldownText, inline: true },
                { name: 'Uses', value: useText, inline: true })
            return await message.reply({ embeds: [embed], ephemeral: true })
        }

        const supporterNumber = member.supporterHierarchy(botSettings)
        const supporterRole = message.guild.roles.cache.get(member.supporterRoleHierarchy(botSettings))
        const cooldown = botSettings.supporter[`supporterCooldownSeconds${supporterNumber}`]
        const uses = botSettings.supporter[`supporterUses${supporterNumber}`]
        const lastUseCheck = Date.now() - (cooldown * 1000)
        const [rows,] = await db.promise().query('SELECT * FROM supporterusage WHERE guildid = ? AND userid = ? AND utime > ?', [message.guild.id, member.id, lastUseCheck])
        embed.setThumbnail(supporterRole?.iconURL({ dynamic: true }))
        embed.setColor(supporterRole?.color)
        embed.addFields({ name: 'Supporter Role', value: `${supporterRole}`, inline: true },
            { name: 'Next Usage', value: `${rows.length >= uses ? `<t:${(((cooldown * 1000) + parseInt(rows[0].utime)) / 1000).toFixed(0)}:f>` : '**Now**'}`, inline: true },
            { name: 'Uses Left', value: `\`${uses - rows.length}/${uses}\`  ${(rows.length > 0) ? `(\`+1\` <t:${(((cooldown * 1000) + parseInt(rows[0].utime)) / 1000).toFixed(0)}:R>)` : ''}`, inline: true })
        if (rows.length > 0) {
            const supporterUses = rows.map(row => `- <t:${(row.utime / 1000).toFixed(0)}:f>`).join('\n')
            embed.addFields({ name: 'Past Usage', value: supporterUses })
        }
        await message.reply({ embeds: [embed], ephemeral: true })
    }
}
