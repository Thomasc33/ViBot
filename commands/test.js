const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');

module.exports = {
    name: 'test',
    description: 'Holds testing code',
    guildSpecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        let embed = new Discord.EmbedBuilder()
            .setTitle('Confirm Action')
            .setColor('#FF0000')
            .setDescription('Testing')
        await message.channel.send({ embeds: [embed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(message.author.id)) {
                console.log(true)
            } else console.log(false)
        })
    }
}
