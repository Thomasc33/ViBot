const afk = require('./afkCheck');

module.exports = {
    name: 'allowrun',
    descriptions: 'manually allows runs in case bot gets stuck',
    execute(message, args, bot) {
        if (message.channel.name === 'dylanbot-commands') {
            afk.allowRun(false);
        } else if (message.channel.name === 'veteran-bot-commands') {
            afk.allowRun(true);
        } else {
            message.channel.send('Please try again in dylanbot-commands or veteran-bot-commands');
            return;
        }
        message.channel.send('Run has been reset, try again')
    }
}