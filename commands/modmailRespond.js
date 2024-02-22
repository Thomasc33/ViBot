const { EmbedBuilder, Colors } = require('discord.js');
const { Modmail } = require('../lib/modmail.js');
const { settings } = require('../lib/settings');

module.exports = {
    name: 'modmailrespond',
    alias: ['mmr'],
    role: 'security',
    args: '<id>',
    requiredArgs: 1,
    /**
     * @param {import('discord.js').Message} message
     * @param {string[]} args
     * @param {import('discord.js').Client} bot
     * @param {import('mysql2').Pool} db
     */
    async execute(message, args, bot, db) {

        const embed = new EmbedBuilder()
            .setTitle('Modmail Respond')
            .setAuthor({ name: message.member.displayName, iconURL: message.member.displayAvatarURL() })
            .setColor(Colors.Red)
            .setTimestamp();

        if (!settings[message.guild.id].backend.modmail) return await message.reply({ embeds: [embed.setDescription('Modmail is disabled in this server.')] });
        if (message.channel.id !== settings[message.guild.id].channels.modmail) return await message.reply({ embeds: [embed.setDescription('This is not the modmail channel.')] });
        /** @type {Discord.Message} */
        const modmailMessage = await message.channel.messages.fetch(args[0]);
        if (!modmailMessage) return await message.reply({ embeds: [embed.setDescription(`Could not find message with ID of \`${args[0]}\``)] });
        const modmailEmbed = EmbedBuilder.from(modmailMessage.embeds[0]);

        const raiderId = modmailEmbed.data.footer.text.split(/ +/g)[2];
        const raider = await message.guild.members.fetch({ user: raiderId, force: true });
        if (!raider) return await message.reply({ embeds: [embed.setDescription(`User <@!${raiderId}> is no longer in the server.`)] });

        const dms = await raider.user.createDM();
        if (!dms) return await message.reply({ embeds: [embed.setDescription(`Cannot send messages to ${raider}.`)] });

        message.message = message;
        const dummyInteraction = {
            message: modmailMessage,
            member: message.member,
            guild: message.guild,
            channel: message.channel,
            reply: message.reply.bind(message)
        };
        await Modmail.send({ settings: settings[message.guild.id], interaction: dummyInteraction, embed: modmailEmbed, raider, db, bot });
        message.delete();
    }
};
