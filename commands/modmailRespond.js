const Discord = require('discord.js')

module.exports = {
    name: 'modmailrespond',
    alias: ['mmr'],
    role: 'security',
    args: '<id>',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (message.channel.id !== settings.channels.modmail) return
        if (!args[0]) return
        let m = await message.channel.messages.fetch(args[0])
        if (!m) return message.channel.send(`Could not find message with ID of \`${args[0]}\``)
        let embed = new Discord.EmbedBuilder()
        embed.data = m.embeds[0].data;
        let raider;
        if (!raider)
            try {
                raider = message.guild.members.cache.get(embed.data.footer.text.split(/ +/g)[2]);
                if (!raider)
                    raider = await message.guild.members.fetch({ user: embed.data.footer.text.split(/ +/g)[2], force: true });
            } catch (e) { return message.channel.send(`User is not currently in the server.`); }
        if (!raider)
            return message.channel.send(`User is not currently in the server.`);
        let dms = await raider.user.createDM()

        function checkInServer() {
            const result = message.guild.members.cache.get(dms.recipient.id);
            if (!result)
                message.channel.send(`User ${dms.recipient} is no longer in the server.`);
            return result;
        }

        let originalMessage = embed.data.description;
        originalMessage = originalMessage.substring(originalMessage.indexOf(':') + 3, originalMessage.length - 1)
        let responseEmbed = new Discord.EmbedBuilder()
            .setDescription(`__How would you like to respond to ${raider}'s [message](${m.url})__\n${originalMessage}`)
        let responseEmbedMessage = await message.channel.send({ embeds: [responseEmbed] })
        let responseCollector = new Discord.MessageCollector(message.channel,{filter:  m => m.author.id === message.author.id})
        responseCollector.on('collect', async function (mes) {
            let response = mes.content.trim()
            if (response == '') return mes.channel.send(`Invalid response. Please provide text. If you attached an image, please copy the URL and send that`)
            responseCollector.stop()
            await mes.delete()
            if (!checkInServer())
                return responseEmbedMessage.delete();
            responseEmbed.setDescription(`__Are you sure you want to respond with the following?__\n${response}`)
            await responseEmbedMessage.edit({ embeds: [responseEmbed] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(message.author.id)) {
                    if (!checkInServer())
                        return responseEmbedMessage.delete();
                    await dms.send(response)
                    responseEmbedMessage.delete()
                    embed.addFields([{ name: `Response by ${message.member.displayName}:`, value: response }])
                    m.edit({ embeds: [embed] })
                } else {
                    await responseEmbedMessage.delete()
                }
            })
        })
        message.delete()
    }
}