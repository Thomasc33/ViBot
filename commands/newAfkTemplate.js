const Discord = require('discord.js')
const templates = require('../data/templates.json')

class AfkTemplate {
    #template;
    #bot
    #botSettings;
    #guild;
    #channel;
    #state;

    constructor(bot, botSettings, guild, channel, alias) {
        this.#bot = bot
        this.#botSettings = botSettings
        this.#guild = guild
        this.#channel = channel
        alias = alias.toLowerCase()
        this.#template = templates[guild.id].other.find(t => t.aliases.includes(alias));
        this.#state = this.parseTemplate()
        if (this.#state.state == 0) this.populateParameters()
    }

    parseTemplate() {
        if (!this.#template) return {"state": 1, "message": "This afk does not exist."};
        if (!this.#template.enabled) return {"state": 2, "message": "This afk is disabled."};
        this.parseInherit()
        if (!this.#template.category) return {"state": 3, "message": "This afk has no raiding category defined."};
        if (!this.#template.templateChannel) return {"state": 4, "message": "This afk has no raid template channel defined."};
        if (!this.#template.statusChannel) return {"state": 5, "message": "This afk has no raid status channel defined."};
        if (!this.#template.commandsChannel) return {"state": 6, "message": "This afk has no raid bot channel defined."};
        if (this.#template.commandsChannel != this.#channel.id) return {"state": 6, "message": "This afk can not be started in this raid bot channel."};
        if (!this.#template.activeChannel) return {"state": 7, "message": "This afk has no active channels channel defined."};
        if (!this.#template.minStaffRole) return {"state": 8, "message": "This afk has no minimum staff role."};
        if (!this.#template.minViewRaiderRole) return {"state": 9, "message": "This afk has no minimum viewable raider role."};
        if (!this.#template.name) return {"state": 10, "message": "This afk has no name."};
        if (!this.#template.vcOptions) return {"state": 11, "message": "This afk has no vc option."};
        if (this.#template.vcOptions != 1 && this.#template.vcOptions != 2 && this.#template.vcOptions != 0) return {"state": 11, "message": "This afk has no valid vc option."};
        if (!this.#template.startDelay) return {"state": 12, "message": "This afk has no start delay."};
        if (!this.#template.phases) return {"state": 13, "message": "This afk has no phases."};
        if (!this.#template.cap) return {"state": 14, "message": "This afk has no cap."};
        if (!this.#template.body) return {"state": 15, "message": "This afk has no body."};
        let phases = Array.from({length: this.#template.phases},(_,k)=>k+1)
        if (!phases.every(k => this.#template.body.hasOwnProperty(k)) && !this.#template.body.default) return {"state": 15, "message": "This afk has no default body or not every phase is defined."};
        this.parseBody()
        if (phases.some((i) => !this.#template.body[i] || ! this.#template.body[i].vcState || !this.#template.body[i].timeLimit || !this.#template.body[i].embed)) return {"state": 15, "message": `This afk has no body for phase ${i}`}
        for (let i in this.#template.buttons) {
            if (!this.#template.buttons[i]) return {"state": 16, "message": `This afk has no definition for button ${i}`};
            if (!this.#template.buttons[i].type) return {"state": 16, "message": `This afk has no type for button ${i}`};
            if (!this.#template.buttons[i].start) return {"state": 16, "message": `This afk has no start phase for button ${i}`};
            if (!this.#template.buttons[i].lifetime) return {"state": 16, "message": `This afk has no lifetime for button ${i}`};

        }
        for (let i in this.#template.reacts) {
            if (!this.#template.reacts[i]) return {"state": 17, "message": `This afk has no definition for react ${i}`};
            if (!this.#template.reacts[i].emote) return {"state": 17, "message": `This afk has no emote for react ${i}`};
            if (!this.#template.reacts[i].start) return {"state": 17, "message": `This afk has no start phase for react ${i}`};
            if (!this.#template.reacts[i].lifetime) return {"state": 17, "message": `This afk has no lifetime for react ${i}`};
        }
        return {"state": 0};
    }

    parseObject(template, parentTemplate) {
        for (let i in parentTemplate) {
            if (template[i] == undefined || template[i] == null) template[i] = parentTemplate[i]
            else if (typeof (template[i]) == "object" && template[i] != null && typeof (parentTemplate[i]) == "object" && parentTemplate[i] != null) {
                if (Array.isArray(template[i])) template[i] = [...new Set([...parentTemplate[i], ...template[i]])]
                else template[i] = Object.assign({}, parentTemplate[i], template[i])
                this.parseObject(template[i], parentTemplate[i])
            }
        }
    }

    parseInherit() {
        let parentTemplate = null
        this.#template.inherits.forEach((parent) => {
            let currentParentTemplate = templates[this.#guild.id].defaults[parent]
            if (currentParentTemplate && currentParentTemplate.commandsChannel == this.#channel.id) parentTemplate = currentParentTemplate
        });
        this.parseObject(this.#template, parentTemplate)
    }

    parseBody() {
        let phases = Array.from({length: this.#template.phases},(_,k)=>k+1)
        for (let i in phases) {
            if (this.#template.body[i] == undefined) this.#template.body[i] = this.#template.body.default
            else this.parseObject(this.#template.body[i], this.#template.body.default)
        }
    }

    populateParameters() {
        this.pingRoles = this.#template.pingRoles.map(role => (role == 'here') ? '@here' : this.#guild.roles.cache.get(this.#botSettings.roles[role]))
        this.perkRoles = this.#botSettings.lists.perkRoles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role]))
        this.minimumViewRaiderRole = this.#guild.roles.cache.get(this.#botSettings.roles[this.#template.minViewRaiderRole])
        this.minimumJoinRaiderRole = this.#template.minJoinRaiderRole ? this.#guild.roles.cache.get(this.#botSettings.roles[this.#template.minJoinRaiderRole]) : this.minimumViewRaiderRole
        this.minimumStaffRole = this.#guild.roles.cache.get(this.#botSettings.roles[this.#template.minStaffRole])
        this.raidInfoChannel = this.#guild.channels.cache.get(this.#botSettings.channels.runlogs)
        this.raidCategory = this.#template.category
        this.raidPartnerStatusChannels = this.#template.partneredStatusChannels // TODO: Implement this
        this.raidTemplateChannel = this.#guild.channels.cache.get(this.#template.templateChannel)
        this.raidStatusChannel = this.#guild.channels.cache.get(this.#template.statusChannel)
        this.raidCommandChannel = this.#guild.channels.cache.get(this.#template.commandsChannel)
        this.raidActiveChannel = this.#guild.channels.cache.get(this.#template.activeChannel)
        this.name = this.#template.name
        this.vcOptions = this.#template.vcOptions
        this.startDelay = this.#template.startDelay
        this.cap = this.#template.cap
        this.phases = this.#template.phases
        this.body = this.#template.body
        this.buttons = this.#template.buttons
        this.reacts = this.#template.reacts
    }

    populateBody(channel) {
        let phases = Array.from({length: this.#template.phases},(_,k)=>k+1)
        let lastDescription = ""
        for (let i in phases) {
            if (i == "default") continue
            if (!this.body[i].embed.description) {
                this.body[i].embed.description = ""
                if (this.vcOptions == 1 || this.vcOptions == 2) this.body[i].embed.description += `To join **click here** ${channel}\n`
                else if (this.vcOptions == 0) this.#template.body[i].embed.description += `To join, react for location\n`
                let emotes = []
                let supporter = null
                for (let j in this.buttons) {
                    let start = this.buttons[j].start
                    let end = this.buttons[j].lifetime == "forever" ? phases[-1] + 1 : start + this.buttons[j].lifetime
                    if (i < this.buttons[j].start && i >= end ) continue
                    if (this.buttons[j].type == "Log") this.body[i].embed.description += `If you have a **${j}**, react with ${this.buttons[j].emote ? this.#bot.storedEmojis[this.buttons[j].emote].text : "the button"}\n`
                    if (this.buttons[j].type == "Normal" && this.buttons[j].emote) emotes.push(this.#bot.storedEmojis[this.buttons[j].emote].text)
                    if (this.buttons[j].type == "Supporter") supporter = this.#bot.storedEmojis[this.buttons[j].emote].text
                }
                if (emotes.length > 0) this.body[i].embed.description += `If you have an early react, react with ${emotes.join(" ")}\n`
                if (supporter) this.body[i].embed.description += `If you are a ${this.perkRoles.join("")}, react with ${supporter}\n`
            } else if (this.#template.body[i].embed.description == "") this.#template.body[i].embed.description = lastDescription
            else {
                this.body[i].embed.description = this.body[i].embed.description.match(/[^\[\]]*/g).map(match => {
                    let message = match
                    if (this.#guild.channels.cache.has(this.#botSettings.channels[match])) message = `<#${this.#botSettings.channels[match]}>`
                    if (this.#guild.roles.cache.has(this.#botSettings.roles[match])) message = `<@&${this.#botSettings.roles[match]}>`
                    if (match == '{voicechannel}') message = channel
                    return message
                }).reduce((a, b) => a + b)
                this.body[i].embed.description = this.body[i].embed.description.match(/[^\{\}]*/g).map(match => {
                    let message = match
                    if (this.#bot.storedEmojis[match]) message = `${this.#bot.storedEmojis[match].text}`
                    return message
                }).reduce((a, b) => a + b)
            }
        }
    }

    populateButtons(channel) {
        for (let i in this.buttons) {
            if (!this.buttons[i].disableStart) this.buttons[i].disableStart = this.buttons[i].start
            if (!this.buttons[i].confirmationMessage) continue
            this.buttons[i].confirmationMessage = this.buttons[i].confirmationMessage.match(/[^\[\]]*/g).map(match => {
                let message = match
                if (this.#guild.channels.cache.has(this.#botSettings.channels[match])) message = `<#${this.#botSettings.channels[match]}>`
                if (this.#guild.roles.cache.has(this.#botSettings.roles[match])) message = `<@&${this.#botSettings.roles[match]}>`
                if (match == '{voicechannel}') message = channel
                return message
            }).reduce((a, b) => a + b)
            this.buttons[i].confirmationMessage = this.buttons[i].confirmationMessage.match(/[^\{\}]*/g).map(match => {
                let message = match
                if (this.#bot.storedEmojis[match]) message = `${this.#bot.storedEmojis[match].text}`
                return message
            }).reduce((a, b) => a + b)
        }
    }

    updateButtonChoice(choices) {
        for (let i in this.buttons) if (choices.includes(i)) delete this.buttons[i]
    }

    getButtonChoice() {
        return this.buttons.filter((btn) => btn.choice == 0)
    }

    getState() {
        return this.#state;
    }
}

module.exports = { AfkTemplate }