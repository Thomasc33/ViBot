const afkCheck = require('./afkCheck.js');
const ErrorLogger = require('../lib/logError');
const EventAFK = require('./eventAfk')

module.exports = {
    name: 'location',
    description: 'Changes the location of the current run',
    alias: ['loc'],
    requiredArgs: 1,
    args: '<location>',
    role: 'eventrl',
    execute(message, args, bot) {
        let channel = message.member.voice.channelID
        if (!channel) return message.channel.send('Please join a voice channel to change location')
        let location = "";
        for (i = 0; i < args.length; i++) location = location.concat(args[i]) + ' ';
        location = location.trim();
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (location == '') return;
        if (message.channel.parent.name.toLowerCase() === 'events') return EventAFK.changeLocation(location)
        let res = afkCheck.changeLocation(location, channel)
        if (res) message.channel.send(res)
        else message.react('✅');

    }
}