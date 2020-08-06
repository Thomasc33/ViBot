const Discord = require('discord.js')
var ControlPanelGuild
var ErrorChannel

module.exports = {
    name: 'logError',
    async log(error, bot) {
        if (!error) return
        if (!bot) return
        console.log(error)
        if (!ControlPanelGuild) ControlPanelGuild = bot.guilds.cache.get('739623118833713214')
        if (!ControlPanelGuild) {
            let vi = await bot.users.fetch(`277636691227836419`)
            return vi.send(`Control panel guild not found`)
        }
        if (!ErrorChannel) ErrorChannel = ControlPanelGuild.channels.cache.get('740610667161190480')
        if (!ErrorChannel) {
            let vi = await bot.users.fetch(`277636691227836419`)
            return vi.send(`Erorr Channel guild not found`)
        }
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Error')
            .addField('Type', error.name)
            .addField('Message', `\`\`\`${error.message}\`\`\``)
            .setTimestamp()
        ErrorChannel.send(`\`\`\`${error.stack}\`\`\``, embed)
    }
}