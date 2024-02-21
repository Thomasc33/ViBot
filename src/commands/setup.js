module.exports = {
    name: 'setup',
    description: 'set names of stuff',
    role: 'moderator',
    /**
     *
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     * @param {*} db
     */
    async execute(message, args, bot) {
        await message.reply(`Current settings version: \`${bot.settingsTimestamp[message.guild.id]}\` (<t:${Buffer.from(bot.settingsTimestamp[message.guild.id], 'hex').readUInt32BE()}:R>)`);
    }
};
