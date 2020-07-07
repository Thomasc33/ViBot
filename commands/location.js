const afkCheck = require('./afkCheck.js');
const ErrorLogger = require('../logError');
const EventAFK = require('./eventAfk')

module.exports = {
    name: 'location',
    description: 'Changes the location of the current run',
    alias: ['loc'],
    args: '<location>',
    role: 'Event Organizer',
    execute(message, args, bot) {
        var isVet = false;
        let settings = bot.settings[message.guild.id]
        if (!(message.channel.parent.name.toLowerCase() === 'raiding' || message.channel.parent.name.toLowerCase() === 'veteran raiding' || message.channel.parent.name.toLowerCase() === 'events')) {
            message.channel.send("Try again in a correct category");
            return;
        }
        if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
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
        if (location == '') return;
        if (message.channel.parent.name.toLowerCase() === 'events') {
            EventAFK.changeLocation(location)
        } else {
            afkCheck.changeLocation(location, isVet, message.channel);
        }
    }
}