const { RepeatedJob } = require('./RepeatedJob.js');
const ErrorLogger = require('../lib/logError');
const { iterServersWithQuery } = require('./util.js');
const { getDB } = require('../dbSetup.js');
const { settings } = require('../lib/settings');

class Mute extends RepeatedJob {
    async run(bot) {
        await iterServersWithQuery(bot, 'SELECT * FROM mutes WHERE muted = true', async (bot, row, g) => {
            if (Date.now() > parseInt(row.uTime)) {
                const guildId = row.guildid;
                const guild = bot.guilds.cache.get(guildId);
                if (guild) {
                    const db = getDB(g.id);
                    const member = guild.members.cache.get(row.id);
                    if (!member) return await db.promise().query('UPDATE mutes SET muted = false WHERE id = ?', [row.id]);
                    try {
                        await member.roles.remove(settings[g.id].roles.muted);
                        await db.promise().query('UPDATE mutes SET muted = false WHERE id = ?', [row.id]);
                    } catch (er) {
                        ErrorLogger.log(er, bot, g);
                    }
                }
            }
        });
    }
}

module.exports = { Mute };
