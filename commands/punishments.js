const Discord = require('discord.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashCommandJSON } = require('../utils.js')

function buildPunishmentEmbed(rows, member, title) {
    const embed = new Discord.EmbedBuilder()
        .setColor('#F04747')
        .setDescription(`${title} for ${member}`)
    if (rows.length > 0) {
        let embedFieldStrings = []
        let embedFieldLength = 1
        for (let i = 0; i < rows.length; i++) {
            const punishment = rows[i]
            const stringText = `\`${(i + 1).toString().padStart(3, ' ')}\`${punishment.silent ? ' Silently' : ''} By <@!${punishment.modid}> <t:${(parseInt(punishment.uTime) / 1000).toFixed(0)}:R> at <t:${(parseInt(punishment.uTime) / 1000).toFixed(0)}:f>\`\`\`${punishment.reason}\`\`\`\n`
            if (embedFieldStrings == 0) embedFieldStrings.push(stringText)
            else {
                if (embedFieldStrings.join('').length + stringText.length >= 800) {
                    embed.addFields({
                        name: `${title} (${embedFieldLength})`,
                        value: embedFieldStrings.join(''),
                        inline: true
                    })
                    embedFieldLength++
                    embedFieldStrings = []
                    embedFieldStrings.push(stringText)
                } else {
                    embedFieldStrings.push(stringText)
                }
            }
        }
        if (embedFieldStrings.length > 0) {
            embed.addFields({
                name: `${title} (${embedFieldLength})`,
                value: embedFieldStrings.join(''),
                inline: true
            })
        }
        embed.setTitle(`${title} for ${member.displayName}`)
        return embed
    }
}

function flattenOnId(rows) {
    return rows.reduce((obj, row) => {
        if (!obj[row.id]) obj[row.id] = []
        obj[row.id].push(row)
        return obj
    }, {})
}

module.exports = {
    role: 'security',
    name: 'punishments',
    slashCommandName: 'pu',
    alias: ['backgroundcheck', 'pu', 'ui', 'userinfo'],
    requiredArgs: 1,
    description: 'Displays all mutes, warnings or suspensions any user has',
    varargs: true,
    args: [
        slashArg(SlashArgType.String, 'user', {
            description: 'The discord user ID, @mention, or ign you want to view'
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const { roles, rolePermissions } = settings
        const roleCache = message.guild.roles.cache

        const usersNotFound = []
        const members = []
        for (const user of args) {
            const member = message.guild.findMember(user)
            if (member) members.push(member)
            else usersNotFound.push(user)
        }

        const punishmentsByType = {}
        const memberPosition = message.member.roles.highest.position
        if (memberPosition >= roleCache.get(roles[rolePermissions.punishmentsWarnings]).position && settings.backend.punishmentsWarnings) {
            const [warnRows] = await db.promise().query('SELECT *, time as uTime FROM ?? WHERE id IN (?) AND guildid = ?', ['warns', members.map(member => member.id), message.guild.id])
            punishmentsByType['Warnings'] = flattenOnId(warnRows)
        }
        if (memberPosition >= roleCache.get(roles[rolePermissions.punishmentsSuspensions]).position && settings.backend.punishmentsSuspensions) {
            const [suspendRows] = await db.promise().query('SELECT *, false silent FROM ?? WHERE id IN (?) AND guildid = ?', ['suspensions', members.map(member => member.id), message.guild.id])
            punishmentsByType['Suspensions'] = flattenOnId(suspendRows)
        }
        if (memberPosition >= roleCache.get(roles[rolePermissions.punishmentsMutes]).position && settings.backend.punishmentsMutes) {
            const [muteRows] = await db.promise().query('SELECT *, false silent FROM ?? WHERE id IN (?) AND guildid = ?', ['mutes', members.map(member => member.id), message.guild.id])
            punishmentsByType['Mutes'] = flattenOnId(muteRows)
        }

        for (const member of members) {
            const embeds = Object.entries(punishmentsByType).map(([title, punishmentsByUserId]) => {
                return punishmentsByUserId[member.id] && buildPunishmentEmbed(punishmentsByUserId[member.id], member, title)
            }).filter(i => i)

            // Disabling eslint await in loop error because we need the
            // messages to send in order, so the await is required
            if (embeds.length > 0) {
                // eslint-disable-next-line no-await-in-loop
                await message.reply({ embeds })
            } else {
                const embed = new Discord.EmbedBuilder()
                    .setTitle('No punishments')
                    .setDescription(`${member} has no punishments in this server.`)
                    .setColor('#F04747')
                // eslint-disable-next-line no-await-in-loop
                await message.reply({ embeds: [embed] })
            }
        }

        if (usersNotFound.length > 0) {
            const embedNotFound = new Discord.EmbedBuilder()
                .setTitle('Users not found')
                .setColor('#fAA61A')
                .setDescription(usersNotFound.join(', '))
            await message.reply({ embeds: [embedNotFound] })
        }
    }
}
