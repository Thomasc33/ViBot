const fs = require('fs')
const botStatus = require('./botstatus')
const afkCheck = require('./afkCheck.js')

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
        
        let Promises = []

        //afk checks
        
        const raidIDs = afkCheck.returnActiveRaidIDs(bot)
        for (let i of raidIDs) {
            Promises.push(new Promise((res, rej) => {
                setInterval(checkActive, 5000)
                function checkActive() {
                    if (!bot.afkChecks[i]?.active) res()
                }
            }))
        }

        if (Promises.length == 0) process.exit()

        module.exports.restarting = true;
        await message.channel.send('Restart Queued')
        await botStatus.updateStatus(bot, 'Restart Pending', '#ff0000')
        
        await Promise.all(Promises).then(() => { process.exit() })
    }
}
