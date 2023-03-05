const fs = require('fs')
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
        // Log channel the message was sent to
        const channel = message.channel;
        const d = {
            guild: channel.guild.id,
            channel: channel.id
        }
        // Save channel object to file
        fs.writeFileSync('./data/restart_channel.json', JSON.stringify(d, null, 2));


        if (args.length != 0 && args[0].toLowerCase() == 'force') process.exit()
        else module.exports.restarting = true;
        message.channel.send('Restart Queued')
        botStatus.updateStatus(bot, 'Restart Pending', '#ff0000')
        let Promises = []

        //afk checks
        if (afkChecks) {
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
