const RepeatedJob = require('./jobs/RepeatedJob.js')
const quotas = require('./data/quotas.json');
const { iterServers } = require('./jobs/util.js')
const moment = require('moment');

class MonthlyQuota extends RepeatedJob {
    run(bot) {
        iterServers(bot, (bot, g) => {
            const guildQuotas = quotas[g.id];
            if (!guildQuotas) { return }
            const quotaList = guildQuotas.quotas.filter(q => q.reset == 'weekly' || (q.reset == 'biweekly' && biweekly));
            if (!quotaList.length) return;
            for (const q of quotaList) {
                if (q.reset == 'monthly') {quota.newWeek(g, bot, bot.dbs[g.id], bot.settings[g.id], guildQuotas, q);}
            }
        })
    }
}

class BiWeeklyQuota extends RepeatedJob {
    run(bot) {
        const biweekly = !(moment().diff(moment(1413378000), 'week') % 2);

        iterServers(bot, (bot, g) => {
            const guildQuotas = quotas[g.id];
            if (!guildQuotas) { return }
            const quotaList = guildQuotas.quotas.filter(q => q.reset == 'weekly' || (q.reset == 'biweekly' && biweekly));
            if (!quotaList.length) return;

            quota.fullReset(g, bot.dbs[g.id], bot, quotaList);
        })
    }
}
