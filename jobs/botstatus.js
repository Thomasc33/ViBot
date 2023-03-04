const { RepeatedJob } = require('./RepeatedJob.js')
const { iterServers } = require('./util.js')
const botStatus = require('../commands/botstatus.js')

class BotStatusUpdate extends RepeatedJob {
    run(bot) {
        iterServers(bot, (bot, g) => {
            botStatus.updateAll(bot.dbs[g.id])
        })
    }
}

module.exports = { BotStatusUpdate }
