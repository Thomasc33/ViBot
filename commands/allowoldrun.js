const afk = require('./oldAfkCheck');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'allowoldrun',
    description: 'Manually allows runs in case bot gets stuck',
    role: 'Almost Raid Leader',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (message.channel.parent.name.toLowerCase() === 'raiding') {
            afk.allowRun(false);
        } else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') {
            afk.allowRun(true);
        } else {
            message.channel.send(`Please try again in ${message.guild.channels.cache.find(r => r.name == settings.raidcommands)} or ${message.guild.channels.cache.find(r => r.name == settings.vetcommands)}`);
            return;
        }
        message.channel.send('Run has been reset, try again')
    }
}