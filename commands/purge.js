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
        return slashCommandJSON(this, guild)
    },
    async execute(message, args, bot) {
        const quantity = message.options.getNumber('count')
        if (quantity <= 0) return message.reply("I can't delete nothing!")
        if (quantity > 100) return message.reply('Max is 100 messages!')

        await message.reply("You're stinky :)")
        await message.deleteReply()
        await message.channel.bulkDelete(quantity)
    }
}
