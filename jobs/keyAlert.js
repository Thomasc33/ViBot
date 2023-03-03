const { RepeatedJob } = require('./RepeatedJob.js')

class KeyAlert extends RepeatedJob {
    run(bot) {
        bot.guilds.cache.each(g => {
            const settings = bot.settings[g.id];
            if (!settings || !settings.channels.keyalerts || !settings.numerical.keyalertsage) {return;}

            const channel = bot.channels.cache.get(settings.channels.keyalerts);
            channel.messages.fetch()
                .then(messages => {
                    const bulk = [];

                    messages.each(message => {
                        if (new Date() - message.createdAt > 60000 * settings.numerical.keyalertsage) {bulk.push(message);}
                    })
                    if (bulk.length == 1) {bulk[0].delete();} else if (bulk.length > 1) {channel.bulkDelete(bulk);}
                })
        })
    }
}

module.exports = { KeyAlert }
