const { slashArg, slashCommandJSON } = require('../utils.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;

module.exports = {
    name: 'echo',
    role: 'moderator',
    description: 'Posts the message given',
    varargs: true,
    args: [
        slashArg(SlashArgType.String, 'message', {
            description: 'The message to echo',
            required: true
        })
    ],
    getNotes() {
        return 'The slash command version is completely invisible to other members :)';
    },
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild);
    },
    async execute(message) {
        await Promise.all([
            message.channel.send(message.content.substring(6)),
            message.delete()
        ]);
    },
    async slashCommandExecute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        await interaction.deleteReply();
        await interaction.channel.send(interaction.options.getString('message'));
    }
};
