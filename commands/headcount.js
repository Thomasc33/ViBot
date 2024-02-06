const { Message, CommandInteraction, GuildMember, Client, EmbedBuilder, AutocompleteInteraction } = require('discord.js')
const { AfkTemplate, resolveTemplateList } = require('./afkTemplate.js');
const { createEmbed } = require('../lib/extensions.js');
const { slashCommandJSON, slashArg } = require('../utils.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;

class Headcount {
    /** @type {Message | CommandInteraction} */
    #interaction;

    /** @type {Message} */
    #message;

    /** @type {AfkTemplate} */
    #template;

    /** @type {GuildMember} */
    #member;

    /** @type {Client} */
    #bot;

    /** @type {import('../data/guildSettings.708026927721480254.cache.json')} */
    #settings;

    /**
     * 
     * @param {Messsage | CommandInteraction} interaction 
     * @param {GuildMember} member 
     * @param {Client} bot 
     * @param {string} templateName 
     * @param {AfkTemplate} template 
     */
    constructor(interaction, member, bot, template) {
        this.#interaction = interaction;
        this.#member = member;
        this.#bot = bot;
        this.#settings = bot.settings[this.#interaction.guild.id];
        this.#template = template;

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
                case AfkTemplate.TemplateButtonType.NORMAL:
                case AfkTemplate.TemplateButtonType.LOG:
                case AfkTemplate.TemplateButtonType.LOG_SINGLE:
                    const emote = this.bot.storedEmojis[button.emote];
                    // eslint-disable-next-line no-await-in-loop
                    if (emote) await this.#message.react(emote.id);
                default:
            }
        }
    }

    get #statusData() {
        const embed = new EmbedBuilder()
            .setAuthor({ name: `Headcount for ${this.#template.name} by ${this.#member.displayName}`, iconURL: this.#member.displayAvatarURL() })
            .setDescription(this.#template.processBodyHeadcount(null))
            .setColor(this.#template.body[1].embed.color || 'White')
            .setImage(this.#settings.strings[this.#template.body[1].embed.image] || this.#template.body[1].embed.image)
            .setFooter({ text: this.#interaction.guild.name, iconURL: this.#interaction.guild.iconURL() })
            .setTimestamp(Date.now());
        const thumbnail = this.#template.getRandomThumbnail();
        if (thumbnail) embed.setThumbnail(thumbnail);
        const data = { embeds: [embed] };
        if (this.#template.pingRoles) data.content = this.#template.pingRoles.join(' ');
        return data;
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
        })
    ],
    requiredArgs: 1,
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },

    /** 
     * @param {AutocompleteInteraction} interaction 
     */
    async autocomplete(interaction) {
        const settings = interaction.client.settings[interaction.guild.id];
        const search = interaction.options.getFocused().trim().toLowerCase();

        /** @type {Template[]} */
        const templates = await resolveTemplateList(settings, interaction.member, interaction.guild.id, interaction.channel.id);

        const results = templates.map(({ templateName, aliases }) => ({ name: templateName, value: templateName, aliases }))
            .filter(({ name, aliases }) => name.toLowerCase().includes(search) || aliases.some(alias => alias.toLowerCase().includes(search)))

        interaction.respond(results.slice(0, 25))
    },

    /**
     * 
     * @param {Message | CommandInteraction} interaction 
     * @param {string[]} args 
     * @param {Client} bot 
     */
    async execute(interaction, args, bot) {
        const templateName = interaction.options.getString('type');
        interaction.reply({ content: templateName, ephemeral: true })
    }
}
/*
module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    requiredArgs: 1,
    args: '<run type> (time) (time type s/m)',
    role: 'eventrl',
    async execute(message, args, bot) {
        //settings
        const botSettings = bot.settings[message.guild.id]
        let alias = args.shift().toLowerCase()
        let time = 0
        if (args.length >= 2) {
            time = parseInt(args.shift())
            switch (args.shift().toLowerCase()) {
                case 's': 
                    break
                case 'm': 
                    time *= 60
                    break
                default: 
                    return message.channel.send("Please enter a valid time type __**s**__econd, __**m**__inute)")
            }
        }

        const afkTemplateNames = await AfkTemplate.resolveTemplateAlias(botSettings, message.member, message.guild.id, message.channel.id, alias)
        if (afkTemplateNames instanceof AfkTemplate.AfkTemplateValidationError) return await message.channel.send(afkTemplateNames.message())
        if (afkTemplateNames.length == 0) return await message.channel.send('This afk template does not exist.')

        const afkTemplateName = afkTemplateNames.length == 1 ? afkTemplateNames[0] : await AfkTemplate.templateNamePrompt(message, afkTemplateNames)
        const afkTemplate = await AfkTemplate.AfkTemplate.tryCreate(bot, bot.settings[message.guild.id], message, afkTemplateName)
        if (afkTemplate instanceof AfkTemplate.AfkTemplateValidationError) {
            await message.channel.send(afkTemplate.message())
            return
        }

        if (!afkTemplate.minimumStaffRoles.some(roles => roles.every(role => message.member.roles.cache.has(role.id)))) return await message.channel.send({ embeds: [createEmbed(message, `You do not have a suitable set of roles out of ${afkTemplate.minimumStaffRoles.reduce((a, b) => `${a}, ${b.join(' + ')}`)} to run ${afkTemplate.name}.`, null)] })
        const body = afkTemplate.processBody()
        const raidStatusEmbed = createEmbed(message, afkTemplate.processBodyHeadcount(null), botSettings.strings[body[1].embed.image] ? botSettings.strings[body[1].embed.image] : body[1].embed.image)
        raidStatusEmbed.setColor(body[1].embed.color ? body[1].embed.color : '#ffffff')
        raidStatusEmbed.setAuthor({ name: `Headcount for ${afkTemplate.name} by ${message.member.nickname}`, iconURL: message.member.user.avatarURL() })
        if (time != 0) {
            raidStatusEmbed.setFooter({ text: `${message.guild.name} • ${Math.floor(time / 60)} Minutes and ${time % 60} Seconds Remaining`, iconURL: message.guild.iconURL() })
            raidStatusEmbed.setDescription(`**Abort <t:${Math.floor(Date.now()/1000)+time}:R>**\n${raidStatusEmbed.data.description}`)
        }
        if (body[1].embed.thumbnail) raidStatusEmbed.setThumbnail(body[1].embed.thumbnail[Math.floor(Math.random()*body[1].embed.thumbnail.length)])
        const raidStatusMessage = await afkTemplate.raidStatusChannel.send({ content: `${afkTemplate.pingRoles ? afkTemplate.pingRoles.join(' ') : ''}`, embeds: [raidStatusEmbed] })
        for (let i in afkTemplate.reacts) {
            if (afkTemplate.reacts[i].onHeadcount && afkTemplate.reacts[i].emote) await raidStatusMessage.react(afkTemplate.reacts[i].emote.id)
        }
        const buttons = afkTemplate.processButtons()
        for (let i in buttons) {
            if ((buttons[i].type == AfkTemplate.TemplateButtonType.NORMAL || buttons[i].type == AfkTemplate.TemplateButtonType.LOG || buttons[i].type == AfkTemplate.TemplateButtonType.LOG_SINGLE) && buttons[i].emote) await raidStatusMessage.react(buttons[i].emote.id)
        }

        function updateHeadcount() {
            time -= 5
            if (time <= 0) {
                clearInterval(this)
                raidStatusEmbed.setImage(null)
                raidStatusEmbed.setDescription(`This headcount has been aborted`)
                raidStatusEmbed.setFooter({ text: `${message.guild.name} • Aborted`, iconURL: message.guild.iconURL() })
                raidStatusMessage.edit({ embeds: [raidStatusEmbed] })
                return
            }
            raidStatusEmbed.setFooter({ text: `${message.guild.name} • ${Math.floor(time / 60)} Minutes and ${time % 60} Seconds Remaining`, iconURL: message.guild.iconURL() })
            raidStatusMessage.edit({ embeds: [raidStatusEmbed] })
        }
        if (time != 0) setInterval(() => updateHeadcount(), 5000)
        message.react('✅')
    }
}
*/