const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const templates = require('../data/kickOptions.json');
const { settings } = require('../lib/settings');

module.exports = {
    name: 'kick',
    description: 'Kicks user from server and logs it',
    args: '<id/mention> [reason]',
    requiredArgs: 1,
    role: 'security',
    /**
     * @param {Discord.Guild} guild
     * @param {Discord.GuildMember} member
     * @param {Discord.Client} bot
     */
    getNotes: function GetKickNotes(guild) {
        const template = { ...templates.default, ...templates[guild.id] };
        template.presets = { ...templates.default.presets, ...template.presets };
        if (template.presets) {
            return `Available Templates (use template key as the reason): ${Object.keys(template.presets).join(', ')}`;
        }
    },

    /**
     * @param {Discord.Message} message
     * @param {[string]} args
     * @param {Discord.Client} bot
     */
    execute: async function ExecuteKickCommand(message, args, bot) {
        const { rolePermissions: { minimumStaffRoleNoKick }, roles, channels: { modlogs } } = settings[message.guild.id];

        const embed = new Discord.EmbedBuilder()
            .setAuthor({ iconURL: message.member.displayAvatarURL(), name: message.member.nickname || message.author.displayName })
            .setTitle('Kick User')
            .setColor('Red');

        /** @type {Discord.GuildMember} */
        const member = message.guild.findMember(args[0]);
        let failure = null;

        if (!minimumStaffRoleNoKick) failure = '`minimumStaffRoleNoKick` is not configured for this server. Please have a developer or moderator assist before using this command.';

        if (!failure && !member) failure = 'member could not be found.';

        const template = { ...templates.default, ...templates[message.guild.id] };
        template.presets = { ...templates.default.presets, ...template.presets };

        if (!failure && !member.kickable) failure = 'you do not have permissions to kick this member.';

        if (!failure && member.roles.highest.position >= message.guild.roles.cache.get(roles[minimumStaffRoleNoKick]).position) failure = 'staff members cannot be kicked with this command.';

        if (failure) {
            embed.setDescription(`Failed to kick user ${member || args[0]}: ${failure}`);
            message.reply({ embeds: [embed] });
            return;
        }

        args.shift();
        let reason = args.join(' ') || 'No reason given.';

        if (reason && template.presets[reason.toLowerCase()]) reason = template.presets[reason.toLowerCase()];

        embed.setDescription(`Are you sure you want to kick ${member.displayName}?`);

        message.reply({ embeds: [embed] }).then(async confirmation => {
            if (await confirmation.confirmButton(message.author.id)) {
                const kickEmbed = new Discord.EmbedBuilder()
                    .setTitle('Member Kicked')
                    .setDescription(`You have been kicked from ${message.guild.name}`)
                    .addFields({ name: 'Reason', value: reason })
                    .setColor('Red');

                if (message.guild.vanityURLCode) {
                    kickEmbed.addFields({ name: 'Server Link', value: `https://discord.gg/${message.guild.vanityURLCode}` });
                }

                await member.send({ embeds: [kickEmbed] }).catch(() => {});

                await member.kick(reason).then(kickedMember => {
                    embed.setDescription(`${member}`)
                        .addFields(
                            { name: 'User', value: kickedMember.displayName, inline: true },
                            { name: 'Kicked By', value: `${message.member}`, inline: true },
                            { name: 'Reason', value: `\`\`\`${reason}\`\`\`` },
                            { name: 'User Roles', value: kickedMember.roles.cache.map(r => r.toString()).join(' ') }
                        )
                        .setColor('Green')
                        .setTimestamp(Date.now());

                    message.guild.channels.cache.get(modlogs).send({ embeds: [embed] }).then(logMessage => {
                        embed.setFields({ name: 'Log Link', value: logMessage.url })
                            .setDescription(`Successfully kicked ${kickedMember} (\`${kickedMember.displayName}\`).`)
                            .setTimestamp(Date.now());

                        confirmation.edit({ embeds: [embed], components: [] });
                    })
                }).catch(er => {
                    ErrorLogger.log(er, bot, message.guild);
                    embed.setDescription(`Failed to kick user ${member}: \`${er.message}\``);
                    confirmation.edit({ embeds: [embed] });
                    failure = true;
                });
            } else {
                embed.setDescription(`Attempt to kick member ${member} has been cancelled.`)
                    .setColor('White');
                confirmation.edit({ embeds: [embed], components: [] });
            }
        });
    }
}
