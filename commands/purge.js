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
        let quantity = message.options.getNumber('count')

        if (quantity <= 0){
            message.reply('I can\'t delete nothing!')
            return
        }

        if (quantity > 100) { 
            message.reply('Max is 100 messages!')
            return
        }

        await message.reply('You\'re stinky :)')
        await message.deleteReply()
        message.channel.bulkDelete(quantity)
    }
}