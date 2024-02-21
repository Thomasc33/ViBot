const Discord = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');
const { processUnsuspend } = require('./unsuspend.js');
module.exports = {
    name: 'suspendremove',
    slashCommandName: 'suspendremove',
    alias: ['removesuspend'],
    description: 'Removes a suspension from a given user',
    args: [
        slashArg(SlashArgType.User, 'user', { description: 'User to remove a suspension from.' })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    requiredArgs: 1,
    role: 'officer',
    /**
     * @param {Discord.Message} message
     * @param {string[]} args
     * @param {Discord.Client} bot
     * @param {import('mysql2').Connection} db
     */
    async execute(message, args, bot, db) {
        /** @type {import('../data/guildSettings.701483950559985705.cache.json')} */
        const settings = bot.settings[message.guild.id];
        const modlogs = message.guild.channels.cache.get(settings.channels.modlogs);
        if (!modlogs) return message.channel.send('The modlogs channel is not configured for this server.');

        /** @type {Discord.GuildMember} */
        const member = message.options.getMember('user');
        if (!member) return message.channel.send('Member not found. Please try again');
        const [rows] = await db.promise().query('SELECT * FROM suspensions WHERE guildid = ? AND id = ? ORDER BY suspended DESC, unixTimestamp DESC, uTime DESC', [member.guild.id, member.user.id]);

        if (rows.length == 0) {
            const embed = new Discord.EmbedBuilder()
                .setTitle('Suspension Removal')
                .setColor(Discord.Colors.Red)
                .setDescription(`${member} has no suspensions managed by ${bot.user}`);
            return message.reply({ embeds: [embed] });
        }

        /** @type {string[]} */
        const descriptions = rows.slice(0, 24).map((row, index) => {
            const time = (parseInt(row.uTime) / 1000).toFixed(0);
            const timestr = row.perma ? 'permanently' : `Set to End <t:${time}:R> at <t:${time}:f>`;
            const bulk = `**${index + 1}.${row.suspended ? ' Active' : ''}** By <@!${row.modid}> ${timestr}`;
            return `${bulk}\n\`\`\`${row.reason}\`\`\``;
        }).reduce((acc, info) => {
            if (acc[acc.length - 1].length + info.length + 1 > 3800) acc.push('');
            acc[acc.length - 1] += info + '\n';
            return acc;
        }, ['']);

        if (rows.length > 24) {
            const issue = `\n\n**Only 24 items can be selected from**, however ${member} has had ${rows.length} suspensions. If the suspension you want to remove does not show up, please contact a developer to remove it directly.`;
            if (descriptions[descriptions.length - 1].length + issue.length > 3800) descriptions.push('');
            descriptions[descriptions.length - 1] += issue;
        }

        const embed = new Discord.EmbedBuilder()
            .setTitle('Suspension Removal')
            .setColor(Discord.Colors.Blue);

        const displays = await Promise.all(descriptions.map(desc => message.channel.send({ embeds: [embed.setDescription(`**Select a suspension to remove from ${member}:**\n\n${desc}`)] })));

        const rsPanel = displays.pop();
        const choice = await rsPanel.confirmNumber(Math.min(rows.length, 24), message.member.id).catch(() => false);

        if (choice === false) {
            embed.setTitle('Suspension Removal Cancelled').addFields({ name: 'Cancelled', value: 'This interaction has timed out.' });
            rsPanel.edit({ embeds: [embed], components: [] });
            return;
        }

        if (isNaN(choice) || choice == 'Cancelled') {
            embed.setTitle('Suspension Removal Cancelled').addFields({ name: 'Cancelled', value: 'This interaction has been cancelled.' });
            rsPanel.edit({ embeds: [embed], components: [] });
            return;
        }

        const suspension = rows[parseInt(choice) - 1];
        const mod = message.guild.members.cache.get(suspension.modid);
        embed.setDescription('What is your reason for removing the following suspension?')
            .setFields({ name: 'Member', value: `${member} \`${member.displayName}\``, inline: true },
                { name: 'Issued By', value: mod ? `${mod} \`${mod.displayName}\`` : `<@${suspension.modid}>`, inline: true });
        if (suspension.suspended) {
            const suspensionRoles = [settings.roles.tempsuspended, settings.roles.permasuspended].filter(r => member.roles.cache.get(r));
            embed.addFields({ name: 'Active Suspension', value: suspensionRoles.join(' ') || 'In database only (no roles)', inline: true });
        } else {
            embed.addFields({ name: '\u200b', value: '\u200b', inline: true });
        }

        embed.addFields({ name: 'Suspended On', value: suspension.unixTimestamp ? `<t:${(parseInt(suspension.unixTimestamp) / 1000).toFixed(0)}:f>` : 'Unknown', inline: true },
            { name: suspension.suspended ? 'Ends' : 'Ended', value: suspension.perma ? 'Permanent' : `<t:${(parseInt(suspension.uTime) / 1000).toFixed(0)}:R>`, inline: true },
            { name: 'Reason', value: suspension.reason || 'No Reason Provided' });

        displays.forEach(msg => msg.delete().catch(() => {})); // Message.deletable seems to be bugged/doesn't always work; just try and ignore if it fails
        await rsPanel.edit({ embeds: [embed], components: [] });
        const reason = await rsPanel.channel.next(null, null, message.author.id).catch(err => {
            embed.setTitle('Suspension Removal Cancelled')
                .setDescription(`Cancelled suspension removal for the following suspension: ${err}`)
                .setColor(Discord.Colors.Red);
            return false;
        });

        if (!reason) {
            rsPanel.edit({ embeds: [embed] });
            return;
        }

        embed.setDescription('__Are you sure you want to remove the following suspension?__')
            .addFields({ name: 'Removal By', value: `${message.member} \`${message.member.displayName}\`` })
            .addFields({ name: 'Removal Reason', value: reason.content.trim() || 'No Reason Provided' });

        await rsPanel.edit({ embeds: [embed] });
        if (!(await rsPanel.confirmButton(message.author.id).catch(() => { embed.setFooter({ text: 'Timed out' }); }))) {
            embed.setTitle('Suspension Removal Cancelled')
                .setDescription('Cancelled removing the following suspension')
                .setColor(Discord.Colors.Red);
            rsPanel.edit({ embeds: [embed], components: [] });
            return;
        }

        await db.promise().query('DELETE FROM suspensions WHERE id = ? AND modid = ? AND uTime = ?', [suspension.id, suspension.modid, suspension.uTime]);

        await processUnsuspend(message.member, suspension, bot, db, settings, reason.content.trim() || 'No Reason Provided');

        embed.setDescription('Removed the following suspension')
            .setColor(Discord.Colors.Green);

        rsPanel.edit({ embeds: [embed], components: [] });

        const removeembed = new Discord.EmbedBuilder()
            .setColor(Discord.Colors.Red)
            .setTitle('Suspend Remove Information')
            .setDescription('The following suspension was removed')
            .setFields(rsPanel.embeds[0].data.fields);

        await modlogs.send({ embeds: [removeembed] });
    }
};
