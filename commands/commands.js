const Discord = require('discord.js');

module.exports = {
    name: 'commands',
    description: 'Gives list of commands available',
    execute(message, args) {
        let commandPanel = new Discord.MessageEmbed()
            .setTitle('Commands')
            .setColor('#ff0000')
            .addFields(
                { name: 'Raiding', value: '\`\`\`;afk ;resetchannel ;unlock ;clean\`\`\`' }
            )
        message.channel.send(commandPanel);
    },
};