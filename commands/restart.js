//const afkChecks = require('./afkCheck')
//afkCheck includes restart so we will just have afkCheck register at startup
let afkChecks = undefined;
const botStatus = require('./botstatus')

module.exports = {
    name: 'restart',
    description: 'Restarts the bot',
    role: 'moderator',
    restarting: false,
    allowedInRestart: true,

    async execute(message, args, bot) {
        if (args.length != 0 && args[0].toLowerCase() == 'force') process.exit()
        else module.exports.restarting = true;
        message.channel.send('Restart Queued')
        botStatus.StatusEmbed.fields[0].value = 'Restart Pending'
        botStatus.StatusEmbed.setColor('#ff0000')
        botStatus.updateAll()
        let Promises = []

        //afk checks
        if(afkChecks) {
            let activeRuns = await afkChecks.checkRuns()
            let afkChecksEmitter = afkChecks.emitter;
            for (let i of activeRuns) {
                Promises.push(new Promise((res, rej) => {
                    afkChecksEmitter.on('Ended', channelID => {
                        if (channelID == i) res()
                    })
                }))
            }
        }
        if (Promises.length == 0) process.exit()
        await Promise.all(Promises).then(() => { process.exit() })
    },
    async registerAFKCheck(afkChecksModule) {
        afkChecks = afkChecksModule;
    }
}
