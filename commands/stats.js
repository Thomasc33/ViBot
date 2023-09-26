
const Discord = require('discord.js')
const statsTemplate = require('../data/stats.json')
const { getDB } = require('../dbSetup.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

module.exports = {
    name: 'stats',
    description: 'Gives users stats',
    role: 'raider',
    userCommand: true,
    args: [
        slashArg(SlashArgType.User, 'user', {
            required: false,
            description: "The user whose stats you'd like to view"
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot) {
        let member
        if (args.length == 0) member = message.member
        if (message.channel.type == Discord.ChannelType.DM) member = message.author
        if (!member) member = message.guild.findMember(args.join(''))
        if (!member) return message.reply('Could not find a member.')
        const filteredTemplates = statsTemplate.filter(template => getDB(template.id))
        const { storedEmojis } = bot

        const embed = new Discord.EmbedBuilder()
            .setColor('#015c21')
            .setDescription(`__**Stats for**__ ${member} ${member ? '`' + (member.nickname || member.tag) + '`' : ''}\n\nHold on... Processing`)
        const statsMessage = await message.reply({ embeds: [embed] })

        const serverIndex = filteredTemplates.findIndex(template => template.id == message.guild.id)
        let currentIndex = serverIndex
        if (serverIndex < 0) {
            embed.setDescription('This server does not have stats set up yet.')
            return await statsMessage.edit({ embeds: [embed] })
        }
        embed.setDescription(`__**Stats for**__ ${member} ${member ? '`' + (member.nickname || member.tag) + '`' : ''}`)
        let navigationComponents
        if (filteredTemplates.length > 1) {
            navigationComponents = this.createComponents(filteredTemplates, currentIndex)
            const navigationInteractionHandler = new Discord.InteractionCollector(bot, { time: 300000, message: statsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            navigationInteractionHandler.on('collect', async interaction => {
                if (interaction.user.id != message.author.id) return
                if (interaction.customId == 'minus') {
                    currentIndex = currentIndex == 0 ? filteredTemplates.length - 1 : currentIndex - 1
                    await this.setEmbedFields(embed, filteredTemplates[currentIndex], storedEmojis, member)
                    await interaction.update({ embeds: [embed], components: this.createComponents(filteredTemplates, currentIndex) })
                } else if (interaction.customId == 'plus') {
                    currentIndex = currentIndex == filteredTemplates.length - 1 ? 0 : currentIndex + 1
                    await this.setEmbedFields(embed, filteredTemplates[currentIndex], storedEmojis, member)
                    await interaction.update({ embeds: [embed], components: this.createComponents(filteredTemplates, currentIndex) })
                }
            })
            navigationInteractionHandler.on('end', async () => {
                await statsMessage.edit({ components: [] })
            })
        }

        await this.setEmbedFields(embed, filteredTemplates[currentIndex], storedEmojis, member)
        await statsMessage.edit({ embeds: [embed], components: navigationComponents })
    },
    async setEmbedFields(embed, template, storedEmojis, member) {
        const db = getDB(template.id)
        let userRows
        if (db) {
            [userRows] = await db.promise().query('SELECT * FROM users WHERE id = ?', [member.id])
            if (userRows.length == 0) {
                await db.promise().query(`INSERT INTO users (id) VALUES (${member.id})`);
                [userRows] = await db.promise().query('SELECT * FROM users WHERE id = ?', [member.id])
            }
        }
        embed.setFields({ name: `${storedEmojis[template.emoji].text} ${template.name} ${storedEmojis[template.emoji].text}`, value: '** **', inline: false })
        template.values.map(value =>
            embed.addFields({
                name: `${storedEmojis[value.emoji].text} __${value.name}__ ${storedEmojis[value.emoji].text}`,
                value: `${value.values.map(row => `${storedEmojis[row.emoji].text} \`${row.multiply ? Math.floor(userRows[0][row.row] * row.multiply) : userRows[0][row.row]}\`${row.name ? ` ${row.name}` : ''}`).join('\n')}`,
                inline: true
            })
        )
    },
    createComponents(filteredTemplates, currentIndex) {
        const nextIndex = currentIndex == filteredTemplates.length - 1 ? 0 : currentIndex + 1
        const previousIndex = currentIndex == 0 ? filteredTemplates.length - 1 : currentIndex - 1
        return [
            new Discord.ActionRowBuilder().addComponents([
                new Discord.ButtonBuilder()
                    .setEmoji('⬅️')
                    .setStyle(Discord.ButtonStyle.Secondary)
                    .setCustomId('minus')
                    .setLabel(filteredTemplates[previousIndex].name),
                new Discord.ButtonBuilder()
                    .setEmoji('➡️')
                    .setStyle(Discord.ButtonStyle.Secondary)
                    .setCustomId('plus')
                    .setLabel(filteredTemplates[nextIndex].name)
            ])
        ]
    }
}
