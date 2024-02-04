const { slashArg, slashCommandJSON } = require('../utils.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;

module.exports = {
    name: 'echo',
    role: 'moderator',
    description: 'Posts the message given',
    varargs: true,
    args: [
        slashArg(SlashArgType.String, 'message', {
            description: 'The message to echo'
        })
    ],
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild);
    },
    async execute(message) {
        await message.channel.send(message.content.substring(6, message.content.length));
        await message.delete();
    },
    async slashCommandExecute(interaction) {
        await interaction.channel.send(interaction.options.getString('message'));
    }
};
