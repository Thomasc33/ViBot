const { EmbedBuilder, Colors } = require('discord.js');
const moment = require('moment');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

/**
 * @typedef MuteRow
 * @property {string} id
 * @property {string} modid
 * @property {string} guildid
 * @property {string} reason
 * @property {number} appliedOn
 * @property {number} duration
 * @property {number?} removedOn
 * @property {string?} removedBy
 * @property {string?} removeReason
 */

/**
 *
 * @param {number} duration
 * @returns {string}
 */
function durationString(duration, when = Date.unix()) {
    if (!duration) return 'Permanent';
    duration = parseInt(duration);
    when = parseInt(when);
    const mmt = moment.duration(duration * 1000).humanize();
    return `${mmt[0].toUpperCase()}${mmt.substring(1)} ending <t:${when + duration}:R> at <t:${when + duration}:f>`;
}

/**
 * @param {MuteRow} row
 * @param {import('discord.js').GuildMember} member
 * @param {number?} duration
 */
async function attemptOverwrite(db, row, member, duration) {
    const removeReason = `Overwritten by ${member} on <t:${Date.unix()}:f> ${durationString(duration)}`;
    await db.promise().query('UPDATE mutes SET removedOn = unix_timestamp(), removedBy = ?, removeReason = ? WHERE id = ? AND guildid = ? AND removedOn IS NULL',
        [member.id, removeReason, row.id, row.guildid]);
}

/**
 *
 * @param {string} duration
 * @param {number} time
 */
function processDuration(duration, time) {
    duration = duration.toLowerCase();
    if (duration.startsWith('mo')) return time * 2_592_000;
    switch (duration[0]) {
        case 's': return time;
        case 'm': return time * 60;
        case 'h': return time * 3_600;
        case 'd': return time * 86_400;
        case 'w': return time * 604_800;
        case 'y': return time * 31_536_000;
        default:
    }
}

/**
 * @param {import('../utils.js').BotCommandInteraction} interaction
 * @param {MuteRow} row
 * @returns {{
 *  overwrite: boolean;
 *  mute: boolean
 * }}
*/
async function confirmOverwrite(interaction, member, row, duration, reason) {
    const mod = interaction.guild.members.cache.get(row.modid);
    const embed = new EmbedBuilder()
        .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
        .setTitle('Confirm Mute Override')
        .setDescription(`<@${row.id}> currently has an active mute. Do you want to override this mute?`)
        .setColor(Colors.Blue)
        .setTimestamp()
        .addFields({ name: 'Old Moderator', value: mod ? `${mod} \`${mod.displayName}\`` : `<@${row.modid}>`, inline: true },
            { name: 'Applied On', value: `<t:${row.appliedOn}:f>`, inline: true },
            { name: 'Old Expires', value: durationString(row.duration, row.appliedOn), inline: true },
            { name: 'Old Reason', value: row.reason },
            { name: 'New Moderator', value: `${interaction.member} \`${interaction.member.displayName}\``, inline: true },
            { name: 'New Expires', value: durationString(duration), inline: true },
            { name: 'New Reason', value: reason });

    const message = await interaction.editReply({ embeds: [embed], fetchReply: true });
    return await message.confirmButton(interaction.member.id);
}

/**
 * @param {import('../utils.js').BotCommandInteraction} interaction
 * @param {import('discord.js').GuildMember} member
 */
async function confirmUnmanagedMute(interaction, member, duration, reason) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
        .setTitle('Unmanaged Mute')
        .setDescription(`${member} has a mute currently not managed by ${interaction.client.user}. Would you like to have it managed with the following information?`)
        .setColor(Colors.Blue)
        .addFields({ name: 'Member', value: `${member} \`${member.displayName}\``, inline: true },
            { name: 'Moderator', value: `${interaction.member} \`${interaction.member.displayName}\``, inline: true },
            { name: 'Expires', value: durationString(duration), inline: true },
            { name: 'Reason', value: reason });

    const message = await interaction.editReply({ embeds: [embed], fetchReply: true });
    return await message.confirmButton(interaction.member.id);
}

module.exports = {
    name: 'mute',
    description: 'Gives user the muted role',
    role: 'security',
    args: [
        slashArg(SlashArgType.Subcommand, 'temporary', {
            description: 'Temporarily mute member',
            options: [
                slashArg(SlashArgType.User, 'member', {
                    description: 'Server member to mute'
                }),
                slashArg(SlashArgType.Integer, 'time', {
                    description: 'The amount of time for the mute'
                }),
                slashArg(SlashArgType.String, 'duration', {
                    description: 'The type of duration for the mute'
                }),
                slashArg(SlashArgType.String, 'reason', {
                    description: 'The reason for the permanent mute',
                    varargs: true
                })
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'permanent', {
            description: 'Permanently mute member',
            options: [
                slashArg(SlashArgType.User, 'member', {
                    description: 'Server member to mute'
                }),
                slashArg(SlashArgType.String, 'reason', {
                    description: 'The reason for the permanent mute',
                    varargs: true
                })
            ]
        }),
    ],
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild);
    },

    /**
     * @param {import('../utils.js').BotCommandInteraction?} interaction
     * @param {import('discord.js').GuildMember} member
     * @param {number?} duration
     * @param {string} reason
     * @param {MuteRow?} row - Row to overwrite
     */
    async mute(settings, db, interaction, member, duration, reason, row) {
        const moderator = interaction?.member || member.client.user;
        const endTime = Date.now() + duration;

        const embed = new EmbedBuilder()
            .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
            .setTitle('Mute Information')
            .setDescription(`The mute is ${duration ? 'for ' + moment.duration(duration * 1000).humanize(false) : 'permanent'}`)
            .setFooter({ text: duration ? 'Unmuting at' : 'Permanent' })
            .setColor(Colors.Green)
            .setTimestamp(endTime)
            .addFields({ name: 'Member', value: `${member} \`${member.displayName}\``, inline: true },
                { name: 'Moderator', value: `${moderator} \`${moderator.displayName}\``, inline: true },
                { name: 'Expires', value: durationString(duration), inline: true },
                { name: 'Reason', value: reason });

        if (row) {
            await attemptOverwrite(db, row, moderator, duration);
            const mod = member.guild.members.cache.get(row.modid);
            embed.addFields({ name: 'Overwrote Mute', value: '\u000B' },
                { name: 'Old Moderator', value: mod ? `${mod} \`${mod.displayName}\`` : `<@${row.modid}>`, inline: true },
                { name: 'Applied On', value: `<t:${row.appliedOn}:f>`, inline: true },
                { name: 'Old Expires', value: durationString(row.duration, row.appliedOn), inline: true },
                { name: 'Old Reason', value: row.reason });
        }
        if (reason.length > 1024) reason = reason.substring(0, 1021) + '...';
        await db.promise().query('INSERT INTO mutes (id, modid, guildid, reason, duration) VALUES (?, ?, ?, ?, ?)', [member.id, moderator.id, member.guild.id, reason, duration || 0])
            .catch(console.log);
        member.roles.add(settings.roles.muted);

        if (interaction) {
            const message = await interaction.fetchReply();
            if (!message) await interaction.reply({ embeds: [embed] });
            else await interaction.editReply({ embeds: [embed], components: [] });
        }
        await member.guild.channels.cache.get(settings.channels.modlogs)?.send({ embeds: [embed] });

        embed.setColor(Colors.Red).setDescription(`You have been muted in the ${member.guild.name} discord. The mute is ${duration ? 'for ' + moment.duration(duration * 1000).humanize(false) : 'permanent'}`);
        const dm = await member.createDM().catch(() => {});
        await dm?.send({ embeds: [embed] }).catch(() => {});
    },

    /**
     * @param {import('../utils.js').BotCommandInteraction} interaction
     * @param {string[]} args ignored
     * @param {import('discord.js').Client} bot
     * @param {import('mysql2').Pool} db
     */
    async execute(interaction, args, bot, db) {
        const settings = bot.settings[interaction.guild.id];
        const member = interaction.options.getMember('member');
        const reason = interaction.options.getString('reason');
        const type = interaction.options.getSubcommand();
        const duration = type == 'permanent' ? 0 : processDuration(interaction.options.getString('duration'), interaction.options.getInteger('time'));
        const embed = new EmbedBuilder()
            .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
            .setColor(Colors.Blue)
            .setTimestamp()
            .setFooter({ text: `Ran by ${interaction.member.displayName}` })
            .setTitle('Processing Mute')
            .setDescription('Please wait...');

        await interaction.reply({ embeds: [embed] });

        if (type != 'permanent' && !duration) {
            embed.setColor(Colors.Red)
                .setDescription(`\`${interaction.options.getInteger('time')} ${interaction.options.getString('duration')}\` is not a valid duration.`);
            return await interaction.editReply({ embeds: [embed] });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            embed.setColor(Colors.Red)
                .setDescription(`${member} has a role greater than or equal to your own and you cannot mute them.`);
            return await interaction.editReply({ embeds: [embed] });
        }

        const [rows] = await db.promise().query('SELECT * FROM mutes WHERE id = ? AND guildid = ? AND removedOn IS NULL', [member.id, member.guild.id]);

        if (rows.length && !await confirmOverwrite(interaction, member, rows[0], duration, reason)) {
            embed.setColor(Colors.Red)
                .setDescription('Cancelled mute override');
            return await interaction.editReply({ embeds: [embed], components: [] });
        }

        if (!rows.length && member.roles.cache.has(settings.roles.muted) && !await confirmUnmanagedMute(interaction, member, duration, reason)) {
            embed.setColor(Colors.Red)
                .setDescription('Cancelled converting mute');
            return await interaction.editReply({ embeds: [embed], components: [] });
        }

        await this.mute(settings, db, interaction, member, duration, reason, rows[0]);
    }
};

