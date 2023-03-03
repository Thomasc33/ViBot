const Discord = require('discord.js')
const loggingInfo = require('../data/loggingInfo.json');

module.exports = {
    name: 'logError',
    /**
     * 
     * @param {*} error 
     * @param {Discord.Client} bot 
     * @param {Discord.Guild} guild
     * @returns 
     */
    async log(error, bot, guild) {
        console.log(error)
        if (!error) return
        if (!bot || !bot.token) return
        let guildHub = bot.guilds.cache.get(loggingInfo.info.guildid);
        let vi = await bot.users.fetch(loggingInfo.info.vi)
        if (!guildHub) {
            console.log("ViBot Info not found. ``logError.js``")
            await vi.send("ViBot Info not found. ``logError.js``")
            return
        }
        let channel = null
        if (!guild) channel = guildHub.channels.cache.get(loggingInfo.info.channelError)
        if (!channel) channel = guildHub.channels.cache.get(loggingInfo[guild.id].channelError)
        if (!channel) channel = guildHub.channels.cache.get(loggingInfo.info.channelError)
        if (["ECONNRESET", "40060", "ER_BAD_FIELD_ERROR"].includes(error.code)) channel = guildHub.channels.cache.get(loggingInfo.info.channelSpamErrors)
        if (!channel) {
            console.log("ViBot Info Channel not found. ``logError.js``")
            await vi.send("ViBot Info Channel not found. ``logError.js``")
            return
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
            channel.send({ content: `\`\`\`${error.stack.toString()}\`\`\``, embeds: [embed] }).catch(er => { console.log(`unable to send this error: ${error}`) })
        } else if (error.message) {
            channel.send(error.message).catch(er => { console.log(`unable to send this error: ${error}`) })
        }
        else {
            if (!error.toString()) return
            channel.send(error.toString()).catch(er => { console.log(`unable to send this error: ${error}`) })
        }
    }
}