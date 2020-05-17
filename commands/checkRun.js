const afkCheck = require('./afkCheck')

module.exports = {
    name: 'checkrun',
    description: 'checks status of the current run',
    role: 'Developer',
    execute(message, args, bot) {
        if (message.channel.name === 'dylanbot-commands') {
            afkCheck.checkRun(false)
        } else if (message.channel.name === 'veteran-bot-commands') {
            afkCheck.checkRun(true)
        } else return;
    }
}