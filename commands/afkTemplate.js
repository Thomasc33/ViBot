const Discord = require('discord.js')
const templates = require('../data/afkTemplates.json')

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
    'INVALID_STRING': 8,
    'INVALID_NUMBER': 9,
    'INVALID_OBJECT': 10,
    'INVALID_EMOTE': 11,
    'INVALID_BOOLEAN': 12
}

// Enum for the VC Options in an AFK
const TemplateVCOptions = {
    'NO_VC': 0,
    'STATIC_VC': 1,
    'CREATE_VC' : 2
}

// Enum for the VC States in an AFK
const TemplateVCState = {
    'LOCKED': 0,
    'OPEN': 1
}

// Enum for the Button Types in an AFK
const TemplateButtonType = {
    'NORMAL': 0,
    'LOG': 1,
    'SUPPORTER': 2,
    'POINTS': 3,
    'DRAG': 4
}

// Enum for the Choice on Buttons in an AFK
const TemplateButtonChoice = {
    'NO_CHOICE': 0,
    'YES_NO_CHOICE': 1,
    'NUMBER_CHOICE' : 2
}

class AfkTemplate {
    #template;
    #bot;
    #botSettings;
    #guild;
    #channel;
    #message;
    #alias
    #status;

    constructor(bot, botSettings, message, alias) {
        this.#bot = bot
        this.#botSettings = botSettings
        this.#guild = message.guild
        this.#channel = message.channel
        this.#template = null
        this.#message = message
        this.#alias = alias.toLowerCase()
    }

    async init() {
        await this.getTemplate()
        this.#status = this.validateTemplate()
        if (this.#status.state == TemplateState.SUCCESS) this.processParameters()
        return
    }

    async getTemplate() {
        let selectedTemplates = templates[this.#guild.id].children.filter(t => t.aliases.includes(this.#alias))
        if (selectedTemplates.length == 0) selectedTemplates = templates[this.#guild.id].children.filter(t => { for (let alias of t.aliases) if (alias.includes(this.#alias)) return true })
        if (selectedTemplates.length == 0) return this.#template = null
        else if (selectedTemplates.length == 1) return this.#template = JSON.parse(JSON.stringify(selectedTemplates[0]))
        const templateMenu = new Discord.StringSelectMenuBuilder()
            .setCustomId(`template`)
            .setPlaceholder(`Name of Afk`)
            .setMinValues(1)
            .setMaxValues(1)
        for (let i in selectedTemplates) templateMenu.addOptions({ label: selectedTemplates[i].templateName, value: i })
        const templateMessage = await this.#message.channel.send({ content: `${this.#message.member}`, components: [] })
        const templateValue = await templateMessage.selectPanel(templateMenu, this.#message.member.id, 10000)
        await templateMessage.delete()
        return this.#template = JSON.parse(JSON.stringify(templateValue ? selectedTemplates[templateValue] : selectedTemplates[0]))
    }

    validateTemplate() {
        let status = {state: TemplateState.SUCCESS, message: ''}
        if (!this.#template) return status = {state: TemplateState.NOT_EXIST, message: 'This afk template does not exist.'}
        this.populateTemplateInherit()
        this.populateBodyInherit()
        status = this.validateTemplateParameters(status)
        if (!this.#template.enabled) return status = {state: TemplateState.DISABLED, message: 'This afk template is disabled.'}
        status = this.validateTemplateValues(status)
        return status
    }

    populateObjectInherit(template, parentTemplate) {
        for (let i in parentTemplate) {
            if (template[i] == undefined || template[i] == null) template[i] = parentTemplate[i]
            else if (typeof template[i] == "object" && template[i] != null && typeof parentTemplate[i] == "object" && parentTemplate[i] != null) {
                if (Array.isArray(template[i])) template[i] = [...new Set([...parentTemplate[i], ...template[i]])]
                else template[i] = Object.assign({}, parentTemplate[i], template[i])
                this.populateObjectInherit(template[i], parentTemplate[i])
            }
        }
    }

    populateTemplateInherit() {
        let parentTemplate = null
        this.#template.inherits.forEach((parent) => {
            let currentParentTemplate = templates[this.#guild.id].parents[parent]
            if (currentParentTemplate && currentParentTemplate.commandsChannel == this.#channel.id) parentTemplate = currentParentTemplate
        })
        this.populateObjectInherit(this.#template, parentTemplate)
    }

    populateBodyInherit() {
        let phases = Array.from({length: this.#template.phases},(_,k)=>k+1)
        for (let i of phases) {
            if (this.#template.body[i] == undefined) this.#template.body[i] = this.#template.body.default
            else this.populateObjectInherit(this.#template.body[i], this.#template.body.default)
        }
    }

    validateTemplateParameters(status) {
        let properties = []
        if (!Object.hasOwn(this.#template, 'inherits')) properties.push('inherits')
        if (!Object.hasOwn(this.#template, 'category')) properties.push('category')
        if (!Object.hasOwn(this.#template, 'templateChannel')) properties.push('templateChannel')
        if (!Object.hasOwn(this.#template, 'partneredStatusChannels')) properties.push('partneredStatusChannels')
        if (this.#template.partneredStatusChannels != null && typeof this.#template.partneredStatusChannels === 'object') {
            for (let i in this.#template.partneredStatusChannels) {
                if (!Object.hasOwn(this.#template.partneredStatusChannels[i], 'channels')) properties.push(`partneredStatusChannels.${i}channel`)
            }
        }
        if (!Object.hasOwn(this.#template, 'statusChannel')) properties.push('statusChannel')
        if (!Object.hasOwn(this.#template, 'commandsChannel')) properties.push('commandsChannel')
        if (!Object.hasOwn(this.#template, 'activeChannel')) properties.push('activeChannel')
        if (!Object.hasOwn(this.#template, 'enabled')) properties.push('enabled')
        if (!Object.hasOwn(this.#template, 'minStaffRole')) properties.push('minStaffRole')
        if (!Object.hasOwn(this.#template, 'minViewRaiderRole')) properties.push('minViewRaiderRole')
        if (!Object.hasOwn(this.#template, 'minJoinRaiderRole')) properties.push('minJoinRaiderRole')
        if (!Object.hasOwn(this.#template, 'name')) properties.push('name')
        if (!Object.hasOwn(this.#template, 'pingRoles')) properties.push('pingRoles')
        if (!Object.hasOwn(this.#template, 'aliases')) properties.push('aliases')
        if (!Object.hasOwn(this.#template, 'logName')) properties.push('logName')
        if (!Object.hasOwn(this.#template, 'vcOptions')) properties.push('vcOptions')
        if (!Object.hasOwn(this.#template, 'cap')) properties.push('cap')
        if (!Object.hasOwn(this.#template, 'capButton')) properties.push('capButton')
        if (!Object.hasOwn(this.#template, 'phases')) properties.push('phases')
        if (!Object.hasOwn(this.#template, 'body')) properties.push('body')
        if (this.#template.body != null && typeof this.#template.body === 'object') {
            let phases = Array.from({length: this.#template.phases},(_,k)=>k+1)
            if (!Object.hasOwn(this.#template.body, 'default')) properties.push('body.default')
            phases.map(k => { if(!Object.hasOwn(this.#template.body, `${k}`)) properties.push(`body.${k}`) })
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
                if (!Object.hasOwn(this.#template.buttons[i], 'minStaffRole')) properties.push(`buttons.${i}.minStaffRole`)
                if (!Object.hasOwn(this.#template.buttons[i], 'confirmationMessage')) properties.push(`buttons.${i}.confirmationMessage`)
                if (!Object.hasOwn(this.#template.buttons[i], 'confirmationMedia')) properties.push(`buttons.${i}.confirmationMedia`)
                if (!Object.hasOwn(this.#template.buttons[i], 'logName')) properties.push(`buttons.${i}.logName`)
                if (!Object.hasOwn(this.#template.buttons[i], 'disableStart')) properties.push(`buttons.${i}.disableStart`)
                if (!Object.hasOwn(this.#template.buttons[i], 'start')) properties.push(`buttons.${i}.start`)
                if (!Object.hasOwn(this.#template.buttons[i], 'lifetime')) properties.push(`buttons.${i}.lifetime`)
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
        if (properties.length != 0) {
            status.state = TemplateState.MISSING_PARAMETERS
            status.message = `This afk template is missing the parameters ${properties.join(', ')}.`
        }
        return status
    }

    validateTemplateValues(status) {
        if (status.state != TemplateState.SUCCESS) return status
        if (!this.validateTemplateCategory(this.#template.category)) return status = {state: TemplateState.INVALID_CATEGORY, message: 'This afk template has an Invalid Category.'}
        if (!this.validateTemplateChannel(this.#template.templateChannel)) return status = {state: TemplateState.INVALID_CHANNEL, message: 'This afk template has an Invalid Template Channel.'}
        if (this.#template.partneredStatusChannels && !this.validateTemplateObject(this.#template.partneredStatusChannels)) return status = {state: TemplateState.INVALID_OBJECT, message: 'This afk template has an Invalid Partnered Status Channels.'}
        for (let i in this.#template.partneredStatusChannels) {
            if (!this.validateTemplateGuild(i, this.#template.partneredStatusChannels[i].channels)) return status = {state: TemplateState.INVALID_GUILD, message: `This afk template at Partnered Status Channels ${i} has an Invalid Channel/Guild.`}
        }
        if (!this.validateTemplateChannel(this.#template.statusChannel)) return status = {state: TemplateState.INVALID_CHANNEL, message: 'This afk template has an Invalid Status Channel.'}
        if (!this.validateTemplateChannel(this.#template.commandsChannel)) return status = {state: TemplateState.INVALID_CHANNEL, message: 'This afk template has an Invalid Commands Channel.'}
        if (!this.validateTemplateChannel(this.#template.activeChannel)) return status = {state: TemplateState.INVALID_CHANNEL, message: 'This afk template has an Invalid Active Channel.'}
        if (!this.validateTemplateRole(this.#template.minStaffRole)) return status = {state: TemplateState.INVALID_ROLE, message: 'This afk template has an Invalid Minimum Staff Role.'}
        if (!this.validateTemplateRole(this.#template.minViewRaiderRole)) return status = {state: TemplateState.INVALID_ROLE, message: 'This afk template has an Invalid Minimum View Raider Role.'}
        if (!this.validateTemplateRole(this.#template.minJoinRaiderRole)) return status = {state: TemplateState.INVALID_ROLE, message: 'This afk template has an Invalid Minimum Join Raider Role.'}
        if (!this.validateTemplateString(this.#template.name)) return status = {state: TemplateState.INVALID_STRING, message: 'This afk template has an Invalid Name.'}
        if (this.#template.pingRoles && this.#template.pingRoles.some(role => role != 'here' && !this.validateTemplateRole(role))) return status = {state: TemplateState.INVALID_ROLE, message: 'This afk template has an Invalid Ping Role.'}
        if (this.#template.aliases.some(alias => !this.validateTemplateString(alias))) return status = {state: TemplateState.INVALID_STRING, message: 'This afk template has an Invalid Aliases.'}
        if (!this.validateTemplateNumber(this.#template.vcOptions, TemplateVCOptions)) return status = {state: TemplateState.INVALID_NUMBER, message: 'This afk template has an Invalid VC Option.'}
        if (this.#template.startDelay && !this.validateTemplateNumber(this.#template.startDelay)) return status = {state: TemplateState.INVALID_NUMBER, message: 'This afk template has an Invalid Start Delay.'}
        if (!this.validateTemplateNumber(this.#template.cap)) return status = {state: TemplateState.INVALID_NUMBER, message: 'This afk template has an Invalid Cap.'}
        if (!this.validateTemplateBoolean(this.#template.capButton)) return status = {state: TemplateState.INVALID_BOOLEAN, message: 'This afk template has an Invalid Cap Button.'}
        if (!this.validateTemplateNumber(this.#template.phases)) return status = {state: TemplateState.INVALID_NUMBER, message: 'This afk template has an Invalid Phases.'}
        if (!this.validateTemplateObject(this.#template.body)) return status = {state: TemplateState.INVALID_OBJECT, message: 'This afk template has an Invalid Body.'}
        for (let i in this.#template.body) {
            if (!this.validateTemplateNumber(this.#template.body[i].vcState, TemplateVCState)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Body ${i} has an Invalid VC State.`}
            if (this.#template.body[i].nextPhaseButton && !this.validateTemplateString(this.#template.body[i].nextPhaseButton)) return status = {state: TemplateState.INVALID_STRING, message: `This afk template at Body ${i} has an Invalid Next Phase Button.`}
            if (!this.validateTemplateNumber(this.#template.body[i].timeLimit)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Body ${i} has an Invalid Time Limit.`}
            if (this.#template.body[i].message && !this.validateTemplateString(this.#template.body[i].message)) return status = {state: TemplateState.INVALID_STRING, message: `This afk template at Body ${i} has an Invalid Message.`}
            if (this.#template.body[i].embed.description && this.#template.body[i].embed.description.some(description => description && !this.validateTemplateString(description))) return status = {state: TemplateState.INVALID_STRING, message: `This afk template at Body ${i} has an Invalid Embed Description.`}
            if (this.#template.body[i].embed.image && !this.validateTemplateString(this.#template.body[i].embed.image)) return status = {state: TemplateState.INVALID_STRING, message: `This afk template at Body ${i} has an Invalid Embed Image.`}
            if (this.#template.body[i].embed.thumbnail && this.#template.body[i].embed.thumbnail.some(thumbnail => !this.validateTemplateString(thumbnail))) return status = {state: TemplateState.INVALID_STRING, message: `This afk template at Body ${i} has an Invalid Embed Thumbnail.`}
        }
        if (!this.validateTemplateObject(this.#template.buttons)) return status = {state: TemplateState.INVALID_OBJECT, message: 'This afk template has an Invalid Buttons.'}
        for (let i in this.#template.buttons) {
            if (!this.validateTemplateNumber(this.#template.buttons[i].type, TemplateButtonType)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Type.`}
            if (this.#template.buttons[i].parent && this.#template.buttons[i].parent.some(name => !this.#template.buttons[name])) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Parent.`}
            if (!this.validateTemplateNumber(this.#template.buttons[i].choice, TemplateButtonChoice)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Choice.`}
            if (this.#template.buttons[i].limit && !this.validateTemplateNumber(this.#template.buttons[i].limit)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Limit.`}
            if (this.#template.buttons[i].points && !this.validateTemplateNumber(this.#template.buttons[i].points)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Points.`}
            if (!this.validateTemplateBoolean(this.#template.buttons[i].displayName)) return status = {state: TemplateState.INVALID_BOOLEAN, message: `This afk template at Button ${i} has an Invalid Display Name.`}
            if (this.#template.buttons[i].emote && !this.validateTemplateEmote(this.#template.buttons[i].emote)) return status = {state: TemplateState.INVALID_EMOTE, message: `This afk template at Button ${i} has an Invalid Emote.`}
            if (!this.validateTemplateBoolean(this.#template.buttons[i].confirm)) return status = {state: TemplateState.INVALID_BOOLEAN, message: `This afk template at Button ${i} has an Invalid Confirm.`}
            if (!this.validateTemplateBoolean(this.#template.buttons[i].location)) return status = {state: TemplateState.INVALID_BOOLEAN, message: `This afk template at Button ${i} has an Invalid Location.`}
            if (this.#template.buttons[i].minRole && !this.validateTemplateRole(this.#template.buttons[i].minRole)) return status = {state: TemplateState.INVALID_ROLE, message: `This afk template at Button ${i} has an Invalid Minimum Role.`}
            if (this.#template.buttons[i].minStaffRole && !this.validateTemplateRole(this.#template.buttons[i].minStaffRole)) return status = {state: TemplateState.INVALID_ROLE, message: `This afk template at Button ${i} has an Invalid Minimum Staff Role.`}
            if (this.#template.buttons[i].confirmationMessage && !this.validateTemplateString(this.#template.buttons[i].confirmationMessage)) return status = {state: TemplateState.INVALID_STRING, message: `This afk template at Button ${i} has an Invalid Confirmation Message.`}
            if (this.#template.buttons[i].confirmationMedia && !this.validateTemplateString(this.#template.buttons[i].confirmationMedia)) return status = {state: TemplateState.INVALID_STRING, message: `This afk template at Button ${i} has an Invalid Confirmation Media.`}
            if (this.#template.buttons[i].disableStart && !this.validateTemplateNumber(this.#template.buttons[i].disableStart)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Disable Start.`}
            if (!this.validateTemplateNumber(this.#template.buttons[i].start)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Start.`}
            if (!this.validateTemplateNumber(this.#template.buttons[i].lifetime)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at Button ${i} has an Invalid Lifetime.`}
        }
        if (!this.validateTemplateObject(this.#template.reacts)) return status = {state: TemplateState.INVALID_OBJECT, message: 'This afk template has an Invalid Reacts.'}
        for (let i in this.#template.reacts) {
            if (!this.validateTemplateEmote(this.#template.reacts[i].emote)) return status = {state: TemplateState.INVALID_EMOTE, message: `This afk template at React ${i} has an Invalid Emote.`}
            if (!this.validateTemplateBoolean(this.#template.reacts[i].onHeadcount)) return status = {state: TemplateState.INVALID_BOOLEAN, message: `This afk template at React ${i} has an Invalid On Headcount.`}
            if (!this.validateTemplateNumber(this.#template.reacts[i].start)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at React ${i} has an Invalid Start.`}
            if (!this.validateTemplateNumber(this.#template.reacts[i].lifetime)) return status = {state: TemplateState.INVALID_NUMBER, message: `This afk template at React ${i} has an Invalid Lifetime.`}
        }
        return status
    }

    validateTemplateGuild(guild, channels = null) {
        const otherGuild = this.#bot.guilds.cache.get(guild)
        if (!otherGuild) return false
        if (channels && channels.some(channel => !this.validateTemplateChannel(channel, otherGuild))) return false
        return true
    }

    validateTemplateCategory(category) {
        return this.#guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === category)
    }

    validateTemplateChannel(channel, guild = this.#guild) {
        return guild.channels.cache.get(channel)
    }

    validateTemplateRole(role) {
        if (!this.#botSettings.roles[role]) return false
        return this.#guild.roles.cache.get(this.#botSettings.roles[role])
    }

    validateTemplateString(string) {
        return typeof string === 'string'
    }

    validateTemplateNumber(number, dictionary = null) {
        if (dictionary) return Object.values(dictionary).includes(number)
        return Number.isInteger(number)
    }

    validateTemplateObject(object) {
        return typeof object === "object"
    }

    validateTemplateEmote(emote) {
        return this.#bot.storedEmojis[emote]
    }

    validateTemplateBoolean(bool) {
        return typeof bool === "boolean"
    }

    processParameters() {
        this.pingRoles = this.#template.pingRoles ? this.#template.pingRoles.map(role => (role == 'here') ? '@here' : this.#guild.roles.cache.get(this.#botSettings.roles[role])) : null
        this.perkRoles = this.#botSettings.lists.perkRoles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role]))
        this.minimumViewRaiderRole = this.#guild.roles.cache.get(this.#botSettings.roles[this.#template.minViewRaiderRole])
        this.minimumJoinRaiderRole = this.#template.minJoinRaiderRole ? this.#guild.roles.cache.get(this.#botSettings.roles[this.#template.minJoinRaiderRole]) : this.minimumViewRaiderRole
        this.minimumStaffRole = this.#guild.roles.cache.get(this.#botSettings.roles[this.#template.minStaffRole])
        this.raidInfoChannel = this.#guild.channels.cache.get(this.#botSettings.channels.runlogs)
        this.raidCategory = this.#guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === this.#template.category)
        this.raidPartneredStatusChannels = {}
        Object.keys(this.#template.partneredStatusChannels).forEach((guild) => this.raidPartneredStatusChannels[guild] = { channels: null }) 
        for (let i in this.#template.partneredStatusChannels) {
            let guild = this.#bot.guilds.cache.get(i)
            this.raidPartneredStatusChannels[i] = this.#template.partneredStatusChannels[i].channels.map(channel => guild.channels.cache.get(channel))
        }
        this.raidTemplateChannel = this.#guild.channels.cache.get(this.#template.templateChannel)
        this.raidStatusChannel = this.#guild.channels.cache.get(this.#template.statusChannel)
        this.raidCommandChannel = this.#guild.channels.cache.get(this.#template.commandsChannel)
        this.raidActiveChannel = this.#guild.channels.cache.get(this.#template.activeChannel)
        this.logName = this.#template.logName
        this.name = this.#template.name
        this.vcOptions = this.#template.vcOptions
        this.startDelay = this.#template.startDelay
        this.cap = this.#template.cap
        this.phases = this.#template.phases
        this.body = this.#template.body
        this.buttons = this.#template.buttons
        this.reacts = this.#template.reacts
    }

    processBody(channel) {
        let phases = Array.from({length: this.#template.phases},(_,k)=>k+1)
        for (let i of phases) {
            if (this.body[i].message) this.body[i].message = this.processMessages(channel, this.body[i].message)
            if (!this.body[i].embed.description) this.body[i].embed.description = this.processBodyDescription(channel, i)
            else {
                for (let j in this.body[i].embed.description) {
                    if (!this.body[i].embed.description[j]) this.body[i].embed.description[j] = this.processBodyDescription(channel, i)
                    else if (i != 0 && this.body[i].embed.description[j] == "") this.body[i].embed.description[j] = this.body[i-1].embed.description[j]
                    else this.body[i].embed.description[j] = this.processMessages(channel, this.body[i].embed.description[j])
                }
                this.body[i].embed.description = this.body[i].embed.description.reduce((a, b) => a + b)
            }
        }
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
            if (this.buttons[j].type == TemplateButtonType.NORMAL && this.buttons[j].emote) emotes.push(this.buttons[j].emote.text)
            if (this.buttons[j].type == TemplateButtonType.LOG) description += `If you have a **${j}**, react with ${this.buttons[j].emote ? this.buttons[j].emote.text : "the button"}\n`
            if (this.buttons[j].type == TemplateButtonType.SUPPORTER) supporter = this.buttons[j].emote.text
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
            if (this.buttons[i].type == TemplateButtonType.NORMAL && this.buttons[i].emote) buttonEmotes.push(this.buttons[i].emote.text)
            if (this.buttons[i].type == TemplateButtonType.LOG && this.buttons[i].emote) description += `If you plan on bringing a **${i}**, react with ${this.buttons[i].emote.text}\n`
        }
        if (reactEmotes.length > 0) description += `If you plan on coming, react with ${reactEmotes.join(" ")}\n`
        if (buttonEmotes.length > 0) description += `If you plan on bringing an early react, react with ${buttonEmotes.join(" ")}\n`
        return description
    }

    

    processButtons(channel) {
        for (let i in this.buttons) {
            if (!this.buttons[i].disableStart) this.buttons[i].disableStart = this.buttons[i].start
            if (this.buttons[i].emote) this.buttons[i].emote = this.#bot.storedEmojis[this.buttons[i].emote]
            if (this.buttons[i].minRole) this.buttons[i].minRole = this.#guild.roles.cache.get(this.#botSettings.roles[this.buttons[i].minRole])
            if (this.buttons[i].minStaffRole) this.buttons[i].minStaffRole = this.#guild.roles.cache.get(this.#botSettings.roles[this.buttons[i].minStaffRole])
            if (this.buttons[i].confirmationMessage) this.buttons[i].confirmationMessage = this.processMessages(channel, this.buttons[i].confirmationMessage)
        }
    }

    processMessages(channel, currentMessage) {
        let newMessage = ""
        newMessage = currentMessage.match(/[^\[\]]*/g).map(match => {
            let message = match
            if (this.#guild.channels.cache.has(this.#botSettings.channels[match])) message = `<#${this.#botSettings.channels[match]}>`
            if (this.#guild.roles.cache.has(this.#botSettings.roles[match])) message = `<@&${this.#botSettings.roles[match]}>`
            if (match == '[voicechannel]') message = channel
            return message
        }).reduce((a, b) => a + b)
        newMessage = currentMessage.match(/[^\{\}]*/g).map(match => {
            let message = match
            if (this.#bot.storedEmojis[match]) message = `${this.#bot.storedEmojis[match].text}`
            return message
        }).reduce((a, b) => a + b)
        return newMessage
    }

    processReacts() {
        for (let i in this.reacts) this.reacts[i].emote = this.#bot.storedEmojis[this.reacts[i].emote]
    }

    updateButtonChoice(choices) {
        for (let i in this.buttons) if (choices.includes(i)) delete this.buttons[i]
    }

    getButtonChoice() {
        let choices = []
        for (let i in this.buttons) if (this.buttons[i].choice != TemplateButtonChoice.NO_CHOICE) choices.push(i) 
        return choices
    }

    getStatus() {
        return this.#status
    }
}

module.exports = { AfkTemplate, TemplateState, TemplateVCOptions, TemplateVCState, TemplateButtonType, TemplateButtonChoice}