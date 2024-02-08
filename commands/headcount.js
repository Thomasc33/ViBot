/* eslint-disable guard-for-in */
const { EmbedBuilder, Colors, ActionRowBuilder, ComponentType } = require('discord.js');
const { TemplateButtonType, AfkTemplate, resolveTemplateList, resolveTemplateAlias, AfkTemplateValidationError } = require('./afkTemplate.js');
const { slashCommandJSON, slashArg } = require('../utils.js');
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('@discordjs/builders');
const { ApplicationCommandOptionType: SlashArgType } = require('discord-api-types/v10');

class Headcount {
    /** @type {Message | CommandInteraction} */
    #interaction;

    /** @type {Message} */
    #message;

    /** @type {Message} */
    #panel;

    /** @type {AfkTemplate} */
    #template;

    /** @type {GuildMember} */
    #member;

    /** @type {Client} */
    #bot;

    /** @type {import('../data/guildSettings.708026927721480254.cache.json')} */
    #settings;

    /** @type {number} */
    #timeoutDuration;

    /** @type {Date} */
    #startTime;

    /** @type {boolean} */
    #ended;

    /** @type {string} */
    #cancelledReason;

    /** @type {string} */
    #currentThumbnail;

    /**
     *
     * @param {Messsage | CommandInteraction} interaction
     * @param {GuildMember} member
     * @param {Client} bot
     * @param {string} templateName
     * @param {AfkTemplate} template
     * @param {Message} panel
     * @param {number} timeout
     */
    constructor(interaction, member, bot, template, panel, timeout) {
        this.#interaction = interaction;
        this.#member = member;
        this.#bot = bot;
        this.#settings = bot.settings[this.#interaction.guild.id];
        this.#template = template;
        this.#timeoutDuration = timeout;
        this.#panel = panel;
        this.#startTime = Date.now();
        this.#currentThumbnail = this.#template.getRandomThumbnail();

        this.#init();
    }

    async #init() {
        this.#message = await this.#template.raidStatusChannel.send(this.#statusData);

        for (const reactName in this.#template.reacts) {
            const react = this.#template.reacts[reactName];
            // eslint-disable-next-line no-await-in-loop
            if (react.onHeadcount && react.emote) await this.#message.react(react.emote.id);
        }

        for (const keyName in this.#template.buttons) {
            const button = this.#template.buttons[keyName];
            switch (button.type) {
                case TemplateButtonType.NORMAL:
                case TemplateButtonType.LOG:
                case TemplateButtonType.LOG_SINGLE:
                    // eslint-disable-next-line no-await-in-loop
                    if (this.#bot.storedEmojis[button.emote]) await this.#message.react(this.#bot.storedEmojis[button.emote].id);
                    break;
                default:
            }
        }
    }

    get #endTime() { return this.#startTime + this.#timeoutDuration; }

    /**
     * @returns {import('discord.js').EmbedFooterOptions}
     */
    get #footerData() {
        if (!this.#timeoutDuration) return { text: this.#interaction.guild.name, iconURL: this.#interaction.guild.iconURL() };
        return { text: this.#ended ? this.#cancelledReason : `${this.#template.templateName} active until`, iconURL: this.#interaction.guild.iconURL() };
    }

    get #statusData() {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Headcount for ${this.#template.name} by ${this.#member.displayName}`, iconURL: this.#member.displayAvatarURL() })
            .setDescription(this.#template.processBodyHeadcount(null))
            .setColor(this.#template.body[1].embed.color || 'White')
            .setImage(this.#settings.strings[this.#template.body[1].embed.image] || this.#template.body[1].embed.image)
            .setFooter({ text: this.#interaction.guild.name, iconURL: this.#interaction.guild.iconURL() })
            .setTimestamp(this.#endTime);

        if (this.#currentThumbnail) embed.setThumbnail(this.#currentThumbnail);

        if (this.#timeoutDuration && Date.now() < this.#endTime) {
            embed.addFields({ name: '\u200B', value: `*This headcount will timeout <t:${(this.#endTime / 1000).toFixed(0)}:R>*`});
        }

        const data = { embeds: [embed] };
        if (this.#template.pingRoles) data.content = this.#template.pingRoles.join(' ');
        return data;
    }

    get #panelData() {
        const embed = new EmbedBuilder()
            .setAuthor({ name: this.#member.displayName, iconURL: this.#member.displayAvatarURL() })
            .setColor(this.#template.body[1].embed.color || 'White');
        return embed;
    }
}

/**
 * @typedef {{
*  emote: string,
*  onHeadcount: boolean,
*  start: number,
*  lifetime: number
* }} ReactData
*
* @typedef {{
*  reacts: Record<string, ReactData>,
*  aliases: string[],
*  templateName: string,
*  sectionNames: string[]
* }} Template
*/

module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    role: 'eventrl',
    args: [
        slashArg(SlashArgType.String, 'type', {
            description: 'Type of run to put a headcount for',
            autocomplete: true
        }),
        slashArg(SlashArgType.Integer, 'length', {
            description: 'Length of chosen duration until headcount times out',
            required: false
        }),
        slashArg(SlashArgType.String, 'duration', {
            description: 'Timespan of the duration for headcount timeout',
            required: false,
            autocomplete: true
        })
    ],
    requiredArgs: 1,
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },

    /**
     * @param {AutocompleteInteraction} interaction
     */
    async autocomplete(interaction) {
        const settings = interaction.client.settings[interaction.guild.id];
        const option = interaction.options.getFocused(true);
        const search = option.value.trim().toLowerCase();
        switch (option.name) {
            case 'type': {
                const templates = await resolveTemplateList(settings, interaction.member, interaction.guild.id, interaction.channel.id);
                const results = templates.map(({ templateName, aliases }) => ({ name: templateName, value: templateName, aliases }))
                    .filter(({ name, aliases }) => name.toLowerCase().includes(search) || aliases.some(alias => alias.toLowerCase().includes(search)));
                interaction.respond(results.slice(0, 25));
                break;
            }
            case 'duration': {
                if (search.startsWith('s')) interaction.respond(['Seconds']);
                else if (search.startsWith('m')) interaction.respond(['Minutes']);
                else if (search.startsWith('h')) interaction.respond(['Hours']);
                else if (search.startsWith('d')) interaction.respond(['Days']);
                break;
            }
            default:
        }
    },

    /**
     * @param {Message | CommandInteraction} interaction
     */
    async processTime(interaction) {
        const length = interaction.options.getInteger('length');
        if (!length) return 0;

        const duration = interaction.options.getString('duration') || 'Minutes';

        switch (duration) {
            case 'Seconds': return length * 1_000;
            case 'Minutes': return length * 60_000;
            case 'Hours': return length * 3_600_000;
            case 'Days': return length * 86_400_000;
            default: return 0;
        }
    },

    /**
     *
     * @param {Message | CommandInteraction} interaction
     * @param {string[]} args
     * @param {Client} bot
     */
    async execute(interaction, args, bot) {
        const settings = bot.settings[interaction.guild.id];
        const search = interaction.options.getString('type');
        const { member, guild, channel } = interaction;

        const timeoutDuration = this.processTime(interaction);

        const embed = new EmbedBuilder()
            .setTitle('Headcount')
            .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
            .setColor(Colors.Blue);

        let afkTemplate = await AfkTemplate.tryCreate(bot, settings, interaction, search);

        // if text command or 'type' not given a full name (autocomplete does not limit input)
        if (!afkTemplate.templateName) {
            const aliasResult = await resolveTemplateAlias(settings, member, guild.id, channel.id, search);
            // A single template name returned matching alias, use this
            if (aliasResult.length == 1) afkTemplate = await AfkTemplate.tryCreate(bot, settings, interaction, aliasResult[0]);
            else {
                // if there are multiple aliases, select from them
                // otherwise filter out all available templates and use those
                const templates = aliasResult.length > 1 ? aliasResult
                    : await resolveTemplateList(settings, member, guild.id, channel.id)
                        .then(results => results.filter(({ templateName, aliases }) => templateName.toLowerCase().includes(search) || aliases.some(alias => alias.toLowerCase().includes(search))))
                        .then(results => results.map(t => t.templateName));

                // no templates matching search for channel
                if (!templates.length) {
                    embed.setColor(Colors.Red)
                        .setDescription(`No templates matched \`${search}\`. Try using the \`templates\` command to see which templates are available to you in ${channel}.`);
                    return interaction.reply({ embeds: [embed] });
                }

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('selection')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .setPlaceholder('Select a run type...');

                embed.setDescription('Multiple run types matched your search, please select one from the list below.');

                if (templates.length > 24) {
                    embed.setDescription(embed.data.description + `\n\nThere are ${templates.length} templates matching \`${search}\` but only 24 can be listed.\nIf the run you want is not listed, please use a less broad search.`);
                }

                for (const template of templates) {
                    const option = new StringSelectMenuOptionBuilder()
                        .setValue(template)
                        .setLabel(template);

                    menu.addOptions(option);
                }

                const cancelOption = new StringSelectMenuOptionBuilder()
                    .setValue('cancel')
                    .setLabel('Cancel')
                    .setEmoji('�');

                menu.addOptions(cancelOption);

                const response = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });

                const result = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, filter: i => i.member.id == member.id, time: 30_000 })
                    .then(result => result.values[0])
                    .catch(() => 'cancel');

                if (response.deletable) response.delete();

                if (result === 'cancel') return;

                afkTemplate = await AfkTemplate.tryCreate(bot, settings, interaction, result);
            }

            if (afkTemplate instanceof AfkTemplateValidationError) {
                embed.setColor(Colors.Red)
                    .setDescription('There was an issue processing the template.')
                    .addFields({ name: 'Error', value: afkTemplate.message() });
                return interaction.reply({ embeds: [embed] });
            }
        }

        embed.setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
            .setColor(afkTemplate.body[0].color);

        const hc = new Headcount(interaction, member, bot, afkTemplate);
    }
};
