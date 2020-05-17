const Discord = require('discord.js')

module.exports = {
    name: 'logError',
    async log(error, bot) {
        let vi = await bot.users.fetch(`277636691227836419`)
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Error')
            .addField('Type', error.name)
            .addField('Message', `\`\`\`${error.message}\`\`\``)
            //.addField('Stack', error.stack)
            //.addField('Line', error.lineNumber)
            .setTimestamp()
        vi.send(embed)
        vi.send(`\`\`\`${error.stack}\`\`\``)
    }
}