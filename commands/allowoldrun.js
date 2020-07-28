const afk = require('./oldAfkCheck');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'allowoldrun',
    description: 'Manually allows runs in case bot gets stuck',
    role: 'almostrl',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (message.channel.parent.name.toLowerCase() === 'raiding') afk.allowRun(false);
        else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') afk.allowRun(true);
        else return message.channel.send(`Please try again in ${message.guild.channels.cache.get(settings.channels.raidcommands)} or ${message.guild.channels.cache.get(settings.channels.vetcommands)}`);

        message.channel.send('Run has been reset, try again')
    }
}