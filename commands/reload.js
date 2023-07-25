const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'reload',
    description: 'Reloads a certain command.',
    args: '<command>',
    guildspecific: true,
    role: 'developer',
    // args: [slashArg(SlashArgType.String, 'command', {
    //     required: true,
    //     description: "Any Command in Vibot"
    // }),],
    // getSlashCommandData(guild) {
    //     return slashCommandJSON(this, guild)
    // },
    async execute(message, args, bot, db) {
        const commandName = args[0].toLowerCase();
        const command = bot.commands.get(commandName);

        // Check if command is valid
        if (!command) return message.reply(`There is no command with name \`${commandName}\`!`);


        // Delete File from Cache
        delete require.cache[require.resolve(`./${command.name}.js`)];

        try {
            message.client.commands.delete(command.name);
            const newCommand = require(`./${command.name}.js`);
            message.client.commands.set(newCommand.name, newCommand);
            await message.reply(`Command \`${newCommand.name}\` was reloaded!`);
        } catch (error) {
            console.error(error);
            await message.reply(`There was an error while reloading a command \`${command.name}\`:\n\`${error.message}\``);
        }
    }
}
