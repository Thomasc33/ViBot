const Discord = require('discord.js')
const loggingInfo = require('../data/loggingInfo.json');

module.exports = {
    async log(message, bot) {
        if (!bot) return
        let guildHub = bot.guilds.cache.get(loggingInfo.info.guildid);
        let vi = bot.users.fetch(loggingInfo.info.vi)
        if (!guildHub) {
            console.log("ViBot Info not found. ``logCommand.js``")
            await vi.send("ViBot Info not found. ``logCommand.js``")
            return
        }
        let channel = guildHub.channels.cache.get(loggingInfo[message.guild.id].channelCommand)
        if (!channel) channel = guildHub.channels.cache.get(loggingInfo.info.channelCommand)
        if (!channel) {
            console.log("ViBot Info Channel not found. ``logCommand.js``")
            await vi.send("ViBot Info Channel not found. ``logCommand.js``")
            return
        }
        let embed = new Discord.EmbedBuilder()
            .setColor('#0000ff')
            .setAuthor({ name: message.author.tag })
            .setDescription(`<@!${message.author.id}> issued the following command: \`${message.content}\``)
            .addFields([
                { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: 'URL', value: `${message.url}`, inline: true },
            ])
            .setTimestamp()
        if (message.author.avatarURL()) embed.data.author.iconURL = message.author.avatarURL()
        channel.send({ embeds: [embed] })
    },
    async logInteractionCommand(interaction, bot) {
        if (!bot) return
        let guildHub = bot.guilds.cache.get(loggingInfo.info.guildid);
        let vi = bot.users.fetch(loggingInfo.info.vi)
        if (!guildHub) {
            console.log("ViBot Info not found. ``logCommand.js``")
            await vi.send("ViBot Info not found. ``logCommand.js``")
            return
        }
        let channel = guildHub.channels.cache.get(loggingInfo[interaction.guild.id].channelCommand)
        if (!channel) channel = guildHub.channels.cache.get(loggingInfo.info.channelCommand)
        if (!channel) {
            console.log("ViBot Info Channel not found. ``logCommand.js``")
            await vi.send("ViBot Info Channel not found. ``logCommand.js``")
            return
        }
        let embed = new Discord.EmbedBuilder()
            .setColor('#0000ff')
            .setAuthor({ name: interaction.user.tag })
            .setDescription(`<@!${interaction.user.id}> issued the following command: \`${interaction.commandName}\``)
            .addFields([
                { name: 'Channel', value: `<#${interaction.channel.id}>`, inline: true },
                { name: 'URL', value: `${interaction.url}`, inline: true },
            ])
            .setTimestamp()
        if (interaction.user.avatarURL()) embed.data.author.iconURL = interaction.user.avatarURL()
        channel.send({ embeds: [embed] })
    }
}