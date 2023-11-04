const Discord = require('discord.js')
const { createEmbed, getRoleStrings } = require('../lib/extensions.js')
const siteSettings = require('../settings.json').config

module.exports = {
    name: 'templates',
    description: 'Shows all current enabled afk run templates',
    alias: ['template', 'events', 'event', 'exalt', 'exalts'],
    role: 'eventrl',
    args: '[exalts]',
    async execute(message, args, bot) {
        const botSettings = bot.settings[message.guild.id]
        const templatesUrl = new URL(siteSettings.url)
        templatesUrl.pathname = `/api/${message.guild.id}/commandchannel/${message.channel.id}/templates`
        templatesUrl.searchParams.append('roles', getRoleStrings(botSettings, message.member).join(','))
        templatesUrl.searchParams.append('key', siteSettings.key)
        const templates = await fetch(templatesUrl).then(f => f.json())
        const parentTemplateValue = {}
        for (const template of templates) {
            for (const inherit of template.sectionNames) {
                if (!parentTemplateValue[inherit]) parentTemplateValue[inherit] = { field: 0, line: 0, value: [''] }
                const reacts = template.reacts ? Object.keys(template.reacts).filter(react => template.reacts[react].onHeadcount) : []
                const newTemplate = `\n${reacts[0] ? `${bot.storedEmojis[template.reacts[reacts[0]].emote].text}| ` : ''}\`${template.aliases.reduce((a, b) => a.length <= b.length ? a : b).padEnd(2)}\` | **${template.templateName.toString().substring(0, 20)}**`
                if (parentTemplateValue[inherit].value[parentTemplateValue[inherit].field].length + newTemplate.length > 1024 || parentTemplateValue[inherit].line >= 15) {
                    parentTemplateValue[inherit].field++
                    parentTemplateValue[inherit].line = 0
                    parentTemplateValue[inherit].value.push('')
                }
                parentTemplateValue[inherit].value[parentTemplateValue[inherit].field] += newTemplate
                parentTemplateValue[inherit].line++
            }
        }
        const parentTemplateKeys = Object.keys(parentTemplateValue)
        let navigationComponents
        let currentIndex = 0
        if (parentTemplateKeys.length > 1) {
            navigationComponents = this.createComponents(parentTemplateKeys, currentIndex)
            const templateMessage = await message.channel.send({ embeds: [this.createEmbed(parentTemplateValue, parentTemplateKeys[currentIndex], message)], components: navigationComponents })
            const navigationInteractionHandler = new Discord.InteractionCollector(bot, { time: 300000, message: templateMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            navigationInteractionHandler.on('collect', async interaction => {
                if (interaction.user.id != message.author.id) return
                if (interaction.customId == 'minus') {
                    currentIndex = currentIndex == 0 ? parentTemplateKeys.length - 1 : currentIndex - 1
                    await interaction.update({ embeds: [this.createEmbed(parentTemplateValue, parentTemplateKeys[currentIndex], message)], components: this.createComponents(parentTemplateKeys, currentIndex) })
                } else if (interaction.customId == 'plus') {
                    currentIndex = currentIndex == parentTemplateKeys.length - 1 ? 0 : currentIndex + 1
                    await interaction.update({ embeds: [this.createEmbed(parentTemplateValue, parentTemplateKeys[currentIndex], message)], components: this.createComponents(parentTemplateKeys, currentIndex) })
                }
            })
            navigationInteractionHandler.on('end', async () => {
                await templateMessage.edit({ components: [] })
            })
        }
        await message.react('✅')
    },
    createEmbed(templateValue, inherit, message) {
        const templateEmbed = createEmbed(message, `The dungeons displayed are specific to this channel, ${message.channel} and your staff roles, ${message.member.roles.highest}.\n\nThis page displays all the available templates in the \`${inherit.charAt(0).toUpperCase() + inherit.slice(1)}\` Category.`, null)
        templateEmbed.setColor('#ff0000')
        templateEmbed.setTitle('Available Templates')
        for (let i = 0; i < templateValue[inherit].value.length; i++) {
            if (i != 0 && i % 2 == 0) templateEmbed.addFields({ name: '\u200b', value: '\u200b', inline: false })
            templateEmbed.addFields({ name: ' ', value: templateValue[inherit].value[i], inline: true })
        }
        return templateEmbed
    },
    createComponents(templates, currentIndex) {
        const nextIndex = currentIndex == templates.length - 1 ? 0 : currentIndex + 1
        const previousIndex = currentIndex == 0 ? templates.length - 1 : currentIndex - 1
        return [
            new Discord.ActionRowBuilder().addComponents([
                new Discord.ButtonBuilder()
                    .setEmoji('⬅️')
                    .setStyle(Discord.ButtonStyle.Secondary)
                    .setCustomId('minus')
                    .setLabel(templates[previousIndex].charAt(0).toUpperCase() + templates[previousIndex].slice(1)),
                new Discord.ButtonBuilder()
                    .setEmoji('➡️')
                    .setStyle(Discord.ButtonStyle.Secondary)
                    .setCustomId('plus')
                    .setLabel(templates[nextIndex].charAt(0).toUpperCase() + templates[nextIndex].slice(1))
            ])
        ]
    }
}
