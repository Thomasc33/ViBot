const afk = require('./afkCheck');
const ErrorLogger = require('../logError')
const EventAFK = require('./eventAfk')

module.exports = {
    name: 'allowrun',
    description: 'Manually allows runs in case bot gets stuck',
    role: 'Event Organizer',
    execute(message, args, bot) {
        if (message.channel.name === 'dylanbot-commands') {
            afk.allowRun(false);
        } else if (message.channel.name === 'veteran-bot-commands') {
            afk.allowRun(true);
        } else if(message.channel.name === 'eventbot-commands'){
            EventAFK.allowRun()
        } 
        else {
            message.channel.send('Please try again in dylanbot-commands or veteran-bot-commands');
            return;
        }
        message.channel.send('Run has been reset, try again')
    }
}