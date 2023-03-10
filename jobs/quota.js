const { RepeatedJob } = require('./RepeatedJob.js')
const quotas = require('../data/quotas.json');
const quota = require('../commands/quota')
const { iterServers } = require('./util.js')
const { getDB } = require('../dbSetup.js')
const moment = require('moment');

class MonthlyQuota extends RepeatedJob {
    async run(bot) {
        const biweekly = !(moment().diff(moment(1413378000), 'week') % 2);

        await iterServers(bot, (bot, g) => {
            const guildQuotas = quotas[g.id];
            if (!guildQuotas) { return }
            const quotaList = guildQuotas.quotas.filter(q => q.reset == 'weekly' || (q.reset == 'biweekly' && biweekly));
            if (!quotaList.length) return;
            for (const q of quotaList) {
                if (q.reset == 'monthly') {quota.newWeek(g, bot, getDB(g.id), bot.settings[g.id], guildQuotas, q);}
            }
        })
    }
}

class BiWeeklyQuota extends RepeatedJob {
    async run(bot) {
        const biweekly = !(moment().diff(moment(1413378000), 'week') % 2);

        await iterServers(bot, async (bot, g) => {
            const guildQuotas = quotas[g.id];
            if (!guildQuotas) { return }
            const quotaList = guildQuotas.quotas.filter(q => q.reset == 'weekly' || (q.reset == 'biweekly' && biweekly));
            if (!quotaList.length) return;

            await quota.fullReset(g, getDB(g.id), bot, quotaList);
        })
    }
}

module.exports = { MonthlyQuota, BiWeeklyQuota }
