const Discord = require('discord.js')
var ControlPanelGuild
var CommandChannel

module.exports = {
    async log(message, bot) {
        if (!bot) return
        if (!ControlPanelGuild) ControlPanelGuild = bot.guilds.cache.get('739623118833713214')
        if (!ControlPanelGuild) {
            let vi = await bot.users.fetch(`277636691227836419`)
            return vi.send(`Control panel guild not found`)
        }
        if (!CommandChannel) {
            if (bot.user.id == '701196529519689790') CommandChannel = ControlPanelGuild.channels.cache.get('750146410460217426')
            else CommandChannel = ControlPanelGuild.channels.cache.get('740610779014889492')
        }
        if (!CommandChannel) {
            let vi = await bot.users.fetch(`277636691227836419`)
            return vi.send(`Erorr Channel guild not found`)
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
        CommandChannel.send({ embeds: [embed] })
    }
}