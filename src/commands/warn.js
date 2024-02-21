const Discord = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

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
        slashArg(SlashArgType.String, 'user', {
            description: 'The user to warn'
        }),
        slashArg(SlashArgType.String, 'reason', {
            description: 'The reason for warning'
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id];
        const silent = message.content[1].toLowerCase() == 's';
        if (args.length < 2) return;
        let member = message.mentions.members.first();
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname !== null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return await message.replyUserError('Member not found. Please try again');

        // check if person being warned is staff
        if (bot.settings[message.guild.id].backend.onlyUpperStaffWarnStaff) {
            const lowestStaffRole = bot.settings[message.guild.id].roles.lol;
            if (lowestStaffRole) {
                if (member.roles.highest.comparePositionTo(lowestStaffRole) >= 0) {
                    // the warn should only happen if message.member is like an admin or something
                    const warningRoles = settings.lists.warningRoles.length ? settings.lists.warningRoles : ['moderator', 'headrl', 'headeventrl', 'officer', 'developer'];
                    const warningIds = warningRoles.map(m => settings.roles[m]);
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
