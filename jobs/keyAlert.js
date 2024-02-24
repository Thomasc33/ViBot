const { RepeatedJob } = require('./RepeatedJob.js');
const { settings } = require('../lib/settings');

class KeyAlert extends RepeatedJob {
    run(bot) {
        bot.guilds.cache.each(g => {
            const { channels: { keyalerts }, numerical: { keyalertsage } } = settings[g.id];
            if (!keyalerts || !keyalertsage) {return;}

            const channel = bot.channels.cache.get(keyalerts);
            channel.messages.fetch()
                .then(messages => {
                    const bulk = [];

                    messages.each(message => {
                        if (new Date() - message.createdAt > 60000 * keyalertsage) {bulk.push(message);}
                    });
                    if (bulk.length == 1) {bulk[0].delete();} else if (bulk.length > 1) {channel.bulkDelete(bulk);}
                });
        });
    }
}

module.exports = { KeyAlert };
