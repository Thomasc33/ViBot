const fs = require('fs')
const Discord = require('discord.js')
const settings = require('../settings.json')
const { createEmbed, getRoleStrings } = require('../lib/extensions.js')

// Enum for the Error States in a Template
const TemplateState = { 
    'SUCCESS': 0,
    'NOT_EXIST': 1,
    'MISSING_PARAMETERS' : 2,
    'DISABLED' : 3,
    'INVALID_GUILD' : 4,
    'INVALID_CATEGORY': 5,
    'INVALID_CHANNEL': 6,
    'INVALID_ROLE': 7,
    'INVALID_POINTS': 8,
    'INVALID_IMAGE': 9,
    'INVALID_STRING': 10,
    'INVALID_NUMBER': 11,
    'INVALID_OBJECT': 12,
    'INVALID_EMOTE': 13,
    'INVALID_BOOLEAN': 14
}

// Enum for the VC Options in an AFK Template
const TemplateVCOptions = {
    'NO_VC': 0,
    'STATIC_VC': 1,
    'CREATE_VC' : 2
}

// Enum for the VC States in an AFK Template
const TemplateVCState = {
    'LOCKED': 0,
    'OPEN': 1
}

// Enum for the Button Types in an AFK Template
const TemplateButtonType = {
    'NORMAL': 0,
    'LOG': 1,
    'SUPPORTER': 2,
    'POINTS': 3,
    'DRAG': 4,
    'OPTION': 5,
    'LOG_SINGLE': 6,
}

// Enum for the Choice on Buttons in an AFK Template
const TemplateButtonChoice = {
    'NO_CHOICE': 0,
    'YES_NO_CHOICE': 1,
    'NUMBER_CHOICE_PRESET' : 2,
    'NUMBER_CHOICE_CUSTOM' : 3
}

async function resolveTemplateAlias(botSettings, member, guildId, commandChannel, alias) {
    const templateUrl = new URL(settings.config.url)
    templateUrl.pathname = `/api/${guildId}/template/${commandChannel}/alias/${alias}`
    templateUrl.searchParams.append('roles', getRoleStrings(botSettings, member).join(','))
    templateUrl.searchParams.append('key', settings.config.key)
    const templateNames = await fetch(templateUrl).then(f => f.json())
    console.log(templateNames)
    return templateNames
}

async function templateNamePrompt(message, templateNames) {
    const templateMenu = new Discord.StringSelectMenuBuilder() // If multiple found, give option to choose AFK Template
        .setCustomId(`template`)
        .setPlaceholder(`Name of Afk`)
        .setMinValues(1)
        .setMaxValues(1)
    for (const templateName of templateNames) templateMenu.addOptions({ label: templateName, value: templateName })
    const text = `Which template would you like to use for this run?.\n If no response is received, this run will use the default ${templateNames[0]}.`
    const {value: templateValue, interaction: subInteraction} = await message.selectPanel(text, null, templateMenu, 30000, false, true)
    return templateValue || templateNames[0]
}

class AfkTemplateValidationError extends Error {
    #error_type;
    #message;

    constructor(type, message, ...params) {
        super(...params)
        this.name = this.constructor.name
        this.#error_type = type
        this.#message = message
    }

    message() {
        return this.#message
    }

    invalidChannel() {
        return this.#error_type == TemplateState.INVALID_CHANNEL
    }
}

// Class for Finding, Checking, Loading and Processing Information in an AFK Template
class AfkTemplate {
    #template;
    #bot;
    #botSettings;
    #guild;
    #inherit;
    #templateName;

    /** Constructor for the AFK Template Class
     * @param {Discord.Client} bot The client which is running the bot
     * @param {Object} botSettings The object holding the settings of the bot
     * @param {Discord.Message} message The discord message in which the command was executed
     * @param {String} alias The string used to identify the AFK Template
     */
    constructor(bot, guild, template) {
        this.#bot = bot
        this.#botSettings = bot.settings[guild.id]
        this.#guild = guild
        this.#inherit = null
        this.#template = template
        this.#templateName = template.templateName

        // Validate that the template is OK to use
        this.#validateTemplateParameters() // Validate existence of AFK Template parameters
        if (!this.#template.enabled) throw new AfkTemplateValidationError(TemplateState.DISABLED, `This afk template is disabled.`)
        this.#validateTemplateValues() // Validate values of AFK Template parameters

        // Populate all parameters used in AfkCheck
        this.#processParameters()
        this.#processReacts()
    }

    // TODO: Need to be able to skip permission checks on reload
    static async tryCreate(bot, botSettings, message, templateName) {
        const templateUrl = new URL(settings.config.url)
        templateUrl.pathname = `/api/${message.guild.id}/template/${message.channel.id}/template/${templateName}`
        templateUrl.searchParams.append('roles', getRoleStrings(botSettings, message.member).join(','))
        templateUrl.searchParams.append('key', settings.config.key)
        const template = await fetch(templateUrl).then(f => f.json())
        return new this(bot, message.guild, template)
    }

    get templateName() {
        return this.#templateName
    }

    // Function for populating child AFK Template parameters in an object from Parent AFK Template object
    #populateObjectInherit(template, parentTemplate) {
        for (let i in parentTemplate) {
            if (template[i] == undefined || template[i] == null) template[i] = parentTemplate[i]
            else if (typeof template[i] == "object" && template[i] != null && typeof parentTemplate[i] == "object" && parentTemplate[i] != null) {
                if (Array.isArray(template[i])) continue
                else template[i] = Object.assign({}, parentTemplate[i], template[i])
                this.#populateObjectInherit(template[i], parentTemplate[i])
            }
        }
    }

    // Function for validating the existence of AFK Template parameters
    #validateTemplateParameters() {
        let properties = []
        if (!Object.hasOwn(this.#template, 'category')) properties.push('category')
        if (!Object.hasOwn(this.#template, 'templateChannel')) properties.push('templateChannel')
        if (!Object.hasOwn(this.#template, 'partneredStatusChannels')) properties.push('partneredStatusChannels')
        if (this.#template.partneredStatusChannels != null && typeof this.#template.partneredStatusChannels === 'object') {
            for (let i in this.#template.partneredStatusChannels) {
                if (!Object.hasOwn(this.#template.partneredStatusChannels[i], 'channels')) properties.push(`partneredStatusChannels.${i}channel`)
            }
        }
        if (!Object.hasOwn(this.#template, 'statusChannel')) properties.push('statusChannel')
        if (!Object.hasOwn(this.#template, 'activeChannel')) properties.push('activeChannel')
        if (!Object.hasOwn(this.#template, 'enabled')) properties.push('enabled')
        if (!Object.hasOwn(this.#template, 'minStaffRoles')) properties.push('minStaffRoles')
        if (!Object.hasOwn(this.#template, 'minViewRaiderRoles')) properties.push('minViewRaiderRoles')
        if (!Object.hasOwn(this.#template, 'minJoinRaiderRoles')) properties.push('minJoinRaiderRoles')
        if (!Object.hasOwn(this.#template, 'name')) properties.push('name')
        if (!Object.hasOwn(this.#template, 'pingRoles')) properties.push('pingRoles')
        if (!Object.hasOwn(this.#template, 'logName')) properties.push('logName')
        if (!Object.hasOwn(this.#template, 'vcOptions')) properties.push('vcOptions')
        if (!Object.hasOwn(this.#template, 'cap')) properties.push('cap')
        if (!Object.hasOwn(this.#template, 'capButton')) properties.push('capButton')
        if (!Object.hasOwn(this.#template, 'phases')) properties.push('phases')
        if (!Object.hasOwn(this.#template, 'body')) properties.push('body')
        if (this.#template.body != null && typeof this.#template.body === 'object') {
            for (let i = 0; i <= this.#template.phases; i++) if (!Object.hasOwn(this.#template.body, i)) properties.push(`body.${k}`)
            for (let i in this.#template.body) {
                if (!Object.hasOwn(this.#template.body[i], 'vcState')) properties.push(`body.${i}.vcState`)
                if (!Object.hasOwn(this.#template.body[i], 'nextPhaseButton')) properties.push(`body.${i}.nextPhaseButton`)
                if (!Object.hasOwn(this.#template.body[i], 'timeLimit')) properties.push(`body.${i}.timeLimit`)
                if (!Object.hasOwn(this.#template.body[i], 'message')) properties.push(`body.${i}.message`)
                if (!Object.hasOwn(this.#template.body[i], 'embed')) properties.push(`body.${i}.embed`)
                if (this.#template.body[i].embed != null) {
                    if (!Object.hasOwn(this.#template.body[i].embed, 'color')) properties.push(`body.${i}.embed.color`)
                    if (!Object.hasOwn(this.#template.body[i].embed, 'description')) properties.push(`body.${i}.embed.description`)
                    if (!Object.hasOwn(this.#template.body[i].embed, 'image')) properties.push(`body.${i}.embed.image`)
                    if (!Object.hasOwn(this.#template.body[i].embed, 'thumbnail')) properties.push(`body.${i}.embed.thumbnail`)
                }
            }
        }
        if (!Object.hasOwn(this.#template, 'buttons')) properties.push('buttons')
        if (this.#template.buttons != null && typeof this.#template.buttons === 'object') {
            for (let i in this.#template.buttons) {
                if (!Object.hasOwn(this.#template.buttons[i], 'type')) properties.push(`buttons.${i}.type`)
                if (!Object.hasOwn(this.#template.buttons[i], 'parent')) properties.push(`buttons.${i}.parent`)
                if (!Object.hasOwn(this.#template.buttons[i], 'choice')) properties.push(`buttons.${i}.choice`)
                if (!Object.hasOwn(this.#template.buttons[i], 'limit')) properties.push(`buttons.${i}.limit`)
                if (!Object.hasOwn(this.#template.buttons[i], 'points')) properties.push(`buttons.${i}.points`)
                if (!Object.hasOwn(this.#template.buttons[i], 'displayName')) properties.push(`buttons.${i}.displayName`)
                if (!Object.hasOwn(this.#template.buttons[i], 'emote')) properties.push(`buttons.${i}.emote`)
                if (!Object.hasOwn(this.#template.buttons[i], 'confirm')) properties.push(`buttons.${i}.confirm`)
                if (!Object.hasOwn(this.#template.buttons[i], 'location')) properties.push(`buttons.${i}.location`)
                if (!Object.hasOwn(this.#template.buttons[i], 'minRole')) properties.push(`buttons.${i}.minRole`)
                if (!Object.hasOwn(this.#template.buttons[i], 'minStaffRoles')) properties.push(`buttons.${i}.minStaffRoles`)
                if (!Object.hasOwn(this.#template.buttons[i], 'confirmationMessage')) properties.push(`buttons.${i}.confirmationMessage`)
                if (!Object.hasOwn(this.#template.buttons[i], 'confirmationMedia')) properties.push(`buttons.${i}.confirmationMedia`)
                if (!Object.hasOwn(this.#template.buttons[i], 'disableStart')) properties.push(`buttons.${i}.disableStart`)
                if (!Object.hasOwn(this.#template.buttons[i], 'start')) properties.push(`buttons.${i}.start`)
                if (!Object.hasOwn(this.#template.buttons[i], 'lifetime')) properties.push(`buttons.${i}.lifetime`)
                if (!Object.hasOwn(this.#template.buttons[i], 'logOptions')) properties.push(`buttons.${i}.logOptions`)
                if (this.#template.buttons[i].logOptions != null) for (let j in this.#template.buttons[i].logOptions) {
                    if (!Object.hasOwn(this.#template.buttons[i].logOptions[j], 'logName')) properties.push(`buttons.${i}.logOptions.${j}.logName`)
                    if (!Object.hasOwn(this.#template.buttons[i].logOptions[j], 'points')) properties.push(`buttons.${i}.logOptions.${j}.points`)
                    if (!Object.hasOwn(this.#template.buttons[i].logOptions[j], 'multiplier')) properties.push(`buttons.${i}.logOptions.${j}.multiplier`)
                }
            }
        }
        if (!Object.hasOwn(this.#template, 'reacts')) properties.push('reacts')
        if (this.#template.reacts != null && typeof this.#template.reacts === 'object') {
            for (let i in this.#template.reacts) {
                if (!Object.hasOwn(this.#template.reacts[i], 'emote')) properties.push(`reacts.${i}.emote`)
                if (!Object.hasOwn(this.#template.reacts[i], 'onHeadcount')) properties.push(`reacts.${i}.onHeadcount`)
                if (!Object.hasOwn(this.#template.reacts[i], 'start')) properties.push(`reacts.${i}.start`)
                if (!Object.hasOwn(this.#template.reacts[i], 'lifetime')) properties.push(`reacts.${i}.lifetime`)
            }
        }
        if (properties.length != 0) throw new AfkTemplateValidationError(TemplateState.MISSING_PARAMETERS, `This afk template is missing the parameters ${properties.join(', ')}.`)
    }

    // Function for validating values of the AFK Template parameters
    #validateTemplateValues() {
        if (!this.#validateTemplateCategory(this.#template.category)) throw new AfkTemplateValidationError(TemplateState.INVALID_CATEGORY, 'This afk template has an Invalid Category.')
        if (!this.#validateTemplateChannel(this.#template.templateChannel)) throw new AfkTemplateValidationError(TemplateState.INVALID_CHANNEL, 'This afk template has an Invalid Template Channel.')
        if (this.#template.partneredStatusChannels && !this.#validateTemplateObject(this.#template.partneredStatusChannels)) throw new AfkTemplateValidationError(TemplateState.INVALID_OBJECT, 'This afk template has an Invalid Partnered Status Channels.')
        for (let i in this.#template.partneredStatusChannels) {
            if (!this.#validateTemplateGuild(i, this.#template.partneredStatusChannels[i].channels)) throw new AfkTemplateValidationError(TemplateState.INVALID_GUILD, `This afk template at Partnered Status Channels ${i} has an Invalid Channel/Guild.`)
        }
        if (!this.#validateTemplateChannel(this.#template.statusChannel)) throw new AfkTemplateValidationError(TemplateState.INVALID_CHANNEL, 'This afk template has an Invalid Status Channel.')
        if (!this.#validateTemplateChannel(this.#template.activeChannel)) throw new AfkTemplateValidationError(TemplateState.INVALID_CHANNEL, 'This afk template has an Invalid Active Channel.')
        if (this.#template.minStaffRoles && this.#template.minStaffRoles.some(roles => roles.some(role => !this.#validateTemplateRole(role)))) throw new AfkTemplateValidationError(TemplateState.INVALID_ROLE, 'This afk template has an Invalid Minimum Staff Role.')
        if (this.#template.minViewRaiderRoles && this.#template.minViewRaiderRoles.some(role => !this.#validateTemplateRole(role))) throw new AfkTemplateValidationError(TemplateState.INVALID_ROLE, 'This afk template has an Invalid Minimum View Raider Role.')
        if (this.#template.minJoinRaiderRoles && this.#template.minJoinRaiderRoles.some(role => !this.#validateTemplateRole(role))) throw new AfkTemplateValidationError(TemplateState.INVALID_ROLE, 'This afk template has an Invalid Minimum Join Raider Role.')
        if (!this.#validateTemplateString(this.#template.name)) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, 'This afk template has an Invalid Name.')
        if (this.#template.pingRoles && this.#template.pingRoles.some(role => role != 'here' && !this.#validateTemplateRole(role))) throw new AfkTemplateValidationError(TemplateState.INVALID_ROLE, `This afk template has an Invalid Ping Role. ${this.#template.pingRoles.filter(role => role != 'here' && !this.#validateTemplateRole(role))}`)
        if (!this.#validateTemplateNumber(this.#template.vcOptions, TemplateVCOptions)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, 'This afk template has an Invalid VC Option.')
        if (this.#template.startDelay && !this.#validateTemplateNumber(this.#template.startDelay)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, 'This afk template has an Invalid Start Delay.')
        if (!this.#validateTemplateNumber(this.#template.cap)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, 'This afk template has an Invalid Cap.')
        if (!this.#validateTemplateBoolean(this.#template.capButton)) throw new AfkTemplateValidationError(TemplateState.INVALID_BOOLEAN, 'This afk template has an Invalid Cap Button.')
        if (!this.#validateTemplateNumber(this.#template.phases)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, 'This afk template has an Invalid Phases.')
        if (!this.#validateTemplateObject(this.#template.body)) throw new AfkTemplateValidationError(TemplateState.INVALID_OBJECT, 'This afk template has an Invalid Body.')
        for (let i in this.#template.body) {
            if (!this.#validateTemplateNumber(this.#template.body[i].vcState, TemplateVCState)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Body ${i} has an Invalid VC State.`)
            if (this.#template.body[i].nextPhaseButton && !this.#validateTemplateString(this.#template.body[i].nextPhaseButton)) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, `This afk template at Body ${i} has an Invalid Next Phase Button.`)
            if (!this.#validateTemplateNumber(this.#template.body[i].timeLimit)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Body ${i} has an Invalid Time Limit.`)
            if (this.#template.body[i].message && !this.#validateTemplateString(this.#template.body[i].message)) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, `This afk template at Body ${i} has an Invalid Message.`)
            if (this.#template.body[i].embed.description && this.#template.body[i].embed.description.some(description => description && !this.#validateTemplateString(description))) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, `This afk template at Body ${i} has an Invalid Embed Description.`)
            if (this.#template.body[i].embed.image && !(this.#validateTemplateString(this.#template.body[i].embed.image) || this.#validateTemplateImage(this.#template.body[i].embed.image))) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, `This afk template at Body ${i} has an Invalid Embed Image.`)
            if (this.#template.body[i].embed.thumbnail && this.#template.body[i].embed.thumbnail.some(thumbnail => !this.#validateTemplateString(thumbnail))) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, `This afk template at Body ${i} has an Invalid Embed Thumbnail.`)
        }
        if (!this.#validateTemplateObject(this.#template.buttons)) throw new AfkTemplateValidationError(TemplateState.INVALID_OBJECT, 'This afk template has an Invalid Buttons.')
        for (let i in this.#template.buttons) {
            if (!this.#validateTemplateNumber(this.#template.buttons[i].type, TemplateButtonType)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Type.`)
            if (this.#template.buttons[i].parent && this.#template.buttons[i].parent.some(name => !this.#template.buttons[name])) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Parent.`)
            if (!this.#validateTemplateNumber(this.#template.buttons[i].choice, TemplateButtonChoice)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Choice.`)
            if (this.#template.buttons[i].limit && !this.#validateTemplateNumber(this.#template.buttons[i].limit)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Limit.`)
            if (this.#template.buttons[i].points && !(this.#validateTemplateNumber(this.#template.buttons[i].points) || this.#validateTemplatePoints(this.#template.buttons[i].points))) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Points.`)
            if (!this.#validateTemplateBoolean(this.#template.buttons[i].displayName)) throw new AfkTemplateValidationError(TemplateState.INVALID_BOOLEAN, `This afk template at Button ${i} has an Invalid Display Name.`)
            if (this.#template.buttons[i].emote && !this.#validateTemplateEmote(this.#template.buttons[i].emote)) throw new AfkTemplateValidationError(TemplateState.INVALID_EMOTE, `This afk template at Button ${i} has an Invalid Emote.`)
            if (!this.#validateTemplateBoolean(this.#template.buttons[i].confirm)) throw new AfkTemplateValidationError(TemplateState.INVALID_BOOLEAN, `This afk template at Button ${i} has an Invalid Confirm.`)
            if (!this.#validateTemplateBoolean(this.#template.buttons[i].location)) throw new AfkTemplateValidationError(TemplateState.INVALID_BOOLEAN, `This afk template at Button ${i} has an Invalid Location.`)
            if (this.#template.buttons[i].minRole && !this.#validateTemplateRole(this.#template.buttons[i].minRole)) throw new AfkTemplateValidationError(TemplateState.INVALID_ROLE, `This afk template at Button ${i} has an Invalid Minimum Role.`)
            if (this.#template.buttons[i].minStaffRoles && this.#template.buttons[i].minStaffRoles.some(role => !this.#validateTemplateRole(role))) throw new AfkTemplateValidationError(TemplateState.INVALID_ROLE, `This afk template at Button ${i} has an Invalid Minimum Staff Role.`)
            if (this.#template.buttons[i].confirmationMessage && !this.#validateTemplateString(this.#template.buttons[i].confirmationMessage)) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, `This afk template at Button ${i} has an Invalid Confirmation Message.`)
            if (this.#template.buttons[i].confirmationMedia && !this.#validateTemplateString(this.#template.buttons[i].confirmationMedia)) throw new AfkTemplateValidationError(TemplateState.INVALID_STRING, `This afk template at Button ${i} has an Invalid Confirmation Media.`)
            if (this.#template.buttons[i].disableStart && !this.#validateTemplateNumber(this.#template.buttons[i].disableStart)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Disable Start.`)
            if (!this.#validateTemplateNumber(this.#template.buttons[i].start)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Start.`)
            if (!this.#validateTemplateNumber(this.#template.buttons[i].lifetime)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} has an Invalid Lifetime.`)
            if (this.#template.buttons[i].logOptions != null) for (let j in this.#template.buttons[i].logOptions) {
                if (this.#template.buttons[i].logOptions[j].points && !(this.#validateTemplateNumber(this.#template.buttons[i].logOptions[j].points) || this.#validateTemplatePoints(this.#template.buttons[i].logOptions[j].points))) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} at Log Option ${j} has an Invalid Points.`)
                if (this.#template.buttons[i].logOptions[j].multiplier && !(this.#validateTemplateNumber(this.#template.buttons[i].logOptions[j].multiplier) || this.#validateTemplatePoints(this.#template.buttons[i].logOptions[j].multiplier))) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at Button ${i} at Log Option ${j} has an Invalid Multiplier.`)
            }
        }
        if (!this.#validateTemplateObject(this.#template.reacts)) throw new AfkTemplateValidationError(TemplateState.INVALID_OBJECT, 'This afk template has an Invalid Reacts.')
        for (let i in this.#template.reacts) {
            if (!this.#validateTemplateEmote(this.#template.reacts[i].emote)) throw new AfkTemplateValidationError(TemplateState.INVALID_EMOTE, `This afk template at React ${i} has an Invalid Emote.`)
            if (!this.#validateTemplateBoolean(this.#template.reacts[i].onHeadcount)) throw new AfkTemplateValidationError(TemplateState.INVALID_BOOLEAN, `This afk template at React ${i} has an Invalid On Headcount.`)
            if (!this.#validateTemplateNumber(this.#template.reacts[i].start)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at React ${i} has an Invalid Start.`)
            if (!this.#validateTemplateNumber(this.#template.reacts[i].lifetime)) throw new AfkTemplateValidationError(TemplateState.INVALID_NUMBER, `This afk template at React ${i} has an Invalid Lifetime.`)
        }
    }

    #validateTemplateGuild(guild, channels = null) {
        const otherGuild = this.#bot.guilds.cache.get(guild)
        if (!otherGuild) return false
        if (channels && channels.some(channel => !this.#validateTemplateChannel(channel, otherGuild))) return false
        return true
    }

    #validateTemplateCategory(category) {
        if (!this.#botSettings.raiding[category]) return false
        return this.#guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === this.#botSettings.raiding[category])
    }

    #validateTemplateChannel(channel, guild = this.#guild) {
        if (!this.#botSettings.raiding[channel]) return false
        return guild.channels.cache.get(this.#botSettings.raiding[channel])
    }

    #validateTemplateRole(role) {
        if (!this.#botSettings.roles[role]) return false
        return this.#guild.roles.cache.get(this.#botSettings.roles[role])
    }

    #validateTemplatePoints(points) {
        if (!this.#botSettings.points[points]) return false
        return this.#botSettings.points[points]
    }

    #validateTemplateImage(image) {
        if (!this.#botSettings.strings[image]) return false
        return this.#botSettings.strings[image]
    }

    #validateTemplateString(string) {
        return typeof string === 'string'
    }

    #validateTemplateNumber(number, dictionary = null) {
        if (dictionary) return Object.values(dictionary).includes(number)
        return Number.isInteger(number)
    }

    #validateTemplateObject(object) {
        return typeof object === "object"
    }

    #validateTemplateEmote(emote) {
        return this.#bot.storedEmojis[emote]
    }

    #validateTemplateBoolean(bool) {
        return typeof bool === "boolean"
    }

    #processParameters() {
        this.pingRoles = this.#template.pingRoles ? this.#template.pingRoles.map(role => (role == 'here') ? '@here' : this.#guild.roles.cache.get(this.#botSettings.roles[role])) : null
        this.perkRoles = this.#botSettings.lists.perkRoles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role]))
        this.minimumViewRaiderRoles = this.#template.minViewRaiderRoles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role]))
        this.minimumJoinRaiderRoles = this.#template.minJoinRaiderRoles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role]))
        this.minimumStaffRoles = this.#template.minStaffRoles.map(roles => roles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role])))
        this.raidInfoChannel = this.#guild.channels.cache.get(this.#botSettings.channels.runlogs)
        this.raidCategory = this.#guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === this.#botSettings.raiding[this.#template.category])
        this.raidPartneredStatusChannels = {}
        Object.keys(this.#template.partneredStatusChannels).forEach((guild) => this.raidPartneredStatusChannels[guild] = { channels: null }) 
        for (let i in this.#template.partneredStatusChannels) {
            let guild = this.#bot.guilds.cache.get(i)
            this.raidPartneredStatusChannels[i] = this.#template.partneredStatusChannels[i].channels.map(channel => guild.channels.cache.get(this.#botSettings.raiding[channel]))
        }
        this.raidTemplateChannel = this.#guild.channels.cache.get(this.#botSettings.raiding[this.#template.templateChannel])
        this.raidStatusChannel = this.#guild.channels.cache.get(this.#botSettings.raiding[this.#template.statusChannel])
        this.raidCommandChannel = this.#guild.channels.cache.get(this.#template.commandsChannel)
        this.raidActiveChannel = this.#guild.channels.cache.get(this.#botSettings.raiding[this.#template.activeChannel])
        this.logName = this.#template.logName
        this.name = this.#template.name
        this.vcOptions = this.#template.vcOptions
        this.startDelay = this.#template.startDelay
        this.cap = this.#template.cap
        this.capButton = this.#template.capButton
        this.phases = this.#template.phases
        this.body = this.#template.body
        this.buttons = this.#template.buttons
        this.reacts = this.#template.reacts
        this.templateID = this.#template.templateId
        this.parentTemplateID = this.#template.parentTemplateId
    }

    processBody(channel) {
        const body = JSON.parse(JSON.stringify(this.body))
        for (let i = 1; i <= this.#template.phases; i++) {
            if (body[i].message) body[i].message = this.processMessages(channel, body[i].message)
            if (!body[i].embed.description) body[i].embed.description = this.processBodyDescription(channel, i)
            else {
                for (let j in body[i].embed.description) {
                    if (!body[i].embed.description[j]) body[i].embed.description[j] = this.processBodyDescription(channel, i)
                    else if (i != 0 && body[i].embed.description[j] == "") body[i].embed.description[j] = body[i-1].embed.description[j]
                    else body[i].embed.description[j] = this.processMessages(channel, body[i].embed.description[j])
                }
                body[i].embed.description = body[i].embed.description.reduce((a, b) => a + b)
            }
        }
        return body
    }

    processBodyHeadcount(channel) {
        let description = ""
        if (!this.body[1].embed.description) description = this.processBodyDescriptionHeadcount()
        else {
            for (let i in this.body[1].embed.description) {
                if (!this.body[1].embed.description[i]) this.body[1].embed.description[i] = this.processBodyDescriptionHeadcount()
                else this.body[1].embed.description[i] = this.processMessages(channel, this.body[1].embed.description[i])
            }
            description = this.body[1].embed.description.reduce((a, b) => a + b)
        }
        return description
    }

    processBodyDescription(channel, i) {
        let description = ""
        if (this.vcOptions == TemplateVCOptions.STATIC_VC || this.vcOptions == TemplateVCOptions.CREATE_VC) description += `To join **click here** ${channel}\n`
        else if (this.vcOptions == TemplateVCOptions.NO_VC) description += `To join, react for location\n`
        let emotes = []
        let supporter = null
        for (let j in this.buttons) {
            let start = this.buttons[j].start
            let end = start + this.buttons[j].lifetime
            if (i < this.buttons[j].start && i >= end ) continue
            if (this.buttons[j].type == TemplateButtonType.NORMAL && this.buttons[j].emote) emotes.push(this.#bot.storedEmojis[this.buttons[j].emote].text)
            if (this.buttons[j].type == TemplateButtonType.LOG || this.buttons[j].type == TemplateButtonType.LOG_SINGLE) description += `If you have a **${j}**, react with ${this.buttons[j].emote ? this.#bot.storedEmojis[this.buttons[j].emote].text : "the button"}\n`
            if (this.buttons[j].type == TemplateButtonType.SUPPORTER) supporter = this.#bot.storedEmojis[this.buttons[j].emote].text
        }
        if (emotes.length > 0) description += `If you have an early react, react with ${emotes.join(" ")}\n`
        if (supporter) description += `If you are a ${this.perkRoles.join("")}, react with ${supporter}\n`
        return description
    }

    processBodyDescriptionHeadcount() {
        let description = ""
        let reactEmotes = []
        let buttonEmotes = []
        for (let i in this.reacts) {
            if (this.reacts[i].onHeadcount && this.reacts[i].emote) reactEmotes.push(this.reacts[i].emote.text)
        }
        for (let i in this.buttons) {
            if (this.buttons[i].type == TemplateButtonType.NORMAL && this.buttons[i].emote) buttonEmotes.push(this.#bot.storedEmojis[this.buttons[i].emote].text)
            if ((this.buttons[i].type == TemplateButtonType.LOG || this.buttons[i].type == TemplateButtonType.LOG_SINGLE) && this.buttons[i].emote) description += `If you plan on bringing a **${i}**, react with ${this.#bot.storedEmojis[this.buttons[i].emote].text}\n`
        }
        if (reactEmotes.length > 0) description += `If you plan on coming, react with ${reactEmotes.join(" ")}\n`
        if (buttonEmotes.length > 0) description += `If you plan on bringing an early react, react with ${buttonEmotes.join(" ")}\n`
        return description
    }

    processButtons(channel) {
        return Object.entries(this.#template.buttons).reduce((obj, [key, button]) => {
            obj[key] = {
                ...button,
                points: typeof button.points == 'string' ? this.#botSettings.points[button.points] : button.points ?? 0,
                disableStart: button.disableStart || button.start,
                emote: this.#bot.storedEmojis[button.emote],
                minRole: this.#guild.roles.cache.get(this.#botSettings.roles[button.minRole]),
                minStaffRoles: button.minStaffRoles && button.minStaffRoles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role])),
                confirmationMessage: button.confirmationMessage && this.processMessages(channel, button.confirmationMessage),
                logOptions: button.logOptions && Object.entries(button.logOptions).reduce((obj, [key, logOption]) => {
                    obj[key] = {
                        ...logOption,
                        points: typeof logOption.points == 'string' ? this.#botSettings.points[logOption.points] : logOption.points ?? 0,
                        multiplier: typeof logOption.multiplier == 'string' ? this.#botSettings.points[logOption.multiplier] : logOption.multiplier ?? 1,
                    }
                    return obj
                }, {})
            }
            return obj
        }, {})
    }

    processMessages(channel, currentMessage) {
        let newMessage1 = ""
        let newMessage2 = ""
        newMessage1 = currentMessage.match(/[^\[\]]*/g).map(match => {
            let message = match
            if (this.#guild.channels.cache.has(this.#botSettings.channels[match])) message = `<#${this.#botSettings.channels[match]}>`
            else if (this.#guild.roles.cache.has(this.#botSettings.roles[match])) message = `<@&${this.#botSettings.roles[match]}>`
            else if (match == 'voicechannel') message = channel
            return message
        }).reduce((a, b) => a + b)
        newMessage2 = newMessage1.match(/[^\{\}]*/g).map(match => {
            let message = match
            if (this.#bot.storedEmojis[match]) message = `${this.#bot.storedEmojis[match].text}`
            return message
        }).reduce((a, b) => a + b)
        return newMessage2
    }

    #processReacts() {
        for (let i in this.reacts) this.reacts[i].emote = this.#bot.storedEmojis[this.reacts[i].emote]
    }

    getButtonChoices() {
        let choices = []
        for (let i in this.buttons) if (this.buttons[i].choice != TemplateButtonChoice.NO_CHOICE) choices.push(i) 
        return choices
    }
}

module.exports = { AfkTemplate, TemplateVCOptions, TemplateVCState, TemplateButtonType, TemplateButtonChoice, templateNamePrompt, AfkTemplateValidationError, resolveTemplateAlias,
    name: 'afkinfo',
    description: 'Gives information about afk checks on the bot.',
    args: '<number/reset/delete/show> (guildID/all)',
    role: 'developer',
    allowedInRestart: true,
    async execute(message, args, bot, db) {
        let initialCommand = args.shift()
        let initialGuildID = args.shift()
        const command = initialCommand ? initialCommand.toLowerCase() : null
        const guildID = initialGuildID ? initialGuildID : message.guild.id
        const raidIDs = []
        for (let raidID in bot.afkChecks) {
            if (guildID == 'all' || bot.afkChecks[raidID].guild.id == guildID) raidIDs.push(raidID)
        }
        switch (command) {
            case 'number':
                return await message.reply({ embeds: [createEmbed(message, `There are currently \`${raidIDs.length}\` afk checks.`, null)] })
            case 'show':
                let textShow = `There are currently \`${raidIDs.length}\` afk checks.`
                let indexShow = 0
                for (let raidID of raidIDs) {
                    textShow += `\n\`\`${indexShow+1}.\`\` ${bot.afkChecks[raidID].afkTemplateName} by ${bot.afkChecks[raidID].leader} at <t:${Math.floor(bot.afkChecks[raidID].time/1000)}:f> is ${bot.afkModules[raidID]?.active ? 'active' : 'inactive'}`
                    indexShow++
                }
                return await message.reply({ embeds: [createEmbed(message, textShow, null)] })
            case 'delete':
                const deleteMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Afk Checks`)
                .setMinValues(1)
                .setMaxValues(1)
                let textDelete = `There are currently \`${raidIDs.length}\` afk checks.`
                let indexDelete = 0
                for (let raidID of raidIDs) {
                    textDelete += `\n\`\`${indexDelete+1}.\`\` ${bot.afkChecks[raidID].afkTemplateName} by ${bot.afkChecks[raidID].leader} at <t:${Math.floor(bot.afkChecks[raidID].time/1000)}:f> is ${bot.afkModules[raidID]?.active ? 'active' : 'inactive'}`
                    deleteMenu.addOptions({ label: `${indexDelete+1}. ${bot.afkChecks[raidID].afkTemplateName} by ${bot.afkChecks[raidID].leader.displayName}`, value: raidID })
                    indexDelete++
                }

                if (raidIDs.length == 0) return await message.reply({ embeds: [createEmbed(message, textDelete, null)] })
                const {value: raidID, interaction: subInteraction} = await message.selectPanel(textDelete, null, deleteMenu, 30000, false, true)
                if (!raidID) return
                delete bot.afkChecks[raidID]
                delete bot.afkModules[raidID]
                fs.writeFileSync('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot, message.guild) })
                return await message.reply({ embeds: [createEmbed(message, `Afk check \`${raidID}\` has been deleted.`, null)] })
            case 'reset':
                for (let raidID of raidIDs) {
                    delete bot.afkChecks[raidID]
                    delete bot.afkModules[raidID]
                }
                fs.writeFileSync('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot, message.guild) })
                return await message.reply({ embeds: [createEmbed(message, `\`${raidIDs.length}\` afk checks have been reset.`, null)] })
        }
        await message.reply({ embeds: [createEmbed(message, 'afkInfo is missing arguments.', null)] })
    }
}
