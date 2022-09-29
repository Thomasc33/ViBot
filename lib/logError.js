const Discord = require('discord.js')
var ControlPanelGuild
var ErrorChannel

module.exports = {
    name: 'logError',
    /**
     * 
     * @param {*} error 
     * @param {Discord.Client} bot 
     * @returns 
     */
    async log(error, bot) {
        console.log(error)
        if (!error) return
        if (!bot || !bot.token) return
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
            let embed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Error')
                .addFields([
                    { name: 'Type', value: error.name.toString() },
                    { name: 'Message', value: `\`\`\`${error.message.toString()}\`\`\`` }
                ])
                .setTimestamp()
            if (error.method) embed.addFields({ name: 'Method', value: error.method.toString() })
            if (error.path) embed.addFields({ name: 'Path', value: error.path.toString() })
            if (error.code) embed.addFields({ name: 'Code', value: error.code.toString() })
            if (error.httpStatus) embed.addFields({ name: 'httpStatus', value: error.httpStatus.toString() })
            ErrorChannel.send({ content: `\`\`\`${error.stack.toString()}\`\`\``, embeds: [embed] }).catch(er => { console.log(`unable to send this error: ${error}`) })
        } else if (error.message) {
            ErrorChannel.send(error.message).catch(er => { console.log(`unable to send this error: ${error}`) })
        }
        else {
            if (!error.toString()) return
            ErrorChannel.send(error.toString()).catch(er => { console.log(`unable to send this error: ${error}`) })
        }

    }
}