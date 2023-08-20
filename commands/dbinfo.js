const { botOwners } = require('../settings.json');

function peekMysql2Queue(q) {
    let i = 0;
    let elements = [];
    while (true) {
        const c = q.peekAt(i)
        if (c === undefined) break
        i += 1
        elements.push(c)
    }
    return elements
}

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
        await message.channel.send(`DB Config:\n\`\`\`\n${JSON.stringify(config, null, 2)}\`\`\``)
        let freeConnections = new Set(peekMysql2Queue(db._freeConnections).map(c => c.connectionId))
        let connectionInfo = peekMysql2Queue(db._allConnections).map(c => {
            return {
                lastActiveTime: `${c.lastActiveTime} (${new Date(c.lastActiveTime).toISOString()}; ${((new Date() - c.lastActiveTime) / 1000) / 60} minutes ago)`,
                connectionId: c.connectionId,
                isFree: freeConnections.delete(c.connectionId)
            }
        })
        await message.channel.send(`Live connections:\n\`\`\`\n${JSON.stringify(connectionInfo, null, 2)}\`\`\``)
        if (freeConnections.size != 0) await message.channel.send(`Other free connections: ${freeConnections.values()}`)
    }
}
