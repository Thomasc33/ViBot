const afkCheck = require('./afkCheck.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'location',
    description: 'Changes the location of the current run',
    alias: 'loc',
    args: '<location>',
    role: 'Almost Raid Leader',
    execute(message, args, bot) {
        var isVet = false;
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (message.channel.name === 'veteran-bot-commands') {
            isVet = true;
        }
        let location = "";
        for (i = 0; i < args.length; i++) {
            location = location.concat(args[i]) + ' ';
        }
        location = location.trim();
        if (location.length >= 1024) {
            message.channel.send('Location must be below 1024 characters, try again');
        }
        afkCheck.changeLocation(location, isVet, message.channel);
    }
}