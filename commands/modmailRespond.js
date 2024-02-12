const Discord = require('discord.js')
const { Modmail } = require('../lib/modmail')

module.exports = {
    name: 'modmailrespond',
    alias: ['mmr'],
    role: 'security',
    args: '<id>',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (!settings.backend.modmail) {
            messsage.reply(`Modmail is disabled in this server.`)
            return
        }
        if (message.channel.id !== settings.channels.modmail) return
        if (!args[0]) return
        /** @type {Discord.Message} */
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

        const modmailMessageID = embed.data.footer.text.split(/ +/g)[5];
        const userModmailMessage = await dms.messages.fetch(modmailMessageID)

        m.message = m;
        await Modmail.send({ interaction: m, moderator: message.member, settings, embed, raider, directMessages: dms, userModmailMessage, db, bot })
        message.delete()
    }
}