const Discord = require('discord.js');
const { createEmbed } = require('../lib/extensions.js');
const { resolveTemplateList, AfkTemplateValidationError } = require('./afkTemplate.js');
const { settings } = require('../lib/settings');

module.exports = {
    name: 'templates',
    description: 'Shows all current enabled afk run templates',
    alias: ['template', 'events', 'event', 'exalt', 'exalts'],
    role: 'eventrl',
    args: '[exalts]',
    async execute(message, args, bot) {
        const templates = await resolveTemplateList(settings[message.guild.id], message.member, message.guild.id, message.channel.id);
        if (templates instanceof AfkTemplateValidationError) return await message.channel.send(templates.message());

        const parentTemplateValue = {};
        for (let i = 0; i < templates.length; i++) {
            for (const inherit of templates[i].sectionNames) {
                if (!parentTemplateValue[inherit]) parentTemplateValue[inherit] = { field: 0, line: 0, value: [''] };
                const reacts = templates[i].reacts ? Object.keys(templates[i].reacts).filter(react => templates[i].reacts[react].onHeadcount) : [];
                const newTemplate = `\n${reacts[0] ? `${bot.storedEmojis[templates[i].reacts[reacts[0]].emote].text}| ` : ''}\`${templates[i].aliases.reduce((a, b) => a.length <= b.length ? a : b).padEnd(2)}\` | **${templates[i].templateName.toString().substring(0, 20)}**`;
                if (parentTemplateValue[inherit].value[parentTemplateValue[inherit].field].length + newTemplate.length > 1024 || parentTemplateValue[inherit].line >= 15) {
                    parentTemplateValue[inherit].field++;
                    parentTemplateValue[inherit].line = 0;
                    parentTemplateValue[inherit].value.push('');
                }
                parentTemplateValue[inherit].value[parentTemplateValue[inherit].field] += newTemplate;
                parentTemplateValue[inherit].line++;
            }
        }
        const parentTemplateKeys = Object.keys(parentTemplateValue);
        let currentIndex = 0;

        const sendData = { embeds: [this.createEmbed(parentTemplateValue, parentTemplateKeys[currentIndex], message)] };
        if (parentTemplateKeys.length > 1) sendData.components = this.createComponents(parentTemplateKeys, currentIndex);
        const templateMessage = await message.channel.send(sendData);

        if (parentTemplateKeys.length > 1) {
            const navigationInteractionHandler = new Discord.InteractionCollector(bot, { time: 300000, message: templateMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
            navigationInteractionHandler.on('collect', async interaction => {
                if (interaction.user.id != message.author.id) return;
                if (interaction.customId == 'minus') {
                    currentIndex = currentIndex == 0 ? parentTemplateKeys.length - 1 : currentIndex - 1;
                    await interaction.update({ embeds: [this.createEmbed(parentTemplateValue, parentTemplateKeys[currentIndex], message)], components: this.createComponents(parentTemplateKeys, currentIndex) });
                } else if (interaction.customId == 'plus') {
                    currentIndex = currentIndex == parentTemplateKeys.length - 1 ? 0 : currentIndex + 1;
                    await interaction.update({ embeds: [this.createEmbed(parentTemplateValue, parentTemplateKeys[currentIndex], message)], components: this.createComponents(parentTemplateKeys, currentIndex) });
                }
            });
            navigationInteractionHandler.on('end', async () => {
                await templateMessage.edit({ components: [] });
            });
        }
        await message.react('✅');
    },
    createEmbed(templateValue, inherit, message) {
        const headerMsg = `The dungeons displayed are specific to this channel, ${message.channel} and your staff roles, ${message.member.roles.highest}`;
        const categoryMsg = inherit ? `This page displays all the available templates in the \`${inherit.charAt(0).toUpperCase() + inherit.slice(1)}\` Category.` : '';
        const templateEmbed = createEmbed(message, `${headerMsg}\n\n${categoryMsg}`, null);
        templateEmbed.setColor('#ff0000');
        templateEmbed.setTitle('Available Templates');
        for (let i = 0; i < templateValue[inherit]?.value.length; i++) {
            if (i != 0 && i % 2 == 0) templateEmbed.addFields({ name: '\u200b', value: '\u200b', inline: false });
            templateEmbed.addFields({ name: ' ', value: templateValue[inherit].value[i], inline: true });
        }
        return templateEmbed;
    },
    createComponents(templates, currentIndex) {
        const nextIndex = currentIndex == templates.length - 1 ? 0 : currentIndex + 1;
        const previousIndex = currentIndex == 0 ? templates.length - 1 : currentIndex - 1;
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
        ];
    }
};
