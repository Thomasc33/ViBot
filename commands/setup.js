const { timestamp } = require('../lib/settings');
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
    async execute(message) {
        await message.reply(`Current settings version: \`${timestamp[message.guild.id]}\` (<t:${Buffer.from(timestamp[message.guild.id], 'hex').readUInt32BE()}:R>)`);
    }
};
