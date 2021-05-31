const fs = require('fs');
module.exports = {
    name: 'reload',
    role: 'moderator',
    description: 'Reloads all command without restarting bot',
    execute(message, args, bot) {
        let commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
        message.channel.send('Reloading all commands')
        bot.commands.clear()
        for (let file of commandFiles) {
            delete require.cache[require.resolve(`./${file}`)]
            let command = require(`./${file}`);
            bot.commands.set(command.name, command);
        }
        message.channel.send('Done')
    }
}