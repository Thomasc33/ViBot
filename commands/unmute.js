const { EmbedBuilder, Colors } = require('discord.js');
const ErrorLogger = require('../lib/logError');
const { ApplicationCommandOptionType } = require('discord-api-types/v10');
const { slashArg, slashCommandJSON } = require('../utils.js');
const moment = require('moment');

/**
 *
 * @param {number} duration
 * @returns {string}
 */
function durationString(duration, when = Date.unix()) {
    if (!duration) return 'Permanent';
    duration = parseInt(duration);
    when = parseInt(when);
    return `${moment.duration(duration * 1000).humanize()} ending <t:${when + duration}:R> at <t:${when + duration}:f>`;
}

module.exports = {
    name: 'unmute',
    description: 'Removes muted role from user',
    role: 'security',
    varargs: true,
    args: [
        slashArg(ApplicationCommandOptionType.User, 'member', {
            description: 'Member in the Server'
        }),
        slashArg(ApplicationCommandOptionType.String, 'reason', {
            description: 'Reason for the unmute',
            required: false
        })
    ],
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild);
    },

    /**
     *
     * @param {import('../utils.js').BotCommandInteraction} interaction
     * @param {string[]} args unused
     * @param {import('discord.js').Client} bot
     * @param {import('mysql2').Pool} db
     */
    async execute(interaction, args, bot, db) {
        const settings = bot.settings[interaction.guild.id];
        const member = interaction.options.getMember('member');
        const reason = [interaction.options.getString('reason'), ...interaction.options.getVarargs()].join(' ') || 'No reason provided';

        const [[row]] = await db.promise().query('SELECT * FROM mutes WHERE id = ? AND guildid = ? AND removedOn IS NULL', [member.id, member.guild.id]);

        if (!row && !member.roles.cache.has(settings.roles.muted)) {
            const embed = new EmbedBuilder()
                .setFooter({ text: `Ran by ${interaction.member.displayName}`, iconURL: interaction.member.displayAvatarURL() })
                .setDescription(`${member} does not have the muted role and doesn't have any active mutes with ${interaction.client.user}.`)
                .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
                .setTitle('Unmute')
                .setTimestamp()
                .setColor(Colors.Red);
            return await interaction.reply({ embeds: [embed] });
        }

        await this.unmute(interaction, interaction.guild, interaction.member, member, settings, db, row, reason);
    },

    /**
     *
     * @param {import('../utils.js').BotCommandInteraction?} interaction
     * @param {import('discord.js').GuildMember} moderator
     * @param {import('discord.js').GuildMember?} member
     * @param {*} settings
     * @param {import('mysql2').Pool} db
     * @param {import('./mute.js').MuteRow} row
     * @param {string} reason
     */
    async unmute(interaction, guild, moderator, member, settings, db, row, reason) {
        const embed = new EmbedBuilder()
            .setColor(Colors.Green)
            .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
            .setTitle('Unmute')
            .setTimestamp()
            .setFooter({ text: `Ran by ${moderator.displayName}`, iconURL: moderator.displayAvatarURL() })
            .addFields({ name: 'Member', value: member ? `${member} \`${member.displayName}\`` : `<@!${row.id}> (not in server)`, inline: true },
                { name: 'Moderator', value: `${moderator} \`${moderator.displayName}\``, inline: true },
                { name: 'Unmute Time', value: `<t:${Date.unix()}:f>`, inline: true },
                { name: 'Unmute Reason', value: reason });

        if (row) {
            await db.promise().query('UPDATE mutes SET removedOn = unix_timestamp(), removedBy = ?, removeReason = ? WHERE id = ? AND guildid = ? AND removedOn IS NULL',
                [moderator.id, reason, row.id, guild.id]);

            const mod = guild.members.cache.get(row.modid);
            embed.addFields({ name: 'Muted By', value: mod ? `${mod} \`${mod.displayName}\`` : `<@!${row.modid}>`, inline: true },
                { name: 'Muted On', value: `<t:${row.appliedOn}:R> at <t:${row.appliedOn}:f>`, inline: true },
                { name: 'Mute Duration', value: durationString(row.duration, row.appliedOn), inline: true },
                { name: 'Mute Reason', value: row.reason });
        } else {
            embed.addFields({ name: 'Unmanaged', value: `<@!${member.id}> had the <@&${settings.roles.muted}> role but it was not managed by ${guild.client.user}.` });
        }

        try {
            if (member) {
                await member.roles.remove(settings.roles.muted);
                const dm = await member.createDM().catch(() => {});
                await dm?.send({ embeds: [embed] }).catch(() => {});
            }
            if (interaction) await interaction.reply({ embeds: [embed] });
            await guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
        } catch (e) {
            ErrorLogger.log(e, guild.client, guild);
        }
    }
};
