const afkChecks = require('./afkCheck')

module.exports = {
    name: 'restart',
    description: 'Restarts the bot',
    role: 'moderator',
    restarting: false,
    async execute(message, args, bot) {
        if (args.length != 0 && args[0].toLowerCase() == 'force') process.exit()
        else module.exports.restarting = true;
        message.channel.send('Restart Queued')
        let Promises = []

        //afk checks
        let activeRuns = await afkChecks.checkRuns()
        let afkChecksEmitter = afkChecks.emitter
        for (let i of activeRuns) {
            Promises.push(new Promise((res, rej) => {
                afkChecksEmitter.on('Ended', channelID => {
                    if (channelID == i) res()
                })
            }))
        }
        console.log(Promises)
        if (Promises.length == 0) {console.log('test');process.exit()}
        await Promise.all(Promises).then(() => { process.exit() })
    }
}