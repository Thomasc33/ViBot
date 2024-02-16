const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const cron = require('cron');
const moment = require('moment')

module.exports = {
    name: 'test',
    description: 'Holds testing code. Do not issue command if you do not know what is in it',
    requiredArgs: 0,
    guildspecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        if (args[0] != 'CONVERT_DB_ONLY_RUN_ONCE') return;
        const [rows] = await db.promise().query('SELECT * FROM mutes');
        const now = Date.now();
        const newRows = rows.map(({ id, guildid, reason, modid, uTime, muted, perma })=> {
            // duration is 0 if perma in new system
            // if old uTime is NaN, default to perma if muted = 1
            perma = perma || (isNaN(uTime) && muted);
            // Normally, duration will be 0 if a mute is labeled 'Permanent'
            // Unfortunately, there's no way of knowing when the mute was applied so we can't infer duration from uTime
            const duration = perma || !muted ? 0 : Math.max(0, (parseInt(uTime) / 1000)^0 - Date.unix());
            // If a mute has not been resolved, removedOn will be null
            // If permanent mute or there's a duration, then it should not yet be resolved
            const removedOn = perma || duration ? null : Date.unix();
            const removedBy = removedOn && bot.user.id;
            const removeReason = removedOn && `Automatic or unknown, occurred before ${new Date()}`;
            return [ id, modid, guildid, reason, duration, removedOn, removedBy, removeReason ];
        });
        await db.promise().query('DROP TABLE IF EXISTS `temp_mutes`');
        await db.promise().query('CREATE TABLE `temp_mutes` ( \
            `id` varchar(32) NOT NULL, \
            `modid` varchar(32) NOT NULL, \
            `guildid` varchar(32) NOT NULL, \
            `reason` varchar(1024) NOT NULL, \
            `appliedOn` int NOT NULL DEFAULT (unix_timestamp()), \
            `duration` int NOT NULL, \
            `removedOn` int DEFAULT NULL, \
            `removedBy` varchar(32) DEFAULT NULL, \
            `removeReason` varchar(1024) DEFAULT NULL \
          )');

        await db.promise().query('INSERT INTO temp_mutes (id, modid, guildid, reason, duration, removedOn, removedBy, removeReason) VALUES ?', [newRows]);
        await db.promise().query('RENAME TABLE mutes TO mutes_backup');
        await db.promise().query('RENAME TABLE temp_mutes TO mutes');

        const [final] = await db.promise().query('SELECT * FROM mutes');
        const embed = new Discord.EmbedBuilder()
            .setTitle('Mute Table Conversion')
            .setDescription('Converted mutes table to new schema.\nIf issues arise, the \`mutes\` table has been backed up as \`mutes_backup\`')
            .setColor(Discord.Colors.Green)
            .setTimestamp()
            .setFooter({ text: message.member.displayName, iconURL: message.member.displayAvatarURL() });

        embed.addFields({ 
            name: 'Mutes', 
            value: final.filter(r => !r.removedOn)
                .map(r => { r.guild = bot.guilds.cache.get(r.guildid); return r })
                .map(r => `<@${r.id}> by <@${r.modid}> in ${r.guild?.name || `Unknown Guild ${r.guildid}`} ` + (r.duration ? `ending <t:${r.appliedOn + r.duration}:R>` : 'Permanently'))
                .join('\n')
        })
        message.reply({ embeds: [embed] });
    }
}
