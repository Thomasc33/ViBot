const Discord = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');
const { config, settings } = require('../lib/settings');
module.exports = {
    name: 'warn',
    role: 'eventrl',
    description: 'Warns a user for a given reason',
    alias: ['swarn'],
    varargs: true,
    requiredArgs: 2,
    getNotes() {
        return 'Using swarn will silently warn, not sending the user a message.';
    },
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: 'The user to warn'
        }),
        slashArg(SlashArgType.String, 'reason', {
            description: 'The reason for warning'
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    async execute(message, args, bot, db) {
        const silent = message.content[config.prefix.length].toLowerCase() == 's';
        const member = message.options.getMember('user');
        const { backend: { onlyUpperStaffWarnStaff }, lists, roles } = settings[message.guild.id];
        // check if person being warned is staff
        if (onlyUpperStaffWarnStaff) {
            const lowestStaffRole = roles.lol;
            if (lowestStaffRole) {
                if (member.roles.highest.comparePositionTo(lowestStaffRole) >= 0) {
                    // the warn should only happen if message.member is like an admin or something
                    const warningRoles = lists.warningRoles.length ? lists.warningRoles : ['moderator', 'headrl', 'headeventrl', 'officer', 'developer'];
                    const warningIds = warningRoles.map(m => roles[m]);
                    if (!message.member.roles.cache.filter(role => warningIds.includes(role.id)).size) return message.replyUserError("Could not warn that user as they are staff and your highest role isn't high enough. Ask for a promotion and then try again.");
                }
            }
        }
        const reason = args.slice(1).join(' ');
        if (reason == '') return message.replyUserError('Please provide a reason');
        try {
            await db.promise().query('INSERT INTO warns (id, modid, reason, time, guildid, silent) VALUES (?, ?, ?, ?, ?, ?)', [member.user.id, message.author.id, reason, Date.now(), member.guild.id, silent ? 1 : 0]);
        } catch (err) {
            return await message.replyInternalError(`There was an error: ${err}`);
        }
        const warnEmbed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`Warning Issued on the Server: ${message.guild.name}`)
            .setDescription(`__Moderator:__ <@!${message.author.id}> (${message.member.nickname})\n__Reason:__ ${reason}`);
        if (!silent) await member.send({ embeds: [warnEmbed] }).catch(() => {});
        setTimeout(async () => {
            const [[{ totalWarnCount }]] = await db.promise().query('SELECT COUNT(*) as totalWarnCount FROM warns WHERE id = ?', [member.user.id]);
            const [[{ serverWarnCount }]] = await db.promise().query('SELECT COUNT(*) as serverWarnCount FROM warns WHERE id = ? and (guildid = ? OR guildid is null)', [member.user.id, message.guild.id]);
            await message.reply(`${member.nickname}${silent ? ' silently' : ''} warned successfully. This is their \`${serverWarnCount}\` warning for this server. And has a total of \`${totalWarnCount}\` warnings`);
        }, 500);
    }
};
