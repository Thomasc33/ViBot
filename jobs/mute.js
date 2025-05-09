const { RepeatedJob } = require('./RepeatedJob.js');
const { iterServers } = require('./util.js');
const { getDB } = require('../dbSetup.js');
const { unmute } = require('../commands/unmute.js');
class Mute extends RepeatedJob {
    async run(bot) {
        await iterServers(bot, async (bot, guild) => {
            const ids = [];
            const settings = bot.settings[guild.id];
            const db = getDB(guild.id);
            const botMember = guild.members.cache.get(bot.user.id);
            const [rows] = await db.promise().query('SELECT * FROM mutes WHERE guildid = ? AND removedOn IS NULL', [guild.id]);
            for (const row of rows) {
                const member = guild.members.cache.get(row.id);
                if (ids.includes(row.id)) continue;
                if (parseInt(row.appliedOn) + parseInt(row.duration) > Date.unix() || !row.duration) {
                    if (!member?.roles.cache.has(settings.roles.muted)) member?.roles.add(settings.roles.muted);
                    continue;
                }
                ids.push(row.id); // In case db ends up with multiple rows with removedOn = null
                // eslint-disable-next-line no-await-in-loop
                await unmute(null, guild, botMember, member, settings, db, row, 'Mute expired');
            }
        });
    }
}

module.exports = { Mute };
