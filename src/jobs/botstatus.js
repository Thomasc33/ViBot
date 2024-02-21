const { RepeatedJob } = require('./RepeatedJob.js');
const botStatus = require('../commands/botstatus.js');

class BotStatusUpdate extends RepeatedJob {
    async run(bot) {
        await botStatus.updateAll(bot);
    }
}

module.exports = { BotStatusUpdate };
