const { botOwners } = require('../settings.json')
const process = require('process')

module.exports = {
    name: 'sysinfo',
    role: 'assistantdev',
    description: 'Gets system stats',
    async execute(message, args, bot, db) {
        message.channel.send((process.memoryUsage().rss / (1024 * 1024)) + 'mb')
    }
}
