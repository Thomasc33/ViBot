const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require("../utils");

module.exports = {
    name: 'purge',
    description: 'Removes x messages from channel',
    role: 'headeventrl',
    args: [slashArg(SlashArgType.Number, 'count', {
        required: true,
        description: "Number of messages (Max 100)"
    }),],
    getSlashCommandData(guild) {
        let json = slashCommandJSON(this, guild)
        return json
    },
    async execute(message, args, bot) {
        let quantity = args[0]
        if (!quantity || Number.isNaN(quantity)) { 
            message.channel.send('Please provide a number.')
            return
        }

        if (parseInt(quantity) > 100) { 
            message.channel.send('Max is 100 messages!')
            return
        }

        await message.reply('You\'re stinky :)')
        await message.deleteReply()
        message.channel.bulkDelete(quantity)
    }
}