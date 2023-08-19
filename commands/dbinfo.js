const { botOwners } = require('../settings.json');

module.exports = {
    name: 'dbinfo',
    role: 'assistantdev',
    description: 'Gets db stats',
    async execute(message, args, bot, db) {
        let config = {
            closed: db._closed
        }
        const configKeys = ['waitForConnections', 'connectionLimit', 'maxIdle', 'idleTimeout', 'queueLimit']
        configKeys.forEach(k => {config[k] = db.config[k]})
        message.channel.send(`DB Config:\n\`\`\`\n${JSON.stringify(config, null, 2)}\`\`\``)
        let i = 0;
        let connectionInfo = []
        while (true) {
            const c = db._allConnections.peekAt(i)
            if (c === undefined) break
            i += 1
            connectionInfo.push({
                lastActiveTime: `${c.lastActiveTime} (${new Date(c.lastActiveTime).toISOString()}; ${((new Date() - c.lastActiveTime) / 1000) / 60} minutes ago)`
            })
        }
        message.channel.send(`Live connections:\n\`\`\`\n${JSON.stringify(connectionInfo, null, 2)}\`\`\``)
    }
}
