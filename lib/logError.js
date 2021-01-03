const Discord = require('discord.js')
var ControlPanelGuild
var ErrorChannel

module.exports = {
    name: 'logError',
    async log(error, bot) {
        if (!error) return
        if (!bot) return
        if (!ControlPanelGuild) ControlPanelGuild = bot.guilds.cache.get('739623118833713214')
        if (!ControlPanelGuild) {
            let vi = await bot.users.fetch(`277636691227836419`)
            if (!vi) return
            return vi.send(`Control panel guild not found`).catch(er => { })
        }
        if (!ErrorChannel) {
            if (bot.user.id == '701196529519689790') ErrorChannel = ControlPanelGuild.channels.cache.get('740978533576474675')
            else ErrorChannel = ControlPanelGuild.channels.cache.get('740610667161190480')
        }
        if (!ErrorChannel) {
            let vi = await bot.users.fetch(`277636691227836419`)
            return vi.send(`Erorr Channel guild not found`)
        }
        if (error.name && error.message) {
            let embed = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setTitle('Error')
                .addField('Type', error.name)
                .addField('Message', `\`\`\`${error.message}\`\`\``)
                .setTimestamp()
            if (error.method) embed.addField('Method', error.method)
            if (error.path) embed.addField('Path', error.path)
            if (error.code) embed.addField('Code', error.code)
            if (error.httpStatus) embed.addField('httpStatus', error.httpStatus)
            ErrorChannel.send(`\`\`\`${error.stack}\`\`\``, embed).catch(er => { console.log(`unable to send this error: ${error}`) })
        } else if (error.message) {
            ErrorChannel.send(error.message).catch(er => { console.log(`unable to send this error: ${error}`) })
        }
        else {
            if (!error.toString()) return
            ErrorChannel.send(error).catch(er => { console.log(`unable to send this error: ${error}`) })
        }

    }
}