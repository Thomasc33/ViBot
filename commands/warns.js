const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'warns',
    description: 'Displays all warns for all inputted users',
    role: 'eventrl',
    requiredArgs: 1,
    args: '[Users]',
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
        const securityRole = message.guild.roles.cache.get(settings.roles.security)
        const usersNotFound = []
        for (const i in args) {
            const user = args[i]
            const member = message.guild.findMember(user)
            if (!member) { usersNotFound.push(user); continue }

            const embed = new Discord.EmbedBuilder()
                .setColor('#F04747')
                .setTitle(`Warnings for ${member.nickname}`)
                .setFooter({ text: member.user.id })
            const partneredServer = bot.fetchPartneredServer(message.guild.id)
            db.query(`SELECT * FROM warns WHERE id = '${member.user.id}'`, async (err, rows) => {
                if (err) ErrorLogger.log(err, bot, message.guild)
                for (const i in rows) { const index = parseInt(i); rows[i].index = index}
                const warningsServer = []
                const warningsPartnered = []
                const warningsNull = []
                for (const i in rows) {
                    const row = rows[i]
                    if (row.guildid == message.guild.id) warningsServer.push(row)
                    else if (partneredServer && row.guildid == partneredServer.id) warningsPartnered.push(row)
                    else if (row.guildid == null) warningsNull.push(row)
                }
                if (warningsServer.length > 0) {
                    let warningValue = ''
                    let warningName = `${message.guild.name}'s Section`
                    for (const i in warningsServer) {
                        const index = parseInt(i)
                        const warning = warningsServer[i]
                        const currentWarning = `${index + 1}. ${warning.silent ? 'Silently ' : ''}By <@!${warning.modid}> <t:${(parseInt(warning.time) / 1000).toFixed(0)}:R> at <t:${(parseInt(warning.time) / 1000).toFixed(0)}:f>\`\`\`${warning.reason}\`\`\`\n`
                        if (warningValue.length + currentWarning.length > 1024) {
                            embed.addFields({ name: warningName, value: warningValue, inline: false })
                            warningValue = ''
                            warningName = `${message.guild.name}'s Section Continued`
                        }
                        warningValue += currentWarning
                    }
                    embed.addFields({ name: warningName, value: warningValue, inline: false })
                }
                if (message.member.roles.highest.position >= securityRole.position || bot.adminUsers.includes(message.member.id)) {
                    if (warningsPartnered.length > 0) {
                        let warningValue = ''
                        let warningName = `${partneredServer.name}'s Section`
                        for (const i in warningsPartnered) {
                            const index = parseInt(i)
                            const warning = warningsPartnered[i]
                            const currentWarning = `${index + 1}. ${warning.silent ? 'Silently ' : ''}By <@!${warning.modid}> <t:${(parseInt(warning.time) / 1000).toFixed(0)}:R> at <t:${(parseInt(warning.time) / 1000).toFixed(0)}:f>\`\`\`${warning.reason}\`\`\`\n`
                            if (warningValue.length + currentWarning.length > 1024) {
                                embed.addFields({ name: warningName, value: warningValue, inline: false })
                                warningValue = ''
                                warningName = `${partneredServer.name}'s Section Continued`
                            }
                            warningValue += currentWarning
                        }
                        embed.addFields({ name: warningName, value: warningValue, inline: false })
                    }
                    if (warningsNull.length > 0) {
                        let warningValue = ''
                        let warningName = 'Unknown Server'
                        for (const i in warningsNull) {
                            const index = parseInt(i)
                            const warning = warningsNull[i]
                            const currentWarning = `${index + 1}. ${warning.silent ? 'Silently ' : ''}By <@!${warning.modid}> <t:${(parseInt(warning.time) / 1000).toFixed(0)}:R> at <t:${(parseInt(warning.time) / 1000).toFixed(0)}:f>\`\`\`${warning.reason}\`\`\`\n`
                            if (warningValue.length + currentWarning.length > 1024) {
                                embed.addFields({ name: 'Unknown Server', value: warningValue, inline: false })
                                warningValue = ''
                                warningName = 'Unknown Server Continued'
                            }
                            warningValue += currentWarning
                        }
                        embed.addFields({ name: warningName, value: warningValue, inline: false })
                    }
                }
                if (!embed.data.fields || embed.data.fields.length == 0) {
                    embed.setDescription(`No warnings have been issued for ${member}`)
                }
                await message.reply({ embeds: [embed] })
            })
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
