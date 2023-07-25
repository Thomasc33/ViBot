const Discord = require('discord.js')
const moment = require('moment')

module.exports = {
    name: 'modmailclose',
    description: 'Closes a modmail using the message id of the modmail embed',
    alias: ['mmc'],
    role: 'security',
    args: '<id>',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (!settings.backend.modmail) return message.reply(`Modmail is disabled in this server.`)
        // check if the command is being used in the modmail channel
        if (message.channel.id !== settings.channels.modmail) return message.reply (`Must be used in modmail channel.`)
        if (!args[0]) return message.reply (`There are no arguments being provided.`)
        let m = await message.channel.messages.fetch(args[0])
        if (!m) return message.channel.send(`Could not find message with ID of \`${args[0]}\``)
        let components = m.components
        let embeds = m.embeds
        // check if the message with the given id is a modmail embed
        if (!Array.isArray(embeds) || !embeds.length) return message.reply (`Did not recognize as a modmail.`)
        // check if the modmail isn't already closed/responded to
        if (!Array.isArray(components) || !components.length) return message.reply (`This Modmail is already closed.`)
        // close the modmail
        let embed = new Discord.EmbedBuilder()
        embed.data = embeds[0].data;
        embed.addFields([{ name: `${message.member.displayName} has closed this modmail <t:${moment().unix()}:R>`, value: `This modmail has been closed` }])
        await m.edit({ embeds: [embed], components: [] })
        message.delete()
    }
}