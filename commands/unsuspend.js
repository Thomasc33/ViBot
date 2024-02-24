const Discord = require('discord.js');
const { settings } = require('../lib/settings');

module.exports = {
    name: 'unsuspend',
    description: 'Manually unsuspends user',
    args: '<ign> (reason)',
    requiredArgs: 1,
    role: 'warden',
    /**
     *
     * @param {Discord.Message} message
     * @param {string[]} args
     * @param {Discord.Client} bot
     * @param {import('mysql2').Connection} db
     * @returns
     */
    async execute(message, args, bot, db) {
        const { roles, channels, rolePermissions: { unsuspendPermanentSuspension }, backend: { useUnverifiedRole } } = settings[message.guild.id];
        const raider = args.shift();
        const reason = args.join(' ') || 'No Reason Provided';
        /** @type {Discord.GuildMember} */
        const member = message.guild.findMember(raider);
        const suspendlog = message.guild.channels.cache.get(channels.suspendlog);

        const embed = new Discord.EmbedBuilder()
            .setTitle('Unsuspend')
            .setDescription(`Checking suspensions for \`${raider}\`...`)
            .setColor(Discord.Colors.Blue);
        const confirmMessage = await message.reply({ embeds: [embed] });

        if (!member) {
            embed.setDescription(`Could not find member \`${raider}\``)
                .setColor(Discord.Colors.Red);
            return confirmMessage.edit({ embeds: [embed] });
        }
        if (!member.roles.cache.has(roles.permasuspended)
            && !member.roles.cache.has(roles.tempsuspended)) {
            embed.setDescription(`${member} is not currently suspended.`)
                .setColor(Discord.Colors.Red);
            return confirmMessage.edit({ embeds: [embed] });
        }
        if (member.roles.cache.has(roles.permasuspended)) {
            const unpermaRole = message.guild.roles.cache.get(unsuspendPermanentSuspension);
            if (unpermaRole && member.roles.highest.position < unpermaRole.position) {
                embed.setDescription(`${member} is permanently suspended but you do not have the permissions to remove permanent suspensions.`)
                    .setColor(Discord.Colors.Red)
                    .setTimestamp(Date.now());
                return confirmMessage.edit({ embeds: [embed] });
            }

            embed.setDescription(`${member} is permanently suspended. Are you sure you want to unsuspend them?`);
            await confirmMessage.edit({ embeds: [embed] });
            if (!await confirmMessage.confirmButton(message.author.id)) {
                embed.setDescription(`Cancelled attempting to unsuspend permanently suspended user ${member}`)
                    .setColor(Discord.Colors.Red)
                    .setTimestamp(Date.now());
                return confirmMessage.edit({ embeds: [embed], components: [] });
            }
        }

        const [suspendedRows] = await db.promise().query('SELECT * FROM suspensions WHERE id = ? AND suspended = true', [member.id]);

        if (suspendedRows.length) {
            const resultEmbed = await this.processUnsuspend(message.member, suspendedRows[0], bot, db, reason);
            confirmMessage.edit({ embeds: [resultEmbed] });
            return;
        }

        const receivedRole = member.nickname || !roles.unverified || !useUnverifiedRole ? roles.raider : roles.unverified;
        embed.setDescription(`${member} was not suspended by ${bot.user}. Would you still like to unsuspend them?`);
        if (!member.nickname) embed.addFields({ name: 'No Nickname Warning', value: `${member} does not have a nickname, they will be given the <@&${receivedRole}> role instead of <@&${roles.raider}>.` });
        embed.addFields({ name: 'Reason', value: reason });
        confirmMessage.edit({ embeds: [embed] });

        if (await confirmMessage.confirmButton(message.member.id)) {
            await member.roles.remove([roles.tempsuspended, roles.permasuspended].filter(r => r));
            await member.roles.add(receivedRole).then(() => useUnverifiedRole && roles.unverified && receivedRole == roles.raider && member.roles.remove(roles.unverified));
            embed.setTitle('Unsuspended')
                .setDescription(`${member} has been unsuspended.`)
                .setColor(Discord.Colors.Green)
                .setFields({ name: 'Member Information', value: `${member} \`${member.displayName}\``, inline: true },
                    { name: 'Mod Information', value: `${message.member} \`${message.member.displayName}\``, inline: true },
                    { name: 'Roles Received', value: `<@&${receivedRole}>`, inline: true },
                    ...embed.data.fields)
                .setTimestamp(Date.now())
                .setFooter({ text: 'Unsuspended at' });

            confirmMessage.edit({ embeds: [embed], components: [] });
            suspendlog?.send({ embeds: [embed] });
        }
    },
    /**
     * @param {Discord.GuildMember} mod
     * @param {*} row
     * @param {Discord.Client} bot
     * @param {import('mysql2').Connection} db
     * @param {string} reason
     *
     * @returns {EmbedBuilder}
     */
    async processUnsuspend(mod, row, bot, db, reason) {
        const { roles: { permasuspended, tempsuspended, unverified }, backend: { useUnverifiedRole }, channels } = settings[mod.guild.id];
        const guild = bot.guilds.cache.get(row.guildid);
        if (!guild) throw new Error(`Could not find guild \`${row.guildid}\``);

        const member = guild.members.cache.get(row.id);
        if (!member) throw new Error(`Could not find member \`${row.id}\``);

        const roles = row.roles.split(' ').filter(r => r && r != guild.id && !guild.roles.cache.get(r).managed)
            .filter(r => r != tempsuspended && r != permasuspended && !(r == unverified && useUnverifiedRole)); // filter out unverified & suspended

        if (useUnverifiedRole && roles.length == roles.filter(r => member.guild.roles.cache.get(r)?.managed).length) {
            roles.push(unverified); // if the only roles member has are managed roles, they should be Unverified
        }

        await member.roles.remove([tempsuspended, permasuspended]);
        await member.roles.add([...new Set(roles)]);

        /** @type {Discord.GuildTextBasedChannel?} */
        const suspendlog = guild.channels.cache.get(channels.suspendlog);
        const suspendMessage = await suspendlog?.messages.fetch({ limit: 100 }).then(messages => messages.find(message => message.id == row.logmessage && message.author.id == bot.user.id));

        const embed = Discord.EmbedBuilder.from(suspendMessage?.embeds[0]);

        if (!suspendMessage) {
            embed.setTitle('Unsuspend Information')
                .setDescription(`The following suspension was removed but could not find an embed:\n\nThe suspension was${row.length ? ' for ' + row.length : ''} until <t:${row.uTime}:f>`)
                .addFields({ name: `User Information \`${member.displayName}\``, value: `${member} (Tag: ${member.user.tag})`, inline: true },
                    { name: `Mod Information \`${mod.displayName}\``, value: `${mod} (Tag: ${mod.user.tag})`, inline: true },
                    { name: 'Reason', value: reason },
                    { name: 'Roles', value: roles.map(r => `<@&${r}>`).join(', ') || 'No Roles' });
        }

        embed.setColor(Discord.Colors.Green)
            .setDescription(embed.data.description.concat(`\nUnsuspended manually by ${mod} \`${mod.displayName}\``))
            .setFooter({ text: 'Unsuspended at' })
            .setTimestamp(Date.now())
            .addFields({ name: 'Reason for unsuspension:', value: reason });

        if (suspendMessage) suspendMessage.edit({ embeds: [embed] });
        else suspendlog?.send({ embeds: [embed] });

        await db.promise().query('UPDATE suspensions SET suspended = 0 WHERE id = ?', [member.id]);
        return embed;
    }
};
