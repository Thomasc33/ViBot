const fs = require('fs')
module.exports = {
    name: 'reload',
    role: 'Moderator',
    description: 'Updates a command without restarting bot',
    execute(message, args, bot) {
        if (!args.length) return message.channel.send(`Please provide a command to reload`);
        const commandName = args[0].toLowerCase();
        const command = bot.commands.get(commandName) || bot.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if (!command) return message.channel.send(`There is no command with name or alias \`${commandName}\`, ${message.author}!`);
        delete require.cache[require.resolve(`./${command.name}.js`)];
        try {
            const newCommand = require(`./${command.name}.js`);
            bot.commands.set(newCommand.name, newCommand);
            message.react('✅')
        } catch (error) {
            console.log(error);
            message.channel.send(`There was an error while reloading a command \`${command.name}\`:\n\`${error.message}\``);
        }
    }
}