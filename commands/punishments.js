const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const moment = require('moment');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

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
            description: "The discord user ID, @mention, or ign you want to view"
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        var usersNotFound = [];
        for (let i in args) {
            let user = args[i]
            let member = message.guild.findMember(user)
            if (!member) { usersNotFound.push(user); continue; }
            let embed = new Discord.EmbedBuilder()
                .setTitle(`Punishments for ${member.nickname}`)
                .setColor('#F04747')
            db.query(`SELECT * FROM warns WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async function (err, warnings) {
                if (err) ErrorLogger.log(err, bot, message.guild)
                db.query(`SELECT * FROM suspensions WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async function (err, suspensions) {
                    if (err) ErrorLogger.log(err, bot, message.guild)
                    db.query(`SELECT * FROM mutes WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async function (err, mutes) {
                        if (err) ErrorLogger.log(err, bot, message.guild)
                        if (warnings.length > 0) {
                            let warningValue = ``
                            let warningName = `Warnings`
                            for (let i in warnings) {
                                let index = parseInt(i)
                                let warning = warnings[i]
                                let currentWarning = `${index+1}. ${warning.silent ? 'Silently ' : ''}By <@!${warning.modid}> <t:${(parseInt(warning.time)/1000).toFixed(0)}:R> at <t:${(parseInt(warning.time)/1000).toFixed(0)}:f>\`\`\`${warning.reason}\`\`\`\n`
                                if (warningValue.length + currentWarning.length > 1024) {
                                    embed.addFields({ name: warningName, value: warningValue, inline: false })
                                    warningValue = ``
                                    warningName = `Warnings Continued`
                                }
                                warningValue += currentWarning
                            }
                            embed.addFields({ name: warningName, value: warningValue, inline: false })
                        }
                        if (suspensions.length > 0) {
                            let suspensionValue = ``
                            let suspensionName = `Suspensions`
                            for (let i in suspensions) {
                                let index = parseInt(i)
                                let suspension = suspensions[i]
                                let currentSuspension = `${index+1}. By <@!${suspension.modid}> ${suspension.suspended ? 'Ends' : 'Ended'} <t:${(parseInt(suspension.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(suspension.uTime)/1000).toFixed(0)}:f>\`\`\`${suspension.reason}\`\`\`\n`
                                if (suspensionValue.length + currentSuspension.length > 1024) {
                                    embed.addFields({ name: suspensionName, value: suspensionValue, inline: false })
                                    suspensionValue = ``
                                    suspensionName = `Suspensions Continued`
                                }
                                suspensionValue += currentSuspension
                            }
                            embed.addFields({ name: suspensionName, value: suspensionValue, inline: false })
                        }
                        if (mutes.length > 0) {
                            let muteValue = ``
                            let muteName = `Mutes`
                            for (let i in mutes) {
                                let index = parseInt(i)
                                let mute = mutes[i]
                                let currentMute = `${index+1}. By <@!${mute.modid}> ${mute.muted ? 'Ends' : 'Ended'} <t:${(parseInt(mute.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(mute.uTime)/1000).toFixed(0)}:f>\`\`\`${mute.reason}\`\`\`\n`
                                if (muteValue.length + currentMute.length > 1024) {
                                    embed.addFields({ name: muteName, value: muteValue, inline: false })
                                    muteValue = ``
                                    muteName = `Mutes Continued`
                                }
                                muteValue += currentMute
                            }
                            embed.addFields({ name: muteName, value: muteValue, inline: false })
                        }
                        if (!embed.data.fields || embed.data.fields.length == 0) {
                            embed.setDescription(`No punishments have been issued for ${member}`)
                        }
                        await message.reply({ embeds: [embed] })
                    })
                })
            })
        }
        if (usersNotFound.length > 0) {
            let embedNotFound = new Discord.EmbedBuilder()
                .setTitle('Users not found')
                .setColor('#fAA61A')
                .setDescription(usersNotFound.join(', '))
            await message.reply({ embeds: [embedNotFound] })
        }
    }
}
