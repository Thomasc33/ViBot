const afk = require('./afkCheck');
const ErrorLogger = require('../lib/logError')
const EventAFK = require('./eventAfk')

module.exports = {
    name: 'allowrun',
    description: 'Manually allows runs in case bot gets stuck',
    role: 'eventrl',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            afk.allowRun(false);
        } else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            afk.allowRun(true);
        } else if (message.channel.parent.name.toLowerCase() === 'events') {
            EventAFK.allowRun()
        }
        else {
            message.channel.send(`Please try again in ${message.guild.channels.cache.get(settings.channels.raidcommands)} or ${message.guild.channels.cache.get(settings.channels.vetcommands)}`);
            return;
        }
        message.channel.send('Run has been reset, try again')
    }
}