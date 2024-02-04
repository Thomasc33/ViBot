const Discord = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

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
        const settings = bot.settings[message.guild.id];
        const modlogs = message.guild.channels.cache.get(settings.channels.modlogs);
        if (!modlogs) return message.channel.send('the modlogs channel is not configured for this server.');

        const member = message.options.getMember('user');
        if (!member) return message.channel.send('Member not found. Please try again');
        const [rows] = await db.promise().query('SELECT * FROM suspensions WHERE id = ? AND suspended = 0', [member.user.id]);
        for (let i = 0; i < rows.length; i++) {
            rows[i].index = i;
        }
        // Performs a check to see if the raider is currently suspended, if they are, you will not be allowed to continue and the raider stays suspended
        if (rows.length == 0) return message.channel.send('There are no expired suspensions found for the user. Please unsuspend them and try again.');
        const embed = new Discord.EmbedBuilder()
            .setTitle('Suspension Removal')
            .setColor(Discord.Colors.Blue)
            .setDescription('**Select a suspension to remove:**\n\n' + rows.map(sus => `${sus.index + 1}. By <@!${sus.modid}> ends <t:${(parseInt(sus.uTime) / 1000).toFixed(0)}:R> at <t:${(parseInt(sus.uTime) / 1000).toFixed(0)}:f>\`\`\`${sus.reason}\`\`\``).join('\n'));
        const rsPanel = await message.channel.send({ embeds: [embed] });
        const choice = await rsPanel.confirmNumber(rows.length, message.member.id)
            .then(c => {
                if (isNaN(c) || c == 'Cancelled') {
                    embed.addFields({ name: 'Cancelled', value: 'This interaction has been cancelled.' });
                    return false;
                }
                return parseInt(c);
            })
            .catch(() => {
                embed.addFields({ name: 'Cancelled', value: 'This interaction has timed out.' });
                return false;
            });

        if (choice === false) {
            rsPanel.edit({ embeds: [embed], components: [] });
            return;
        }

        const suspension = rows[choice];
        const mod = message.guild.members.cache.get(suspension.modid);

        embed.setDescription('What is your reason for removing the following suspension?')
            .setFields(
                { name: 'Member', value: `${member} \`${member.displayName}\``, inline: true },
                { name: 'Issued By', value: mod ? `${mod} \`${mod.displayName}\`` : `<@${suspension.modid}>`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: 'Suspended On', value: suspension.unixTimestamp ? `<t:${(parseInt(suspension.unixTimestamp) / 1000).toFixed(0)}:f>` : 'Unknown', inline: true },
                { name: 'Ended At', value: suspension.perma ? 'Permanent' : `<t:${(parseInt(suspension.uTime) / 1000).toFixed(0)}:R>`, inline: true },
                { name: 'Reason', value: suspension.reason || 'No Reason Provided' });

        await rsPanel.edit({ embeds: [embed], components: [] });
        const reason = await rsPanel.channel.next(null, null, message.author.id)
            .then(result => result.content.trim() || 'No Reason Provided')
            .catch(err => {
                embed.setDescription(`Cancelled suspension removal for the following suspension: ${err}`)
                    .setColor(Discord.Colors.Red);
                rsPanel.edit({ embeds: [embed] });
                return false;
            });

        if (!reason) return;

        embed.setDescription('__Are you sure you want to remove the following suspension?__')
            .addFields({ name: 'Removal By', value: `${message.member} \`${message.member.displayName}\`` })
            .addFields({ name: 'Removal Reason', value: reason });

        await rsPanel.edit({ embeds: [embed] });
        if (!(await rsPanel.confirmButton(message.author.id))) {
            embed.setDescription('Cancelled removing the following suspension')
                .setColor(Discord.Colors.Red);
            rsPanel.edit({ embeds: [embed], components: [] });
            return;
        }

        await db.promise().query('DELETE FROM suspensions WHERE id = ? AND modid = ? AND uTime = ?', [suspension.id, suspension.modid, suspension.uTime]);

        embed.setDescription('Removed the following suspension')
            .setColor(Discord.Colors.Green);

        rsPanel.edit({ embeds: [embed], components: [] });

        const removeembed = new Discord.EmbedBuilder()
            .setColor(Discord.Colors.Red)
            .setTitle('Suspend Remove Information')
            .setDescription('The following suspension was removed')
            .setFields(rsPanel.embeds[0].data.fields);

        modlogs.send({ embeds: [removeembed] });
    }
};
