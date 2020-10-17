const afkChecks = require('./afkCheck')

module.exports = {
    name: 'restart',
    description: 'Restarts the bot',
    role: 'moderator',
    restarting: false,
    execute(message, args, bot) {
        if (args.length != 0 && args[0].toLowerCase() == 'force') process.exit()
        else module.exports.restarting = true;
        message.channel.send('Restart Queued')
        let vetCheck = new Promise(async (res, rej) => {
            if (afkChecks.checkRuns(true)) {
                let emitter = afkChecks.emitter
                emitter.on('Ended', isVet => {
                    if (isVet) res()
                })
            } else res()
        })
        let regCheck = new Promise(async (res, rej) => {
            if (afkChecks.checkRuns(false)) {
                let emitter = afkChecks.emitter
                emitter.on('Ended', isVet => {
                    if (!isVet) res()
                })
            } else res()
        })
        Promise.all([vetCheck, regCheck]).then(() => { process.exit() })
    }
}