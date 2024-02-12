/* eslint-disable no-unused-vars */
const { Message, Client, Colors, Guild, ButtonInteraction, EmbedBuilder, GuildMember, AutocompleteInteraction,
    CommandInteraction, ModalBuilder, TextInputBuilder, Collection } = require('discord.js');
const { AfkTemplate, resolveTemplateList, resolveTemplateAlias, AfkTemplateValidationError } = require('./afkTemplate.js');
const { slashCommandJSON, slashArg } = require('../utils.js');
const { StringSelectMenuBuilder, ActionRowBuilder, StringSelectMenuOptionBuilder, ButtonBuilder } = require('@discordjs/builders');
const { ApplicationCommandOptionType: SlashArgType, ButtonStyle, ComponentType, TextInputStyle } = require('discord-api-types/v10');
const moment = require('moment/moment.js');
const { createClient } = require('redis');
const { redis: redisConfig } = require('../settings.json');
const { afkCheck: AfkCheck } = require('./afkCheck.js');
const { getDB } = require('../dbSetup.js');

class Headcount {
    /** @type {Collection<string, Headcount>} */
    static cache = new Collection();

    /** @type {Guild} */
    #guild;

    /** @type {Message} */
    #message;

    /** @type {Message} */
    #panel;

    /** @type {import('./afkTemplate.js').AfkTemplate} */
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

    /** @type {{ reason: string, time: number }} */
    #ended;

    /** @type {string} */
    #thumbnail;

    /** @type {NodeJS.Timeout} */
    #timeout;

    /**
     * @typedef EndData
     * @property {string} reason
     * @property {number} time
     */
    /**
     * @typedef HeadcountData
     * @property {string} guildId
     * @property {string} memberId
     * @property {number} startTime
     * @property {number} timeoutDuration
     * @property {AfkTemplate} template
     * @property {string?} thumbnail
     * @property {string?} panelId,
     * @property {string} messageId
     * @property {EndData?} ended
     */

    /**
     * @returns {HeadcountData}
     */
    toJSON() {
        return {
            guildId: this.#guild.id,
            memberId: this.#member.id,
            startTime: this.#startTime,
            timeoutDuration: this.#timeoutDuration,
            template: this.#template.template,
            thumbnail: this.#thumbnail,
            panelId: this.#panel?.id,
            messageId: this.#message.id,
            ended: this.#ended
        };
    }

    /**
     * @param {Guild} guild
     * @param {HeadcountData} json
     * @returns {Promise<Headcount>}
     */
    static async fromJSON(guild, json) {
        const template = new AfkTemplate(guild.client, guild, json.template);
        const { startTime, thumbnail, timeoutDuration, ended } = json;
        const member = guild.members.cache.get(json.memberId);
        const panel = await template.raidCommandChannel.messages.fetch(json.panelId);
        const message = await template.raidStatusChannel.messages.fetch(json.messageId);
        const headcount = new Headcount(member, guild.client, template, timeoutDuration, startTime, thumbnail);
        headcount.#panel = panel;
        headcount.#message = message;
        headcount.#ended = ended;
        return headcount;
    }

    /**
     *
     * @param {GuildMember} member
     * @param {Client} bot
     * @param {AfkTemplate} template
     * @param {number} timeout
     * @param {number?} startTime,
     * @param {string?} thumbnail
     */
    constructor(member, bot, template, timeout, startTime = Date.now(), thumbnail) {
        this.#guild = member.guild;
        this.#member = member;
        this.#bot = bot;
        this.#settings = bot.settings[this.#guild.id];
        this.#template = template;
        this.#timeoutDuration = timeout;
        this.#startTime = startTime;
        this.#thumbnail = thumbnail || template.getRandomThumbnail();
        if (!this.#timeoutDuration) this.#ended = { reason: 'no timer', time: this.#startTime };
    }

    /**
     * @param {string} reason
     */
    async #end(reason) {
        this.#ended = { reason, time: Date.now() };
        await this.update();
        Headcount.#client.hDel('headcounts', this.#panel.id);
        Headcount.cache.delete(this.#panel.id);
    }

    /**
     * @param {CommandInteraction} interaction
     */
    async start(interaction) {
        this.#message = await this.#template.raidStatusChannel.send(this.#statusData);

        for (const emoji of this.#template.headcountEmoji()) {
            // eslint-disable-next-line no-await-in-loop
            await this.#message.react(emoji.id);
        }

        if (this.#timeoutDuration) {
            this.#panel = await interaction.editReply(this.#panelData());
            await this.#createHeadcountRow();
            Headcount.cache.set(this.#panel.id, this);
        } else {
            const embed = new EmbedBuilder()
                .setTitle(`${this.#runName}`)
                .setDescription(`Headcount for ${this.#runName} at ${this.#message.url}`)
                .setFooter(this.#footerData)
                .setTimestamp(Date.now());

            if (this.#thumbnail) embed.setThumbnail(this.#thumbnail);
            await interaction.editReply({ embeds: [embed], components: [] });
        }

        this.#beginTimers();
    }

    /** @returns {number} */
    get #endTime() {
        if (!this.#timeoutDuration) return this.#startTime;
        if (this.#ended) return this.#ended.time;
        return this.#startTime + this.#timeoutDuration;
    }

    get durationUntilTimeout() { return moment.duration(moment(this.#endTime).diff(Date.now())).humanize(true); }

    get discordTimestamp() { return `<t:${(this.#endTime / 1000).toFixed(0)}:R>`; }

    get #runName() { return `${this.#member.displayName}'s ${this.#template.templateName}`; }

    /**
     * @returns {import('discord.js').EmbedFooterOptions}
     */
    get #footerData() {
        if (!this.#timeoutDuration) return { text: `${this.#runName}`, iconURL: this.#guild.iconURL() };
        if (this.#ended) return { text: `${this.#runName} ${this.#ended.reason}`, iconURL: this.#guild.iconURL() };
        return { text: `${this.#runName} headcount ends ${this.durationUntilTimeout} at`, iconURL: this.#guild.iconURL() };
    }

    /** @returns {import('discord.js').MessagePayloadOption} */
    get #statusData() {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Headcount for ${this.#template.name} by ${this.#member.displayName}`, iconURL: this.#member.displayAvatarURL() })
            .setDescription(this.#template.processBodyHeadcount(null))
            .setColor(this.#template.body[1].embed.color || Colors.White)
            .setImage(this.#settings.strings[this.#template.body[1].embed.image] || this.#template.body[1].embed.image)
            .setFooter(this.#footerData)
            .setTimestamp(this.#timeoutDuration ? this.#endTime : this.#startTime);

        if (this.#thumbnail) embed.setThumbnail(this.#thumbnail);

        const data = { embeds: [embed] };
        if (this.#template.pingRoles) data.content = this.#template.pingRoles.join(' ');
        return data;
    }

    /** @returns {ActionRowBuilder<ButtonBuilder>[]} */
    get #panelComponents() {
        if (this.#ended) return [];

        const convert = new ButtonBuilder()
            .setCustomId('convert')
            .setLabel('Convert to AFK')
            .setStyle(ButtonStyle.Success);

        const abort = new ButtonBuilder()
            .setCustomId('abort')
            .setLabel('Abort')
            .setStyle(ButtonStyle.Danger);

        const components = new ActionRowBuilder();
        components.addComponents(convert, abort);
        return [components];
    }

    /**
     * @param {AfkCheck} afkModule
     * @returns {import('discord.js').MessagePayloadOption}
     */
    #panelData(afkModule) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Headcount for ${this.#template.name} by ${this.#member.displayName}`, iconURL: this.#member.displayAvatarURL() })
            .setDescription(`**Raid Leader: ${this.#member} \`${this.#member.displayName}\`**`)
            .setColor(this.#template.body[1].embed.color || Colors.White)
            .setFooter(this.#footerData)
            .setTimestamp(this.#endTime);

        const reacts = Object.values(this.#template.buttons).map(button => {
            if (!button.emote) return;
            const emote = this.#bot.emojis.cache.get(this.#bot.storedEmojis[button.emote].id);

            const reactors = this.#message.reactions.cache.get(emote.id)?.users.cache;
            if (!reactors) return;
            const members = reactors.map(r => r).filter(r => r.id != this.#bot.user.id).slice(0, 3);
            if (reactors.size > 4) members.push(`+${reactors.cache.size - 4} others`);
            return { name: `${emote} ${button.name} ${emote}`, value: members.join('\n') || 'None!', inline: true };
        }).filter(field => field);

        embed.addFields(reacts);

        if (afkModule) {
            embed.addFields({ name: '\u000B', value: '\u000B' },
                { name: 'Raid Commands Panel', value: afkModule.raidCommandsMessage?.url || 'Could not find', inline: true },
                { name: 'Raid Status Message', value: afkModule.raidStatusMessage?.url || 'Could not find', inline: true },
                { name: 'Voice Channel', value: `${afkModule.channel || 'VC-Less'}`, inline: true });
        }
        return { embeds: [embed], components: this.#panelComponents };
    }

    /**
     * @param {AfkCheck} afkModule
     */
    async update(afkModule) {
        await Promise.all([this.#message.edit(this.#statusData), this.#panel.edit(this.#panelData(afkModule))]);
    }

    /**
     * @param {ButtonInteraction} interaction
     * @returns {Promise<string>}
     */
    async #queryLocation(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('locationModal')
            .setTitle('Enter Location');

        const input = new TextInputBuilder()
            .setCustomId('location')
            .setLabel('What location is the run at?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('None');

        modal.addComponents(new ActionRowBuilder().addComponents(input));

        interaction.showModal(modal);
        return await interaction.awaitModalSubmit({ filter: i => i.customId == 'locationModal', time: 30_000 })
            .then(response => {
                response.deferUpdate();
                return response.fields.getField('location').value || 'None';
            })
            .catch(() => 'None');
    }

    /**
     * @param {ButtonInteraction} interaction
     */
    async #convert(interaction) {
        await this.#end('converted to afk');

        const location = await this.#queryLocation(interaction);

        const afkModule = new AfkCheck(this.#template, this.#bot, getDB(this.#guild.id), this.#panel, location, this.#member);
        await afkModule.createChannel();
        await afkModule.sendButtonChoices();
        await afkModule.sendInitialStatusMessage(this.#message);
        if (this.#template.startDelay > 0) await require('node:timers/promises').setTimeout(this.#template.startDelay * 1000);
        await afkModule.start(this.#panel);

        await this.update(afkModule);
    }

    async #abort() {
        await this.#end('aborted');
    }

    async #processTick() {
        if (this.#ended) return;

        if (Date.now() >= this.#endTime) {
            return await this.#end('timed out');
        }

        await this.update();
        this.#timeout?.refresh();
    }

    async #beginTimers() {
        if (this.#ended) return;
        await this.#processTick();
        this.#timeout = setTimeout(() => this.#processTick(), 6_000);
        this.#timeout.unref();
    }

    /** @type {ReturnType<createClient(redisConfig)>} */
    static #client;

    /**
     * @param {Client} bot
     */
    static async initialize(bot) {
        const client = createClient(redisConfig);
        client.on('error', err => console.log('Redis Client Error in Headcount: ', err));
        await client.connect();
        Headcount.#client = client;

        const now = Date.now();
        for await (const { value } of client.hScanIterator('headcounts')) {
            const data = JSON.parse(value);
            const headcount = await Headcount.fromJSON(bot.guilds.cache.get(data.guildId), data);
            Headcount.cache.set(headcount.#panel.id, headcount);
            await headcount.#beginTimers();
        }

        const grouped = Headcount.cache.reduce((acc, hc) => { (acc[hc.#guild.name] = acc[hc.#guild.name] || []).push(hc); return acc; }, {});
        // eslint-disable-next-line guard-for-in
        for (const guild in grouped) console.log(`${grouped[guild].length} headcounts initialized for ${guild}`);
    }

    async #createHeadcountRow() {
        await Headcount.#client.hSet('headcounts', this.#panel.id, JSON.stringify(this.toJSON()));
    }

    /**
     * @param {Client} bot
     * @param {ButtonInteraction} interaction
     * @returns {boolean}
     */
    static async handleHeadcountRow(interaction) {
        const headcount = Headcount.cache.get(interaction.message.id);
        if (!headcount) return false;

        switch (interaction.customId) {
            case 'convert': await headcount.#convert(interaction); break;
            case 'abort': await headcount.#abort(); break;
            default: return false;
        }
        return true;
    }

    /**
     * @param {ButtonInteraction} interaction
     * @param {import('./afkTemplate.js').AfkTemplate} template
     * @returns {Promise<boolean>}
     */
    static async confirmShouldSend(interaction, template) {
        if (Headcount.cache.size == 0) return true;
        const { member } = interaction;

        const issues = [];

        const inChannel = Headcount.cache.map(hc => hc).filter(hc => hc.#message.channel.id == template.raidStatusChannel.id);
        if (inChannel.length >= 2) issues.push({ name: 'Multiple Headcounts', value: `There are already \`${inChannel.length}\` headcounts in ${template.raidStatusChannel.url}.` });

        const matches = inChannel.filter(hc => hc.#template.templateID == template.templateID);
        if (matches.length) {
            const matchList = matches.map(hc => `${hc.#message.url} - ${hc.#member.displayName}'s ${hc.#template.templateName} ${hc.discordTimestamp}`).join('\n');
            issues.push({ name: `Same Template (${matches.length})`, value: `There are headcount(s) already for \`${template.templateName}\` in ${template.raidStatusChannel.url}:\n${matchList}` });
        }

        const selfInGuild = Headcount.cache.map(hc => hc).filter(hc => hc.#guild.id == member.guild.id && hc.#member.id == member.id);
        if (selfInGuild.length) {
            const matchList = selfInGuild.map(hc => `${hc.#message.url} - ${hc.#template.templateName} ${hc.discordTimestamp}`).join('\n');
            issues.push({ name: `Own Headcounts (${selfInGuild.length})`, value: `You already have headcounts active in \`${member.guild.name}\`:\n${matchList}` });
        }

        if (!issues.length) return true;

        const embed = new EmbedBuilder()
            .setTitle('Confirm Starting Headcount')
            .setAuthor({ name: `${member.displayName}'s ${template.templateName}`, iconURL: member.displayAvatarURL() })
            .setDescription('Are you sure you want to send another headcount?')
            .setColor(template.body[0].embed.color || Colors.Blue)
            .setFields(issues);

        const confirmMessage = await interaction.editReply({ embeds: [embed] });
        const result = await confirmMessage.confirmButton(member.id).catch(() => false);
        if (!result) {
            embed.setDescription('Cancelled sending headcount')
                .setTitle('Headcount Cancelled')
                .setColor(Colors.Red);
            await interaction.editReply({ embeds: [embed], components: [] });
        }
        return result;
    }
}

/**
 * @param {string} str
 * @returns {'Seconds' | 'Minutes' | 'Hours'}
 */
function processDuration(str) {
    switch (str[0].toLowerCase()) {
        case 's': return 'Seconds';
        case 'm': return 'Minutes';
        case 'h': return 'Hours';
        default:
    }
}

/**
 * @param {Message | CommandInteraction} interaction
 * @returns {number}
 */
function processTime(interaction) {
    const length = interaction.options.getInteger('length');
    if (!length) return 0;

    const duration = processDuration(interaction.options.getString('duration') || 'Minutes');

    switch (duration) {
        case 'Seconds': return length * 1_000;
        case 'Minutes': return length * 60_000;
        case 'Hours': return length * 3_600_000;
        default: return 0;
    }
}

/**
 * @param {ButtonInteraction} interaction
 * @param {EmbedBuilder} embed
 * @param {string[]} templates
 * @returns {string}
 */
async function selectTemplateOption(interaction, embed, templates, search) {
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
        .setLabel('Cancel');

    menu.addOptions(cancelOption);

    const response = await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });

    const result = await response.awaitMessageComponent({ componentType: ComponentType.StringSelect, filter: i => i.member.id == interaction.member.id, time: 30_000 })
        .then(result => {
            result.deferUpdate();
            return result.values[0];
        })
        .catch(() => 'cancel');
    return result;
}

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
                if (!search) return interaction.respond(['Seconds', 'Minutes', 'Hours'].map(r => ({ name: r, value: r })));
                const value = processDuration(search);
                interaction.respond([{ name: value, value }]);
                break;
            }
            default:
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

        const timeoutDuration = processTime(interaction);
        const embed = new EmbedBuilder()
            .setTitle('Headcount')
            .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
            .setColor(Colors.Blue)
            .setDescription('Please hold...');

        await interaction.reply({ embeds: [embed] });

        let afkTemplate = await AfkTemplate.tryCreate(bot, settings, interaction, search);

        // if text command or 'type' not given a full name (autocomplete does not limit input)
        if (!afkTemplate.templateName) {
            const embed = new EmbedBuilder()
                .setTitle('Headcount')
                .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
                .setColor(Colors.Blue);
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
                    return interaction.editReply({ embeds: [embed] });
                }

                const result = await selectTemplateOption(interaction, embed, templates, search);
                if (result === 'cancel') return;

                afkTemplate = await AfkTemplate.tryCreate(bot, settings, interaction, result);
            }

            if (afkTemplate instanceof AfkTemplateValidationError) {
                embed.setColor(Colors.Red)
                    .setDescription('There was an issue processing the template.')
                    .addFields({ name: 'Error', value: afkTemplate.message() });
                return interaction.editReply({ embeds: [embed] });
            }
        }

        if (!await Headcount.confirmShouldSend(interaction, afkTemplate)) return;

        const hc = new Headcount(member, bot, afkTemplate, timeoutDuration);
        await hc.start(interaction);
    },

    async initialize(bot) { await Headcount.initialize(bot); },

    async handleHeadcountRow(bot, interaction) { return await Headcount.handleHeadcountRow(bot, interaction); },

    Headcount
};
