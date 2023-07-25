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

            const embeds = [];
            const memberPosition = member.roles.highest.position;

            if (
                (memberPosition >= message.guild.roles.cache.get(settings.roles[settings.rolePermissions.punishmentsWarnings]).position) &&
                settings.backend.punishmentsWarnings) {
                const row = await db.promise().query(`SELECT * FROM warns WHERE id = '${member.id}' AND guildid = '${message.guild.id}'`);
                let embed = new Discord.EmbedBuilder()
                    .setColor('#F04747')
                if (row[0].length > 0) {
                    let embedFieldStrings = [];
                    let embedFieldLength = 1;
                    for (let i in row[0]) {
                        let index = parseInt(i) + 1
                        const punishment = row[0][i];
                        const stringText = `\`${index.toString().padStart(3, ' ')}\`${punishment.silent ? ' Silently' : ''} By <@!${punishment.modid}> <t:${(parseInt(punishment.time)/1000).toFixed(0)}:R> at <t:${(parseInt(punishment.time)/1000).toFixed(0)}:f>\`\`\`${punishment.reason}\`\`\`\n`
                        if (embedFieldStrings == 0) { embedFieldStrings.push(stringText) }
                        else {
                            if (embedFieldStrings.join('').length + stringText.length >= 1024) {
                                embed.addFields({
                                    name: `Warnings (${embedFieldLength})`,
                                    value: embedFieldStrings.join(''),
                                    inline: true
                                });
                                embedFieldLength++;
                                embedFieldStrings = [];
                            } else {
                                embedFieldStrings.push(stringText);
                            }
                        }
                    }
                    embed.addFields({
                        name: `Warnings (${embedFieldLength})`,
                        value: embedFieldStrings.join(''),
                        inline: true
                    });
                    embed.setTitle(`Warnings for ${member.displayName}`)
                    embeds.push(embed);
                }
            }

            if (
                (memberPosition >= message.guild.roles.cache.get(settings.roles[settings.rolePermissions.punishmentsSuspensions]).position) &&
                settings.backend.punishmentsSuspensions) {
                const row = await db.promise().query(`SELECT * FROM suspensions WHERE id = '${member.id}' AND guildid = '${message.guild.id}'`);
                let embed = new Discord.EmbedBuilder()
                    .setColor('#F04747')
                if (row[0].length > 0) {
                    const embedFieldStrings = [];
                    let embedFieldLength = 1;
                    for (let i in row[0]) {
                        let index = parseInt(i) + 1
                        const punishment = row[0][i];
                        const stringText = `\`${index.toString().padStart(3, ' ')}\` By <@!${punishment.modid}> <t:${(parseInt(punishment.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(punishment.uTime)/1000).toFixed(0)}:f>\`\`\`${punishment.reason}\`\`\`\n`
                        if (embedFieldStrings == 0) { embedFieldStrings.push(stringText) }
                        else {
                            if (embedFieldStrings.join('').length + stringText.length >= 1024) {
                                embed.addFields({
                                    name: `Suspensions (${embedFieldLength})`,
                                    value: embedFieldStrings.join(''),
                                    inline: true
                                });
                                embedFieldLength++;
                            } else {
                                embedFieldStrings.push(stringText);
                            }
                        }
                    }
                    embed.addFields({
                        name: `Suspensions (${embedFieldLength})`,
                        value: embedFieldStrings.join(''),
                        inline: true
                    });
                    embed.setTitle(`Suspensions for ${member.displayName}`)
                    embeds.push(embed);
                }
            }

            if (
                (memberPosition >= message.guild.roles.cache.get(settings.roles[settings.rolePermissions.punishmentsMutes]).position) &&
                settings.backend.punishmentsMutes) {
                const row = await db.promise().query(`SELECT * FROM mutes WHERE id = '${member.id}' AND guildid = '${message.guild.id}'`);
                let embed = new Discord.EmbedBuilder()
                    .setColor('#F04747')
                if (row[0].length > 0) {
                    const embedFieldStrings = [];
                    let embedFieldLength = 1;
                    for (let i in row[0]) {
                        let index = parseInt(i) + 1
                        const punishment = row[0][i];
                        const stringText = `\`${index.toString().padStart(3, ' ')}\` By <@!${punishment.modid}> <t:${(parseInt(punishment.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(punishment.uTime)/1000).toFixed(0)}:f>\`\`\`${punishment.reason}\`\`\`\n`
                        if (embedFieldStrings == 0) { embedFieldStrings.push(stringText) }
                        else {
                            if (embedFieldStrings.join('').length + stringText.length >= 1024) {
                                embed.addFields({
                                    name: `Mutes (${embedFieldLength})`,
                                    value: embedFieldStrings.join(''),
                                    inline: true
                                });
                                embedFieldLength++;
                            } else {
                                embedFieldStrings.push(stringText);
                            }
                        }
                    }
                    embed.addFields({
                        name: `Mutes (${embedFieldLength})`,
                        value: embedFieldStrings.join(''),
                        inline: true
                    });
                    embed.setTitle(`Mutes for ${member.displayName}`);
                    embeds.push(embed);
                }
            }

            if (embeds.length > 0) {
                await message.reply({ embeds: embeds });
            } else {
                let embed = new Discord.EmbedBuilder()
                    .setTitle('No punishments')
                    .setDescription(`${member} has no punishments in this server.`)
                    .setColor('#F04747')
                await message.reply({ embeds: [embed] });
            }
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
