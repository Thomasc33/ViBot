const Discord = require('discord.js')
const { reconnect_dont_do_this: reconnectDontDoThis } = require('../dbSetup.js')
const { slashCommandJSON } = require('../utils.js')

function peekMysql2Queue(q) {
    let i = 0
    const elements = []
    for (;;) {
        const c = q.peekAt(i)
        if (c === undefined) break
        i += 1
        elements.push(c)
    }
    return elements
}

module.exports = {
    name: 'dbinfo',
    role: 'developer',
    description: 'Gets db stats',
    args: [],
    varargs: true,
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild)
    },
    async execute(message, args, bot, db) {
        db = db.getPoolInternal()
        const config = {
            closed: db._closed
        }
        if (args.join(' ') == 'commit crimes') {
            await reconnectDontDoThis(bot)
            await message.channel.send('oh shit')
            await new Promise(res => { setTimeout(() => { message.channel.send("you REALLY shouldn't have done that").then(() => res()) }, 2000) })
        } else {
            const configKeys = ['waitForConnections', 'connectionLimit', 'maxIdle', 'idleTimeout', 'queueLimit']
            configKeys.forEach(k => {config[k] = db.config[k]})
            await message.reply({ content: `DB Config:\n\`\`\`\n${JSON.stringify(config, null, 2)}\`\`\``, ephemeral: true })
            const freeConnections = new Set(peekMysql2Queue(db._freeConnections).map(c => c.connectionId))
            const connectionInfo = peekMysql2Queue(db._allConnections).map(c => ({
                lastActiveTime: `${c.lastActiveTime} (${new Date(c.lastActiveTime).toISOString()}; ${((new Date() - c.lastActiveTime) / 1000) / 60} minutes ago)`,
                connectionId: c.connectionId,
                commands: c._commands,
                isFree: freeConnections.delete(c.connectionId)
            }))
            const attachment = new Discord.AttachmentBuilder(Buffer.from(JSON.stringify(connectionInfo, null, 2)), { name: 'log.txt' })
            connectionInfo.map(i => delete i.commands)
            await message.followUp({ content: `Live connections:\n\`\`\`\n${JSON.stringify(connectionInfo, null, 2)}\`\`\``, files: [attachment], ephemeral: true })
            if (freeConnections.size != 0) await message.followUp({ content: `Other free connections: ${freeConnections.values()}`, ephemeral: true })
        }
    }
}
