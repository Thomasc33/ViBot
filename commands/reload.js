const { commands } = require('../lib/commands');
module.exports = {
    name: 'reload',
    description: 'Reloads a certain command.',
    args: '<command>',
    guildspecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        if (!bot.adminUsers.includes(message.author.id)) return;
        const commandName = args[0].toLowerCase();
        const command = commands.get(commandName);

        // Check if command is valid
        if (!command) return message.reply(`There is no command with name \`${commandName}\`!`);


        // Delete File from Cache
        delete require.cache[require.resolve(`./${command.name}.js`)];

        try {
            commands.delete(command.name);
            const newCommand = require(`./${command.name}.js`);
            commands.set(newCommand.name, newCommand);
            await message.reply(`Command \`${newCommand.name}\` was reloaded!`);
        } catch (error) {
            console.error(error);
            await message.reply(`There was an error while reloading a command \`${command.name}\`:\n\`${error.message}\``);
        }
    }
}
