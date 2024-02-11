const Discord = require('discord.js')
const fs = require('fs')
const ErrorLogger = require('../lib/logError')
const AfkTemplate = require('./afkTemplate.js')
const pointLogger = require('../lib/pointLogger')
const extensions = require(`../lib/extensions`)
const consumablePopTemplates = require(`../data/keypop.json`);
const popCommand = require('./pop.js');

class AfkButton {
    #displayName;
    #name;
    #type;
    #parent;
    #choice;
    #confirm;
    #confirmationMessage;
    #confirmationMedia;
    #location;
    #start;
    #lifetime;
    #disableStart
    #points;
    #emote;
    #minRole;
    #minStaffRoles
    #color;
    #logOptions;
    #isCap;

    constructor(botSettings, storedEmojis, guild, {points, disableStart, emote, minRole, minStaffRoles, confirmationMessage, color, logOptions, displayName, limit, name, type, parent, choice, confirm, location, confirmationMedia, start, lifetime, isCap, members, logged}) {
        // template
        this.#displayName = displayName;
        this.limit = limit;
        this.#name = name;
        this.#type = type;
        this.#parent = parent;
        this.#choice = choice;
        this.#confirm = confirm;
        this.#location = location;
        this.#confirmationMedia = confirmationMedia;
        this.#start = start;
        this.#lifetime = lifetime;

        // processButtons
        this.#points = typeof points == 'string' ? botSettings.points[points] : points ?? 0;
        this.#disableStart = disableStart || start;
        this.#emote = storedEmojis[emote];
        this.#minRole = guild.roles.cache.get(botSettings.roles[minRole]);
        this.#minStaffRoles = minStaffRoles && minStaffRoles.map(role => guild.roles.cache.get(botSettings.roles[role]));
        this.#confirmationMessage = confirmationMessage;
        this.#color = color in AfkTemplate.TemplateButtonColors ? color : Discord.ButtonStyle.Secondary;
        this.#logOptions = logOptions && Object.entries(logOptions).reduce((obj, [key, logOption]) => {
            obj[key] = {
                ...logOption,
                points: typeof logOption.points == 'string' ? botSettings.points[logOption.points] : logOption.points ?? 0,
                multiplier: typeof logOption.multiplier == 'string' ? botSettings.points[logOption.multiplier] : logOption.multiplier ?? 1,
            }
            return obj
        }, {});

        // reactable parameters
        this.members = members || [];
        this.logged = logged || 0;

        // capButtons
        this.#isCap = isCap === undefined ? this.limit === 0 : isCap
    }

    get name() { return this.#name }
    get type() { return this.#type }
    get confirm() { return this.#confirm }
    get confirmationMedia() { return this.#confirmationMedia }
    get confirmationMessage() { return this.#confirmationMessage }
    get location() { return this.#location }
    get points() { return this.#points }
    get emote() { return this.#emote }
    get minRole() { return this.#minRole }
    get logOptions() { return this.#logOptions }
    get isCap() { return this.#isCap }

    label() {
        return `${this.#displayName ? `${this.#name} ` : ``}${this.limit ? ` ${this.members.length}/${this.limit}` : ``}`
    }

    memberListLabel(isRequest) {
        return `${this.#emote ? this.#emote.text : ''} ${this.#name}${isRequest ? ' Request' : ''}${this.limit ? ` (${this.limit})` : ''}${this.#location ? ` \`L\`` : `` }`
    }

    isLogged() {
        return [AfkTemplate.TemplateButtonType.LOG, AfkTemplate.TemplateButtonType.LOG_SINGLE].includes(this.type)
    }

    present(phase) {
        const end = this.#start + this.#lifetime
        return (phase >= this.#start || phase >= this.#disableStart) && phase < end
    }

    disabled(phase) {
        return !!((this.#disableStart < this.#start && this.#start > phase)
            || (this.limit && this.members.length >= this.limit));
    }

    reactableButton(phase) {
        const button = new Discord.ButtonBuilder()
            .setStyle(this.#color)
            .setCustomId(this.#name)
            .setLabel(this.label())
            .setDisabled(this.disabled(phase))
        if (this.emote) button.setEmoji(this.emote.id)
        return button
    }

    memberList() {
        const emote = this.emote ? `${this.emote.text} ` : ``
        if (this.members.length == 0) {
            return "None!"
        } else {
            const memberString = this.members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            return memberString.length >= 1024 ? '*Too many users to process*' : memberString
        }
    }

    async choicePrompt(message, user) {
        if (this.#minStaffRoles && !this.#minStaffRoles.some(role => user.roles.cache.has(role.id))) return;
        const choiceText = this.emote ? `${this.emote.text} **${this.name}**` : `**${this.name}**`
        switch (this.#choice) {
            case AfkTemplate.TemplateButtonChoice.NO_CHOICE: return;
            case AfkTemplate.TemplateButtonChoice.YES_NO_CHOICE: {
                const text = `Do you want to add ${choiceText} reacts to this run?\n If no response is received, this run will use the default ${this.limit} ${choiceText}.`
                const confirmButton = new Discord.ButtonBuilder()
                    .setLabel('✅ Confirm')
                    .setStyle(Discord.ButtonStyle.Success)
                const cancelButton = new Discord.ButtonBuilder()
                const {value: confirmValue} = await message.confirmPanel(text, null, confirmButton, cancelButton, 30000, true)
                this.limit = (confirmValue == null || confirmValue) ? this.limit : 0
                break
            }
            case AfkTemplate.TemplateButtonChoice.NUMBER_CHOICE_PRESET: {
                const text = `How many ${choiceText} reacts do you want to add to this run?\n If no response is received, this run will use the default ${this.limit} ${choiceText}.`
                const confirmSelectMenu = new Discord.StringSelectMenuBuilder()
                    .setPlaceholder(`Number of ${this.name}s`)
                    .setOptions(
                        { label: '1', value: '1' },
                        { label: '2', value: '2' },
                        { label: '3', value: '3' },
                        { label: 'None', value: '0' },
                    )
                const {value: confirmValue} = await message.selectPanel(text, null, confirmSelectMenu, 30000, false, true)
                this.limit = Number.isInteger(parseInt(confirmValue)) ? parseInt(confirmValue) : this.limit
                break
            }
            case AfkTemplate.TemplateButtonChoice.NUMBER_CHOICE_CUSTOM: {
                const text = `How many ${choiceText} reacts do you want to add to this run?\n If no response is received, this run will use the default ${this.limit} ${choiceText}.`
                const confirmSelectMenu = new Discord.StringSelectMenuBuilder()
                    .setPlaceholder(`Number of ${this.name}s`)
                    .setOptions(
                        { label: '1', value: '1' },
                        { label: '2', value: '2' },
                        { label: '3', value: '3' },
                        { label: 'None', value: '0' },
                    )
                const {value: confirmValue} = await message.selectPanel(text, null, confirmSelectMenu, 30000, true, true)
                this.limit = Number.isInteger(parseInt(confirmValue)) ? parseInt(confirmValue) : this.limit
                break
            }
        }
    }

    confirmationDescription(descriptionMiddle) {
        const emote = this.emote ? `${this.emote.text} ` : ''
        const descriptionBeginning = `You reacted with ${emote}${this.#name}.`
        const descriptionEnd = 'Press ✅ to confirm your reaction. Otherwise press ❌'
        return `${descriptionBeginning}\n${descriptionMiddle}${descriptionEnd}`
    }

    toJSON() {
        return {
            name: this.#name,
            limit: this.limit,
            members: this.members,
            logged: this.logged,
            isCap: this.#isCap
        }
    }
}

class afkCheck {
    /**
     * @param {AfkTemplate.AfkTemplate} afkTemplate
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     * @param {Discord.Message} message
     * @param {String} location
     */
    #bot;
    #botSettings;
    #db;
    #afkTemplate;
    /** @type {Message} */
    #message;
    #guild;
    #channel;
    #leader;
    #raidID;
    #pointlogMid;
    #body = null;

    constructor(afkTemplate, bot, db, message, location, leader = message.member) {
        this.#bot = bot // bot
        this.#botSettings = bot.settings[message.guild.id] // bot settings
        this.#afkTemplate = afkTemplate // static AFK template
        this.#db = db // bot database
        this.#message = message // message of the afk
        this.#guild = message.guild // guild of the afk
        this.#channel = null // channel of the afk
        this.#leader = leader // leader of the afk
        this.#raidID = null // ID of the afk
        this.#pointlogMid = null

        this.members = [] // All members in the afk
        this.earlyLocationMembers = [] // All members with early location in the afk
        this.earlySlotMembers = [] // All members with early slots in the afk
        this.buttons = afkTemplate.buttons.map(button => new AfkButton(this.#botSettings, this.#bot.storedEmojis, this.#guild, button))
        this.reactRequests = {} // {messageId => AfkButton}
        this.cap = afkTemplate.cap

        this.location = location // Location of the afk
        this.singleUseHotfixStopTimersDontUseThisAnywhereElse = false // DO NOT USE THIS. ITS A HOTFIX. https://canary.discord.com/channels/343704644712923138/706670131115196588/1142549685719027822
        // Phase 0 is a special case, before start delay has expired
        this.phase = this.#afkTemplate.startDelay > 0 ? 0 : 1 // Current phase of the afk
        this.timer = null // End time of the current phase of the AFK (Date)
        this.completes = 0 // Number of times the afk has been completed
        this.logging = false // Whether logging is active
        this.ended_by = null

        this.raidStatusMessage = null // raid status message
        this.raidStatusInteractionHandler = null // raid status interaction handler
        this.raidCommandsMessage = null // raid commands message
        this.raidInfoMessage = null // raid info message
        this.raidCommandsInteractionHandler = null // raid commands interaction handler
        this.raidChannelsMessage = null // raid channels message
        this.raidChannelsInteractionHandler = null // raid channels interaction handler
    }

    get active() {
        return !(this.ended_by || this.aborted_by || this.deleted_by)
    }

    get vcLounge() {
        return this.#guild.channels.cache.get(this.#botSettings.voice.lounge)
    }

    get guild() { return this.#guild }

    get vcOptions() { return this.#afkTemplate.vcOptions }


    get channel() { return this.#channel }
    
    // needed for parsemembers
    get afkTemplateName() { return this.#afkTemplate.templateName }

    isVcless() { return this.vcOptions == AfkTemplate.TemplateVCOptions.NO_VC }

    raidLeaderDisplayName() {
        return this.#leader.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
    }

    afkTitle() {
        return `${this.raidLeaderDisplayName()}'s ${this.#afkTemplate.name}`
    }

    #pingText() {
        return this.#afkTemplate.pingRoles ? `${this.#afkTemplate.pingRoles.join(' ')}, ` : ``
    }

    /**
     * 
     * @param {Message?} panelReply - if this is from a headcount, should reply to the panel
     */
    async start(panelReply) {
        if (this.phase === 0) this.phase = 1
        this.timer = new Date(Date.now() + (this.#body[this.phase].timeLimit * 1000))
        this.#bot.afkModules[this.#raidID] = this
        await Promise.all([this.sendStatusMessage(), this.sendCommandsMessage(panelReply), this.sendChannelsMessage()])
        this.startTimers()
        this.saveBotAfkCheck()
    }

    get flag() {
        return this.location ? {'us': ':flag_us:', 'eu': ':flag_eu:'}[this.location.toLowerCase().substring(0, 2)] : ''
    }
    
    saveBotAfkCheck(deleteCheck = false) {
        if (deleteCheck) {
            delete this.#bot.afkChecks[this.#raidID]
            delete this.#bot.afkModules[this.#raidID]
        }
        else {
            this.#bot.afkChecks[this.#raidID] = {
                afkTemplateName: this.afkTemplateName,
                message: this.#message,
                guild: this.#guild,
                channel: this.#channel,
                leader: this.#leader,
                raidID: this.#raidID,
                members: this.members,
                earlyLocationMembers: this.earlyLocationMembers,
                earlySlotMembers: this.earlySlotMembers,
                buttons: this.buttons.map(button => button.toJSON()),
                reactRequests: Object.fromEntries(Object.entries(this.reactRequests).map(([messageId, button]) => [messageId, {name: button.name, ...button.toJSON()}])),
                body: this.#body,
                
                cap: this.cap,
                time: Date.now(),
                location: this.location,
                phase: this.phase,
                timer: this.timer.getTime(),
                completes: this.completes,
                ended_by_id: this.ended_by?.id,
                aborted_by: this.aborted_by,
                deleted_by: this.deleted_by,

                raidStatusMessage: this.raidStatusMessage,
                raidCommandsMessage: this.raidCommandsMessage,
                pointlogMid: this.#pointlogMid,
                raidInfoMessage: this.raidInfoMessage,
                raidChannelsMessage: this.raidChannelsMessage,
            }
        }
        fs.writeFileSync('./data/afkChecks.json', JSON.stringify(this.#bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.#bot, this.#guild) })
    }

    async loadBotAfkCheck(storedAfkCheck) {
        this.#channel = storedAfkCheck.channel ? this.#guild.channels.cache.get(storedAfkCheck.channel.id) : null
        this.#raidID = storedAfkCheck.raidID

        this.members = storedAfkCheck.members
        this.earlyLocationMembers = storedAfkCheck.earlyLocationMembers
        this.earlySlotMembers = storedAfkCheck.earlySlotMembers
        this.buttons = storedAfkCheck.buttons.map(button => new AfkButton(this.#botSettings, this.#bot.storedEmojis, this.#guild, {...this.#afkTemplate.getButton(button.name), ...button}))
        this.reactRequests = Object.fromEntries(Object.entries(storedAfkCheck.reactRequests).map(([messageId, button]) => [messageId, new AfkButton(this.#botSettings, this.#bot.storedEmojis, this.#guild, {...this.#afkTemplate.getButton(button.name), ...button})]))
        this.#body = storedAfkCheck.body

        this.cap = storedAfkCheck.cap
        this.location = storedAfkCheck.location
        this.phase = storedAfkCheck.phase
        this.timer = new Date(storedAfkCheck.timer)
        this.completes = storedAfkCheck.completes
        this.ended_by = this.#guild.members.cache.get(storedAfkCheck.ended_by_id)
         // deleted or aborted afk checks are not saved in the json
        this.deleted_by = null
        this.aborted_by = null

        this.raidStatusMessage = await this.#afkTemplate.raidStatusChannel.messages.fetch(storedAfkCheck.raidStatusMessage.id)
        this.raidCommandsMessage = await this.#afkTemplate.raidCommandChannel.messages.fetch(storedAfkCheck.raidCommandsMessage.id)
        this.raidInfoMessage = await this.#afkTemplate.raidInfoChannel.messages.fetch(storedAfkCheck.raidInfoMessage.id)
        this.raidChannelsMessage = await this.#afkTemplate.raidActiveChannel.messages.fetch(storedAfkCheck.raidChannelsMessage.id)

        this.#pointlogMid = storedAfkCheck.pointlogMid

        if (this.phase <= this.#afkTemplate.phases && !this.ended_by) this.start()
        else {
            this.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
            this.raidCommandsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidCommandsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidCommandsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
            this.raidChannelsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidChannelsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidChannelsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
            this.saveBotAfkCheck()
            if (this.active) this.postAfk(null)
        }
    }

    async createChannel() {
        if (this.#afkTemplate.vcOptions == AfkTemplate.TemplateVCOptions.NO_VC) return
        else if (this.#afkTemplate.vcOptions == AfkTemplate.TemplateVCOptions.STATIC_VC) return this.#channel = this.#leader.voice.channel
        let channel = await this.#afkTemplate.raidTemplateChannel.clone({
            name: this.afkTitle(),
            parent: this.#afkTemplate.raidCategory.id,
            userLimit: this.cap,
            position: 0
        })
        await this.#leader.voice.setChannel(channel).catch(er => {})
        for (let minimumViewRaiderRole of this.#afkTemplate.minimumViewRaiderRoles) await channel.permissionOverwrites.edit(minimumViewRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await channel.permissionOverwrites.edit(this.#leader.id, { Connect: true, ViewChannel: true, Speak: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        this.#channel = channel
    }

    async sendButtonChoices() {
        for (const [buttonIdx, button] of this.buttons.entries()) {
            await button.choicePrompt(this.#message, this.#leader);
            if (button.limit == 0 && button.choice != AfkTemplate.TemplateButtonChoice.NO_CHOICE) this.buttons.splice(buttonIdx, 1)
        }
    }

    startTimers() {
        if (this.#channel) this.moveInEarlysTimer = setInterval(() => this.moveInEarlys(), 10000)
        let updatePanelTimer = setInterval((updatePanelTimer) => this.updatePanel(updatePanelTimer), 5000)
        this.updatePanelTimer = updatePanelTimer
    }

    async moveInEarlys() {
        for (let i of this.earlySlotMembers) {
            let member = this.#guild.members.cache.get(i)
            if (!member.voice.channel) continue
            if (member.voice.channel.name.includes('lounge') || member.voice.channel.name.includes('Lounge') || member.voice.channel.name.includes('drag')) await member.voice.setChannel(this.#channel.id).catch(er => { })
        }
    }

    #timerSecondsRemaining() {
        return Math.round((this.timer - new Date()) / 1000)
    }

    async updatePanel(timer) {
        if (this.singleUseHotfixStopTimersDontUseThisAnywhereElse) return clearInterval(timer)
        const secondsRemaining = this.#timerSecondsRemaining()
        if (secondsRemaining <= 0) return this.processPhaseNext()
        if (!this.raidStatusMessage) return
        let reactables = this.getReactables(this.phase)
        let components = reactables.concat(this.getPhaseControls(this.phase))
        await Promise.all([
            this.raidStatusMessage?.edit({ embeds: [this.#genRaidStatusEmbed()], components: components }),
            this.raidCommandsMessage?.edit(this.#genRaidCommands()),
            this.raidInfoMessage?.edit(this.#genRaidInfo()),
            this.raidChannelsMessage?.edit(this.#genRaidChannels())
        ].filter(i => i))
    }

    #genEmbedFooter() {
        if (this.aborted_by) return { text: `${this.#guild.name} • Aborted by ${this.aborted_by.nickname}`, iconURL: this.#guild.iconURL() }
        if (this.deleted_by) return { text: `${this.#guild.name} • Deleted by ${this.deleted_by.nickname}`, iconURL: this.#guild.iconURL() }
        if (this.ended_by) return { text: `${this.#guild.name} • Ended by ${this.ended_by.nickname}`, iconURL: this.#guild.iconURL() }

        const secondsRemaining = this.#timerSecondsRemaining()
        return { text: `${this.#guild.name} • ${Math.floor(secondsRemaining / 60)} Minutes and ${secondsRemaining % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() }
    }

    #genEmbedBase() {
        return new Discord.EmbedBuilder()
            .setAuthor({ name: `AFK for ${this.#afkTemplate.name} by ${this.raidLeaderDisplayName()}`, iconURL: this.#leader.user.avatarURL() })
            .setColor(this.#body[this.phase || 1].embed.color ? this.#body[this.phase || 1].embed.color : '#ffffff')
            .setTimestamp(Date.now())
    }

    #genRaidStatusEmbed() {
        const afkTemplateBody = this.#body[this.phase || 1]
        const embed = this.#genEmbedBase()

        // This RNG might need to get fixed or it will change every time the embed is generated
        if (afkTemplateBody.embed.thumbnail) embed.setThumbnail(afkTemplateBody.embed.thumbnail[Math.floor(Math.random()*afkTemplateBody.embed.thumbnail.length)])

        if (this.phase == 0) {
            embed.setDescription(`\`${this.#afkTemplate.name}\`${this.flag ? ` in (${this.flag})` : ''} will begin in ${Math.round(this.#afkTemplate.startDelay)} seconds. Be prepared to join the raid.`)
            embed.setFooter({ text: this.#guild.name, iconURL: this.#guild.iconURL() })
        } else {
            if (!(this.aborted_by || this.deleted_by) && afkTemplateBody.embed.image) embed.setImage(this.#botSettings.strings[afkTemplateBody.embed.image] ? this.#botSettings.strings[afkTemplateBody.embed.image] : afkTemplateBody.embed.image)

            if (this.aborted_by) {
                embed.setDescription(`This afk check has been aborted`)
            } else if (this.ended_by) {
                embed.setDescription(`This afk check has been ended.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` If you get disconnected during the run, **JOIN LOUNGE** *then* press the huge **RECONNECT** button` : ``}`)
            } else {
                embed.setDescription(afkTemplateBody.embed.description)
            }
            embed.setFooter(this.#genEmbedFooter())
        }

        return embed
    }

    #genRaidStatus() {
        let components = this.getReactables(this.phase).concat(this.getPhaseControls(this.phase))
        if (this.aborted_by || this.deleted_by) components = []
        else if (this.ended_by) components = this.addReconnectButton()
        return { embeds: [this.#genRaidStatusEmbed()], components }
    }

    #genRaidCommandsEmbed() {
        const embed = this.#genEmbedBase()
        embed.setDescription(`**Raid Leader: ${this.#leader} \`\`${this.#leader.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.location}\`\` ${this.flag ? ` in (${this.flag})` : ''}`)
        embed.setFooter(this.#genEmbedFooter())

        for (const button of this.buttons) {
            embed.addFields({ name: button.memberListLabel(false), value: button.memberList(), inline: true })
        }

        for (const button of Object.values(this.reactRequests)) {
            embed.addFields({ name: button.memberListLabel(true), value: button.memberList(), inline: true })
        }

        return embed
    }

    #genRaidCommands() {
        let components = this.getPhaseControls()
        if (this.aborted_by || this.deleted_by) components = []
        else if (this.ended_by) components = this.addDeleteandLoggingButtons()
        return { embeds: [this.#genRaidCommandsEmbed()], components }
    }

    #genRaidInfoEmbed() {
        const embed = this.#genRaidCommandsEmbed()
        if (this.ended_by) {
            if (this.#pointlogMid) embed.addFields({ name: 'Points Log MID', value: this.#pointlogMid })

            let raiders_text = `Raiders`
            let raiders_value = `None!`
            this.members.forEach(m => {
                if (raiders_value.length >= 1000) {
                    embed.addFields({ name: raiders_text, value: raiders_value })
                    raiders_text = `-`
                    raiders_value = `, <@!${m}>`
                } else raiders_value == 'None!' ? raiders_value = `<@!${m}>` : raiders_value += `, <@!${m}>`
            })
            embed.addFields({ name: raiders_text, value: raiders_value })
        }
        return embed
    }

    #genRaidInfo() {
        return { embeds: [this.#genRaidInfoEmbed()] }
    }

    #genRaidChannelsEmbed() {
        const embed = this.#genEmbedBase()
        if (this.getLoggingText()) embed.addFields({ name: `Logging Info`, value: this.getLoggingText(), inline: false })
        embed.setDescription(`**Raid Leader: ${this.#leader} \`\`${this.#leader.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.location}\`\` ${this.flag ? ` in (${this.flag})` : ''}\n\nWhenever the run is over. Click the button to delete the channel.`)
        embed.setFooter(this.#genEmbedFooter())
        return embed
    }

    #genRaidChannels() {
        let components = this.getPhaseControls()
        if (!this.active) components = this.addDeleteandLoggingButtons()

        return { content: `${this.#leader}`, embeds: [this.#genRaidChannelsEmbed()], components }
    }

    async sendInitialStatusMessage(replyTo) {
        this.#body = this.#afkTemplate.processBody(this.#channel)
        
        const raidStatusMessageContents = {
            content: `${this.#pingText()}**${this.#afkTemplate.name}** ${this.flag ? ` (${this.flag})` : ''} by ${this.#leader} is starting inside of **${this.#guild.name}**${this.#channel ? ` in ${this.#channel}` : ``}`,
            embeds: [this.#afkTemplate.startDelay > 0 ? this.#genRaidStatusEmbed() : null]
        };
        [this.raidStatusMessage] = await Promise.all([
            replyTo?.reply(raidStatusMessageContents) || this.#afkTemplate.raidStatusChannel.send(raidStatusMessageContents),
            this.#body[1].message && this.#afkTemplate.raidStatusChannel.send({ content: `${this.#body[1].message} in 5 seconds...` }).then(msg => setTimeout(async () => await msg.delete(), 5000)),
            ...Object.values(this.#afkTemplate.raidPartneredStatusChannels).map(channel => channel.send({ content: `**${this.#afkTemplate.name}** is starting inside of **${this.#guild.name}**${this.#channel ? ` in ${this.#channel}` : ``}` }))
        ])

        this.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
        this.#raidID = this.raidStatusMessage.id
    }

    async sendStatusMessage() {
        this.raidStatusMessage = await this.raidStatusMessage.edit({ content: `${this.#pingText()}**${this.#afkTemplate.name}** ${this.flag ? ` (${this.flag})` : ''}`, ...this.#genRaidStatus() })
        
        if (!this.raidStatusInteractionHandler) {
            this.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
        }

        for (let i in this.#afkTemplate.reacts) {
            let start = this.#afkTemplate.reacts[i].start
            let end = start + this.#afkTemplate.reacts[i].lifetime
            if (start > this.phase) continue
            if (end <= this.phase) {
                await this.raidStatusMessage.reactions.cache.get(this.#afkTemplate.reacts[i].emote.id).remove()
                continue
            }
            await this.raidStatusMessage.react(this.#afkTemplate.reacts[i].emote.id)
        }
    }

    async sendCommandsMessage(panel) {
        const raidCommandsMessageContents = this.#genRaidCommands()
        const raidInfoMessageContents = this.#genRaidInfo();
        [
            this.raidCommandsMessage,
            this.raidInfoMessage
        ] = await Promise.all([
            this.raidCommandsMessage?.edit(raidCommandsMessageContents) || panel?.reply(raidCommandsMessageContents) || this.#afkTemplate.raidCommandChannel.send(raidCommandsMessageContents),
            this.raidInfoMessage?.edit(raidInfoMessageContents) || this.#afkTemplate.raidInfoChannel.send(raidInfoMessageContents)
        ])
        
        if (!this.raidCommandsInteractionHandler) {
            this.raidCommandsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidCommandsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidCommandsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
    }

    async sendChannelsMessage() {
        const raidChannelsMessageContents = this.#genRaidChannels()
        this.raidChannelsMessage = await (this.raidChannelsMessage?.edit(raidChannelsMessageContents) || this.#afkTemplate.raidActiveChannel.send(raidChannelsMessageContents))
       
        if (!this.raidChannelsInteractionHandler) {
            this.raidChannelsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidChannelsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidChannelsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
    }

    getPhaseControls() {
        const components = []
        const phaseActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel(`✅ ${this.#body[this.phase].nextPhaseButton ? `${this.#body[this.phase].nextPhaseButton}` : `Phase ${this.phase}`}`)
                .setStyle(3)
                .setCustomId(`phase`),
            new Discord.ButtonBuilder()
                .setLabel('❌ Abort')
                .setStyle(4)
                .setCustomId(`abort`)
        ])
        if (this.#afkTemplate.capButton) phaseActionRow.addComponents([
            new Discord.ButtonBuilder()
                .setLabel(`🔒 Set Cap`)
                .setStyle(2)
                .setCustomId(`cap`)
        ])
        components.push(phaseActionRow)
        return components
    }

    getReactables() {
        const components = []
        let reactablesActionRow = []
        let counter = 0
        for (const button of this.buttons) {
            if (!button.present(this.phase)) continue
            if (button.isCap) button.limit = this.cap
            reactablesActionRow.push(button.reactableButton(this.phase))
            counter ++
            if (counter == 5) {
                counter = 0
                const component = new Discord.ActionRowBuilder({ components: reactablesActionRow })
                components.push(component)
                reactablesActionRow = []
            }
        }
        if (counter != 0) {
            const component = new Discord.ActionRowBuilder({ components: reactablesActionRow })
            components.push(component)
        }
        return components
    }

    getLoggingText() {
        const loggingMessages = []
        if (this.#botSettings.backend.allowAdditionalCompletes) loggingMessages.push(`Completes: \`${this.completes}\``)
        loggingMessages.push(...this.buttons.filter(button => button.isLogged()).map(button => {
            const emote = button.emote ? `${button.emote.text} ` : ``
            return `${emote}${button.name} Logged: \`${button.logged}\``
        }))
        return loggingMessages.join('\n')
    }

    getButton(buttonName) {
        return this.buttons.find(button => button.name === buttonName)
    }

    #reactionIsFull(button) {
        return (button.limit && button.members.length >= button.limit)
            || (button.parent && button.parent.some(i => this.getButton(i).members.length >= this.getButton(i).limit))
    }

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     */
    async interactionHandler(interaction) {
        if (!interaction.isButton()) return

        const isReactRequestInteraction = interaction.message.id !== this.raidStatusMessage.id
        const button = isReactRequestInteraction ? this.reactRequests[interaction.message.id] : this.getButton(interaction.customId)
        if (button) {
            const emote = button.emote ? `${button.emote.text} ` : ``

            if (button.minRole && !interaction.member.roles.cache.has(button.minRole.id)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have the required role ${button.minRole} to react to this run.`, null)], ephemeral: true })
            }
            if (button.members.includes(interaction.member.id)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId}. Try another react or try again next run.`, null)], ephemeral: true })
            }
            if (isReactRequestInteraction && this.getButton(button.name).members.includes(interaction.member.id)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId}. Try another react or try again next run.`, null)], ephemeral: true })
            }
            if (this.#reactionIsFull(button)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for that. Try another react or try again next run.`, null)], ephemeral: true })
            }

            let confirmInteraction = false
            switch (button.type) {
                case AfkTemplate.TemplateButtonType.LOG:
                case AfkTemplate.TemplateButtonType.LOG_SINGLE:
                case AfkTemplate.TemplateButtonType.NORMAL:
                    confirmInteraction = await this.processReactableNormal(interaction, button)
                    break
                case AfkTemplate.TemplateButtonType.SUPPORTER:
                    confirmInteraction = await this.processReactableSupporter(interaction, button)
                    break
                case AfkTemplate.TemplateButtonType.POINTS:
                    confirmInteraction = await this.processReactablePoints(interaction, button)
                    break
            }

            if (!confirmInteraction) return

            if (this.#reactionIsFull(button)) {
                return await confirmInteraction.reply({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for that. Try another react or try again next run.`, null)], ephemeral: true })
            }

            if (button.members.includes(interaction.member.id)) {
                return await confirmInteraction.reply({ embeds: [extensions.createEmbed(interaction, `You have already been confirmed for this reaction`, null)], ephemeral: true })
            }

            button.members.push(interaction.member.id)

            await this.reactableSendLoc(confirmInteraction, button.location || button.parent?.some(parent => this.getButton(parent)?.location))

            if (button.parent) {
                for (let i of button.parent) {
                    const parentButton = this.getButton(i);
                    if (!parentButton.members.includes(interaction.member.id)) parentButton.members.push(interaction.member.id)
                    if (parentButton.location && !this.earlyLocationMembers.includes(interaction.member.id)) this.earlyLocationMembers.push(interaction.member.id)
                }
            }
            if (!this.earlySlotMembers.includes(interaction.member.id)) this.earlySlotMembers.push(interaction.member.id)
            if (button.location && !this.earlyLocationMembers.includes(interaction.member.id)) this.earlyLocationMembers.push(interaction.member.id)
            await Promise.all([
                this.raidCommandsMessage.edit(this.#genRaidCommands(), this.#bot, this.#guild),
                this.raidInfoMessage.edit(this.#genRaidInfo())
            ])
            return
        }
        else if (['abort', 'phase', 'cap', 'additional', 'end'].includes(interaction.customId) || interaction.customId.startsWith('log ')) {
            if (this.#afkTemplate.minimumStaffRoles.some(roles => roles.every(role => interaction.member.roles.cache.has(role.id)))) return await this.processPhaseControl(interaction)
            else {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have the required Staff Role to use this button.`, null)], ephemeral: true })
            }
        } else if (interaction.customId == 'reconnect') {
            return await this.processReconnect(interaction)
        } else {
            return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `How did you press something that's unpressable? ඞ.`, null)], ephemeral: true })
        }
    }

    async processPhaseControl(interaction) {
        switch (interaction.customId) {
            case "abort":
                await this.processPhaseAbort(interaction)
                break
            case "phase":
                await this.processPhaseNext(interaction)
                break
            case "cap":
                await this.processPhaseCap(interaction)
                break
            case "additional":
                await this.processPhaseAdditional(interaction)
                break
            case "end":
                await this.processPhaseEnd(interaction)
                break
            default:
                if (interaction.customId.startsWith('log ')) await this.processPhaseLog(interaction)
                break
        }
    }

    async processPhaseAbort(interaction) {
        const text = `Are you sure you want to abort this run?`
        const confirmButton = new Discord.ButtonBuilder()
            .setLabel('❌ Abort')
            .setStyle(Discord.ButtonStyle.Secondary)
        const cancelButton = new Discord.ButtonBuilder()
        const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, null, confirmButton, cancelButton, 10000, true)
        if (!subInteraction) return await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })
        else if (!confirmValue) return await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
        else await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully aborted the run. You can dismiss this message.`, null)],  components: [] })
        this.raidStatusInteractionHandler.stop()
        this.raidCommandsInteractionHandler.stop()
        this.raidChannelsInteractionHandler.stop()

        if (this.moveInEarlysTimer) clearInterval(this.moveInEarlysTimer)
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)
        if (this.#channel) await this.#channel.delete()
        
        this.aborted_by = this.#guild.members.cache.get(interaction.member.id)

        this.raidStatusMessage.reactions.removeAll()
        await Promise.all([
            this.raidStatusMessage.edit({ content: null, ...this.#genRaidStatus() }),
            this.raidCommandsMessage.edit(this.#genRaidCommands()),
            this.raidInfoMessage.edit(this.#genRaidInfo()),
            this.raidChannelsMessage.delete()
        ])
        
        this.saveBotAfkCheck(true)
    }

    async processPhaseNext(interaction) {
        if (interaction && interaction.member != this.#leader) {
            const text = `Are you sure you want to move to the next phase in this run?`
            const confirmButton = new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
            let confirmValue, subInteraction;
            [interaction, {value: confirmValue, interaction: subInteraction}] = await Promise.all([interaction.deferUpdate(), interaction.confirmPanel(text, null, confirmButton, cancelButton, 10000, true)])
            if (!subInteraction) return await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })
            else if (!confirmValue) return await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
            else subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully moved to the next phase of the run. You can dismiss this message.`, null)], components: [] })
        }
        
        if (this.phase >= this.#afkTemplate.phases) return this.postAfk(interaction)

        this.phase += 1
        this.timer = new Date(Date.now() + (this.#body[this.phase].timeLimit * 1000))
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)

        const [tempRaidStatusMessage] = await Promise.all([
            this.#body[this.phase].message && this.#afkTemplate.raidStatusChannel.send({ content: `${this.#body[this.phase].message} in 5 seconds...` }),
            (interaction?.message.id == this.raidStatusMessage   ? interaction.editButtons({ disabled: true }) : this.raidStatusMessage.editButtons({ disabled: true })),
            (interaction?.message.id == this.raidCommandsMessage ? interaction.editButtons({ disabled: true }) : this.raidCommandsMessage.editButtons({ disabled: true })),
            (interaction?.message.id == this.raidChannelsMessage ? interaction.editButtons({ disabled: true }) : this.raidChannelsMessage.editButtons({ disabled: true }))
        ])

        setTimeout(async () => {
            if (this.#body[this.phase].vcState == AfkTemplate.TemplateVCState.OPEN && this.#channel) for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: true, ViewChannel: true })
            else if (this.#body[this.phase].vcState == AfkTemplate.TemplateVCState.LOCKED && this.#channel) for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true })
            await Promise.all([this.sendStatusMessage(), this.sendCommandsMessage(), this.sendChannelsMessage()])
            if (this.phase <= this.#afkTemplate.phases) {
                let updatePanelTimer = setInterval((updatePanelTimer) => this.updatePanel(updatePanelTimer), 5000)
                this.updatePanelTimer = updatePanelTimer
            }
            this.saveBotAfkCheck()
        }, 5000)
        setTimeout(async () => { if (tempRaidStatusMessage) await tempRaidStatusMessage.delete() }, 5000)
    }

    async processPhaseCap(interaction) {
        const text = `What is the cap you want for this run?`
        const confirmNumberMenu = new Discord.StringSelectMenuBuilder()
            .setPlaceholder(`Number of Members`)
            .setOptions(
                { label: '1', value: '1' },
                { label: '2', value: '2' },
                { label: '3', value: '3' },
                { label: 'None', value: '0' },
            )
        const {value: confirmNumberValue, interaction: subInteraction} = await interaction.selectPanel(text, null, confirmNumberMenu, 30000, true, true)
        const number = Number.isInteger(parseInt(confirmNumberValue)) ? parseInt(confirmNumberValue) : null
        if (!subInteraction) return await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })
        else if (!number) return await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled or Invalid Cap. You can dismiss this message.`, null)], components: [] })
        else await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully set the cap to ${number}. You can dismiss this message.`, null)], components: [] })
        this.cap = number
        if (this.#channel) this.#channel.setUserLimit(this.cap)
        this.updatePanel()
    }

    async processPhaseAdditional(interaction) {
        if (this.logging) return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already logged an additional complete recently. Please wait and try again!`, null)], ephemeral: true })
        const text = `Are you sure you want to log an additional complete to all members of this run?`
        const confirmButton = new Discord.ButtonBuilder()
            .setLabel('Log Additional Complete')
            .setStyle(Discord.ButtonStyle.Secondary)
        const cancelButton = new Discord.ButtonBuilder()
        const {value: confirmValue, interaction: logCompleteInteraction} = await interaction.confirmPanel(text, null, confirmButton, cancelButton, 10000, true)
        if (!logCompleteInteraction) return await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })   
        else if (!confirmValue) return await logCompleteInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
        else await logCompleteInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully logged an additional complete to all members of the run. You can dismiss this message.`, null)], components: [] })
        this.logging = true
        this.completes++
        await this.raidChannelsMessage.edit(this.#genRaidChannels())
        setTimeout(this.loggingAfk.bind(this), 60000)
    }

    #lookupGuildMember(name) {
        return this.#guild.members.cache.get(name) || this.#guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(name.toLowerCase()))
    }

    async #keyNameInputPrompt(i) {
        await i.showModal(
            new Discord.ModalBuilder()
                .setTitle("Whose key are you logging?")
                .setCustomId('keynamemodal')
                .addComponents(
                    new Discord.ActionRowBuilder().addComponents(
                        new Discord.TextInputBuilder()
                            .setLabel('Key Name')
                            .setCustomId('keyname')
                            .setStyle(Discord.TextInputStyle.Short)
                    )
                )
        )
        let keyNameResp
        try {
            keyNameResp = await i.awaitModalSubmit({time: 600_000})
        } catch(e) {
            if (e.code == 'InteractionCollectorError') return [undefined, i]
            throw e
        }
        const newMemberName = keyNameResp.fields.getField('keyname').value
        const newMember = this.#lookupGuildMember(newMemberName)
        if (!newMember) return [undefined, keyNameResp.reply({content: `Invalid username: ${newMemberName}`, ephemeral: true})]
        return [newMember, keyNameResp]
    }

    async processPhaseLog(interaction, modded) {
        const buttonName = interaction.customId.split(' ').slice(2).join(' ')
        const buttonType = interaction.customId.split(' ')[1]
        const button = this.getButton(buttonName)

        let member = null
        let number = 1
        let logOption = button.logOptions[interaction.customId.split(' ')[1]]
        let isModded = interaction.customId.split(' ')[1] == 'Modded'
        let choiceText = button.emote ? `${button.emote.text} **${buttonType} ${buttonName}**` : `**${buttonType} ${buttonName}**`

        if (button.members.length == 0) {
            [member, interaction] = await this.#keyNameInputPrompt(interaction)
            if (!member) return
        } else if (button.members.length == 1) {
            member = this.#guild.members.cache.get(button.members[0])
        } else {
            const text = `Which member do you want to log ${choiceText} reacts for this run?\nChoose or input a username or id.`
            const confirmMemberMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Name of ${button.name}s`)
            for (let i of button.members) confirmMemberMenu.addOptions({ label: this.#guild.members.cache.get(i).nickname, value: i })
            const {value: confirmMemberValue, interaction: logKeyInteraction} = await interaction.selectPanel(text, null, confirmMemberMenu, 10000, true, true)
            if (confirmMemberValue) member = this.#lookupGuildMember(confirmMemberValue)
            if (!logKeyInteraction) return await interaction.followUp({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], ephemeral: true })
            else if (!member) return await logKeyInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled or Invalid Member. You can dismiss this message.`, null)], components: [] })
            interaction = logKeyInteraction
        }

        const keyCountMsg = await interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setDescription(`Logging ${number} ${choiceText} for ${member}.`)
                    .setFooter({ text: `${interaction.guild.name} • ${this.afkTitle()}`, iconURL: interaction.guild.iconURL() })
            ],
            components: [
                new Discord.ActionRowBuilder()
                    .addComponents(
                        new Discord.ButtonBuilder().setCustomId('incr').setLabel('+1').setStyle(Discord.ButtonStyle.Primary),
                        new Discord.ButtonBuilder().setCustomId('save').setLabel('Save').setStyle(Discord.ButtonStyle.Success),
                        new Discord.ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(Discord.ButtonStyle.Danger),
                        new Discord.ButtonBuilder().setCustomId('input').setLabel('Input Key Count').setStyle(Discord.ButtonStyle.Secondary),
                        new Discord.ButtonBuilder().setCustomId('changeuser').setLabel('Change Key Popper').setStyle(Discord.ButtonStyle.Secondary)
                    )
            ],
            ephemeral: true
        })
        // This is a workaround for https://github.com/discordjs/discord.js/issues/7992
        // The bug is that if you have buttons on an ephermeral message, you can't have a Collector
        // on them unless you fetch the reply. We can't pass `fetchReply` when we make the reply
        // because we need the Interaction to be able to delete it. So, we fetch the reply ourselves
        // in order to make the collector.
        const collector = (await keyCountMsg.interaction.fetchReply()).createMessageComponentCollector({ componentType: Discord.ComponentType.Button });

        const savePops = await new Promise(res => {
            collector.on('collect', async i => {
                switch (i.customId) {
                    case 'save': return res(true)
                    case 'cancel': return res(false)
                    case 'incr':
                        number += 1
                        break
                    case 'changeuser':
                        let newMember;
                        [newMember, i] = await this.#keyNameInputPrompt(i)
                        if (!newMember) return
                        member = newMember
                        break
                    case 'input':
                        await i.showModal(
                            new Discord.ModalBuilder()
                                .setTitle('How many keys would you like to log?')
                                .setCustomId('keycountmodal')
                                .addComponents(
                                    new Discord.ActionRowBuilder().addComponents(
                                        new Discord.TextInputBuilder()
                                            .setLabel('Key Count')
                                            .setCustomId('keycount')
                                            .setStyle(Discord.TextInputStyle.Short)
                                    )
                                )
                        )
                        let keyCountResp
                        try {
                            keyCountResp = await i.awaitModalSubmit({time: 600_000})
                        } catch(e) {
                            if (e.code == 'InteractionCollectorError') return
                            throw e
                        }
                        const newNumber = parseInt(keyCountResp.fields.getField('keycount').value)
                        if (isNaN(newNumber) || newNumber < 0) return await keyCountResp.reply({content: `Invalid number: ${newNumber}`, ephemeral: true})
                        number = newNumber
                        i = keyCountResp
                        break
                }
                return await i.update({ embeds: [extensions.createEmbed(interaction, `Logging ${number} ${choiceText} for ${member}.`, null)] })
            });
        })

        collector.stop()
        await keyCountMsg.delete()
        if (!savePops) return

        for (let option of logOption.logName) {
            let keyTemplate = popCommand.findKey(this.#guild.id, option);
            if (keyTemplate) {
                let consumablepopsValueNames = `userid, guildid, unixtimestamp, amount, ismodded, templateid, raidid`
                let consumablepopsValues = `'${member.id}', '${this.#guild.id}', '${Date.now()}', '${number}', ${isModded}, '${keyTemplate.templateID}', '${this.#raidID}'`
                this.#db.query(`INSERT INTO consumablepops (${consumablepopsValueNames}) VALUES (${consumablepopsValues})`, (err, rows) => {
                    if (err) return console.log(`${option} missing from ${this.#guild.name} ${this.#guild.id}`)
                })
            }
            this.#db.query(`UPDATE users SET ${option} = ${option} + ${number} WHERE id = '${member.id}'`, (err, rows) => {
                if (err) return console.log(`${option} missing from ${this.#guild.name} ${this.#guild.id}`)
            })
            this.#db.query(`SELECT ${option} FROM users WHERE id = '${member.id}'`, async (err, rows) => {
                if (err) return console.log(`${option} missing from ${this.#guild.name} ${this.#guild.id}`)
                let embed = new Discord.EmbedBuilder()
                    .setColor('#0000ff')
                    .setTitle(`${button.name} logged!`)
                    .setDescription(`${member} now has \`\`${parseInt(rows[0][option]) + parseInt(number)}\`\` (+\`${number}\`) ${choiceText} pops`)
                    .setFooter({ text: `${interaction.guild.name} • ${this.afkTitle()}`, iconURL: interaction.guild.iconURL() })
                await (this.raidCommandsMessage?.reply({ embeds: [embed] }) || this.#afkTemplate.raidCommandChannel.send({ embeds: [embed] }))
            })
        }
        if (this.#botSettings.backend.points) {
            let points = logOption.points * number * logOption.multiplier
            await this.#db.promise().query('UPDATE users SET points = points + ? WHERE id = ?', [points, member.id])
            let pointsLog = [{ uid: member.id, points: points, reason: `${button.name}`}]
            await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.#genEmbedBase())
        }
        button.logged += number
        await this.raidChannelsMessage.edit(this.#genRaidChannels())
    }

    async processPhaseEnd(interaction) {
        const text = `Are you sure you want to delete this run?`
        const confirmButton = new Discord.ButtonBuilder()
            .setLabel('Delete Channel')
            .setStyle(Discord.ButtonStyle.Secondary)
        const cancelButton = new Discord.ButtonBuilder()
        const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, null, confirmButton, cancelButton, 10000, true)
        if (!subInteraction) return await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })   
        else if (!confirmValue) return await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
        else await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully deleted the run. You can dismiss this message.`, null)], components: [] })
        this.raidStatusInteractionHandler.stop()
        this.raidCommandsInteractionHandler.stop()
        this.raidChannelsInteractionHandler.stop()

        if (this.#channel) await this.#channel.delete()

        this.deleted_by = this.#guild.members.cache.get(interaction.member.id)

        await Promise.all([
            this.raidStatusMessage.edit({ content: null, ...this.#genRaidStatus() }),
            this.raidCommandsMessage.edit(this.#genRaidCommands()),
            this.raidInfoMessage.edit(this.#genRaidInfo()),
            this.raidChannelsMessage.delete()
        ])
        this.saveBotAfkCheck(true)
    }

    async processReconnect(interaction) {
        if (this.members.includes(interaction.member.id) || this.earlySlotMembers.includes(interaction.member.id) || this.earlyLocationMembers.includes(interaction.member.id)) {
            if (!interaction.member.voice.channel) return interaction.reply({ embeds: [extensions.createEmbed(interaction, `Join lounge to be moved into the channel. You can dismiss this message.`, null)], ephemeral: true })
            else if (interaction.member.voice.channel.id == this.#channel.id) return interaction.reply({ content: 'It looks like you are already in the channel ඞ. You can dismiss this message.', ephemeral: true })
            else if (interaction.member.voice.channel.name.includes('lounge') || interaction.member.voice.channel.name.includes('Lounge') || interaction.member.voice.channel.name.includes('drag')) {
                await interaction.member.voice.setChannel(this.#channel.id).catch(er => { })
                return interaction.reply({ embeds: [extensions.createEmbed(interaction, `Successfully moved you into the channel. You can dismiss this message.`, null)], ephemeral: true })
            }
        } else return interaction.reply({ embeds: [extensions.createEmbed(interaction, `You were not part of this run when the afk check ended. Another run will be posted soon. Join that one!`, null)], ephemeral: true });
    }

    async reactableSendLoc(interaction, hasLoc) {
        let locationText = ''
        if (hasLoc) locationText += `The location for this run has been set to \`${this.location}\`, get there ASAP!`
        else locationText += `You have received a guaranteed slot for this raid.`
        locationText += `${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`
        if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [extensions.createEmbed(interaction, locationText, null)], ephemeral: true })
        else await interaction.reply({ embeds: [extensions.createEmbed(interaction, locationText, null)], ephemeral: true })
    }

    async processReactableNormal(interaction, button) {
        if (button.confirm) {
            const text = button.confirmationDescription((button.confirmationMessage && this.#afkTemplate.processMessages(this.#message.channel, button.confirmationMessage)) || '')
            const confirmButton = new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
            const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, button.confirmationMedia, confirmButton, cancelButton, 10000, true)
            if (!subInteraction) {
                await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })   
                return false
            } else if (!confirmValue) {
                await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
                return false
            }
            await interaction.deleteReply()
            return subInteraction
        }
        return interaction
    }

    async processReactableSupporter(interaction, button) {
        if (this.earlySlotMembers.includes(interaction.member.id)) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Supporter Perks in \`${interaction.guild.name}\` only gives a guaranteed slot in the raid and you already have this from another react.\nYour Supporter Perks have not been used.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`, null)], ephemeral: true })
            return false
        }
        if (interaction.member.roles.highest.position >= interaction.guild.roles.cache.get(this.#botSettings.roles.trialrl).position) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `The location for this run has been set to \`${this.location}\``, null)], ephemeral: true })
            if (!this.earlySlotMembers.includes(interaction.member.id)) this.earlySlotMembers.push(interaction.member.id)
            return false
        }
        for (let i of this.#botSettings.lists.earlyLocation) { //custom early location roles
            if (interaction.member.roles.cache.has(i)) {
                await interaction.reply({ embeds: [extensions.createEmbed(interaction, `The location for this run has been set to \`${this.location}\``, null)], ephemeral: true })
                return false
            }
        }
        if (!interaction.member.roles.cache.hasAny(...this.#afkTemplate.perkRoles.map(role => role.id))) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You are not eligible for this reaction as you do not have the required Supporter role`, null)], ephemeral: true })
            return false
        }
        let supporterRole = interaction.member.supporterHierarchy(this.#botSettings)
        if (!supporterRole) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You are not eligible for this reaction as you do not have the required Supporter role`, null)], ephemeral: true })
            return false
        }
        if (button.members.length > this.#botSettings.numerical.supporterlimit) {
            button.limit = this.#botSettings.numerical.supporterlimit
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.`, null)], ephemeral: true })
            return false 
        }
        if (button.members.length > this.#botSettings.supporter[`supporterLimit${supporterRole}`]) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.`, null)], ephemeral: true })
            return false
        }
        let cooldown = this.#botSettings.supporter[`supporterCooldownSeconds${supporterRole}`]
        let uses = this.#botSettings.supporter[`supporterUses${supporterRole}`]
        let lastUseCheck = Date.now() - (cooldown * 1000)
        let [rows,] = await this.#db.promise().query(`SELECT * FROM supporterusage WHERE guildid = ? AND userid = ? AND utime > ?`, [interaction.guild.id, interaction.member.id, lastUseCheck])
        if (rows.length >= uses) {
            let cooldown_text = ''
            if (cooldown < 3600) cooldown_text = `${(cooldown/60).toFixed(0)} minutes`
            else cooldown_text = `${(cooldown/3600).toFixed(0)} hours`
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Your perks are limited to ${uses} times every ${cooldown_text}. Your next use is available <t:${(((cooldown*1000)+parseInt(rows[0].utime))/1000).toFixed(0)}:R>`, null)], ephemeral: true })
            return false
        }
        return interaction
    }

    async processReactablePoints(interaction, button) {
        const emote = button.emote ? `${button.emote.text} ` : ``

        if (!this.#botSettings.backend.points) {
            await interaction.deferUpdate()
            return false
        }
        
        let points = 0
        let [userRows,] = await this.#db.promise().query('SELECT points FROM users WHERE id = ?', [interaction.member.id])
        if (userRows.length == 0) return this.#db.promise().query('INSERT INTO users (id) VALUES (?)', [interaction.member.id])
        points = userRows[0].points

        if (points < button.points * -1) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have enough points.\nYou currently have ${emote} \`${points}\` points\n${button.location ? `Early location` : `A guaranteed slot in the channel`} costs ${emote} \`${button.points * -1}\``, null)], ephemeral: true })
            return false
        }

        if (button.confirm) {
            const text = button.confirmationDescription((button.confirmationMessage && this.#afkTemplate.processMessages(this.#message.channel, button.confirmationMessage)) || `You currently have ${emote} \`${points}\` points\n${button.location ? `Early location` : `A guaranteed slot in the channel`} costs ${emote} \`${button.points * -1}\`.\n`)
            const confirmButton = new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
            const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, button.confirmationMedia, confirmButton, cancelButton, 10000, true)
            if (!subInteraction) {
                await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] }) 
                return false
            } else if (!confirmValue) {
                await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
                return false
            }
            interaction.deleteReply()
            return subInteraction
        }
        return interaction
    }

    async postAfk(interaction) {
        this.singleUseHotfixStopTimersDontUseThisAnywhereElse = true // DO NOT USE THIS. ITS A HOTFIX. https://canary.discord.com/channels/343704644712923138/706670131115196588/1142549685719027822
        if (this.moveInEarlysTimer) clearInterval(this.moveInEarlysTimer)
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)

        if (this.#channel) {
            for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.#channel.setPosition(this.vcLounge.position + 1)
        }

        this.ended_by = interaction ? this.#guild.members.cache.get(interaction.member.id) : this.#guild.members.cache.get(this.#leader.id)

        this.raidStatusMessage.reactions.removeAll()
        await Promise.all([
            (interaction?.message.id == this.raidStatusMessage   ? interaction.update(this.#genRaidStatus()) : this.raidStatusMessage.edit(this.#genRaidStatus())),
            (interaction?.message.id == this.raidCommandsMessage ? interaction.update(this.#genRaidCommands()) : this.raidCommandsMessage.edit(this.#genRaidCommands())),
            (interaction?.message.id == this.raidChannelsMessage ? interaction.update(this.#genRaidChannels()) : this.raidChannelsMessage.edit(this.#genRaidChannels()))
        ])

        if (this.#channel) this.#channel.members.forEach(m => this.members.push(m.id));
        this.members = [...new Set([...this.members, ...this.earlySlotMembers, this.#leader.id])];


        if (this.#channel && this.#botSettings.backend.giveLocationToEarlyVConStart){
            const lateLocationMembers = this.earlySlotMembers.filter(u => !this.earlyLocationMembers.includes(u))
            const hearingImpairedMembers = this.#botSettings.lists.hearingImpairedMembers
            const dmMembers = [...new Set(lateLocationMembers.concat(hearingImpairedMembers))]
            const earlyLocEmbed = new Discord.EmbedBuilder()
            .setColor('Green')
            .setTitle(`Early location info`)
            .addFields([{name: `The location of ${this.#channel.name} is` , value: `\`${this.location}\``},
                {name: `Raid leader info: `, value:`\`${this.raidLeaderDisplayName()}\` | ${this.#leader}`},
                {name: `Link to channel:`, value: `${this.#channel}`}],
                {name: `If you get disconnected, join`, value: `${this.lounge} and press reconnect`})
            .setTimestamp(Date.now());
            for (const i of dmMembers) {
                let member = this.#guild.members.cache.get(i)
                if (member?.voice.channel?.id != this.#channel.id) continue
                await member.user.send({ embeds: [earlyLocEmbed] })    
            }                
        }

        if (this.members.length > 0) {
            let [db_members] = await this.#db.promise().query('SELECT id FROM users WHERE id IN (?)', [this.members])
            db_members = db_members.map(u => u.id)
            const new_members = this.members.filter(u => !db_members.includes(u))
            if (new_members.length > 0) await this.#db.promise().query('INSERT INTO users (id) VALUES (?)', [new_members])
        }
        
        if (this.#botSettings.backend.points) {
            let pointsLog = []
            for (let button of [...this.buttons, ...Object.values(this.reactRequests)]) for (let memberID of button.members) {
                if (button.type == AfkTemplate.TemplateButtonType.SUPPORTER) {
                    this.#db.query(`INSERT INTO supporterusage (guildid, userid, utime) VALUES ('${this.#guild.id}', '${memberID}', '${Date.now()}')`)
                }
                let points = button.points
                if (button.type != AfkTemplate.TemplateButtonType.POINTS && this.#guild.members.cache.get(memberID).roles.cache.hasAny(...this.#afkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                await this.#db.promise().query('UPDATE users SET points = points + ? WHERE id = ?', [points, memberID])
                pointsLog.push({ uid: memberID, points: points, reason: `${button.name}`})
            }
            this.#pointlogMid = await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.#genEmbedBase())
        }
        await this.raidInfoMessage.edit(this.#genRaidInfo())
        await this.#guild.channels.cache.get(this.#botSettings.channels.history).send({ embeds: [this.#genRaidInfoEmbed()] })

        this.logging = true
        this.completes++
        await this.raidChannelsMessage.edit(this.#genRaidChannels())
        setTimeout(this.loggingAfk.bind(this), 60000)
        this.saveBotAfkCheck()
    }

    async loggingAfk() {
        let members = this.#channel && this.#channel.members.size != 0 ? this.#channel.members.map(m => m.id) : this.earlySlotMembers
        members.push(this.#leader.id);
        members = [...new Set(members)];
        if (members.length > 0) {
            await this.#db.promise().query('INSERT INTO completionruns (??) VALUES ?', [
                                      ['userid', 'guildid',      'unixtimestamp', 'amount', 'templateid',                 'raidid',     'parenttemplateid'],
                     members.map(u => [u,        this.#guild.id, Date.now(),      1,        this.#afkTemplate.templateID, this.#raidID, this.#afkTemplate.parentTemplateID])
            ])
            if (this.#afkTemplate.logName) {
                await this.#db.promise().query('UPDATE users SET ?? = ?? + 1 WHERE id IN (?)', [this.#afkTemplate.logName, this.#afkTemplate.logName, members])
            }
        }
        for (let u of members) {
            if (this.#botSettings.backend.points) {
                let points = this.#botSettings.points.perrun
                if (this.#guild.members.cache.get(u).roles.cache.hasAny(...this.#afkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                this.#db.query('UPDATE users SET points = points + ? WHERE id = ?', [points, u], (err, rows) => {
                    if (err) return console.log('error logging points for run completes in ', this.#guild.id)
                })
            }
        }
        this.logging = false
    }

    addReconnectButton() {
        return [new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('Reconnect')
                .setStyle(1)
                .setCustomId('reconnect')
        ])]
    }

    addDeleteandLoggingButtons() {
        const phaseComponents = []
        let phaseActionRow = []
        let counter = 1

        if (this.#botSettings.backend.allowAdditionalCompletes) {
            counter++
            const phaseLogAdditionalButton = new Discord.ButtonBuilder()
                .setLabel('Log Additional Complete')
                .setStyle(1)
                .setCustomId('additional')
            phaseActionRow.push(phaseLogAdditionalButton)
        }

        for (const button of this.buttons) {
            if (!button.isLogged()) continue
            const logOptions = Object.keys(button.logOptions)
            const phaseButtons = logOptions.map(type => {
                const phaseButton = new Discord.ButtonBuilder()
                            .setStyle(2)
                            .setCustomId(`log ${type} ${button.name}`)
                            .setLabel(logOptions.length > 1 ? `Log ${type} ${button.name}` : `Log ${button.name}`)
                if (button.emote) phaseButton.setEmoji(button.emote.id)
                return phaseButton
            })
            phaseActionRow.push(...phaseButtons)
            counter ++
            if (counter == 5) {
                counter = 0
                const phaseComponent = new Discord.ActionRowBuilder({ components: phaseActionRow })
                phaseComponents.push(phaseComponent)
                phaseActionRow = []
            }
        }
        const phaseDeleteButton = new Discord.ButtonBuilder()
            .setLabel('Delete Channel')
            .setStyle(Discord.ButtonStyle.Danger)
            .setCustomId('end')
        phaseActionRow.push(phaseDeleteButton)
        const phaseComponent = new Discord.ActionRowBuilder({ components: phaseActionRow })
        phaseComponents.push(phaseComponent)
        return phaseComponents
    }
    
    async updateLocation() {
        this.location = this.#bot.afkChecks[this.#raidID].location
        await Promise.all([this.sendStatusMessage(), this.sendCommandsMessage(), this.sendChannelsMessage()])
        for (let i of this.earlyLocationMembers) {
            let member = this.#guild.members.cache.get(i)
            await member.send(`The location for this run has been changed to \`${this.location}\`, get there ASAP!`)
        }
    }

    async updateReactsRequest(reactable, number) {
        let reactablesRequestActionRow = []
        const button = new AfkButton(this.#botSettings, this.#bot.storedEmojis, this.#guild, {...this.#afkTemplate.getButton(reactable), limit: number, start: 69, disableStart: 69, lifetime: 69})
        const emote = button.emote ? `${button.emote.text} ` : ``
        const reactableButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(button.name)
            .setLabel(button.label())
        if (button.emote) reactableButton.setEmoji(button.emote.id)
        reactablesRequestActionRow.push(reactableButton)
        const component = new Discord.ActionRowBuilder({ components: reactablesRequestActionRow })

        let requestMessage = await this.#afkTemplate.raidStatusChannel.send({ content: `@here`, embeds: [extensions.createEmbed(this.#message, `${this.#leader} is requesting a ${emote}${reactable}.`)], components: [component] })
        this.reactRequests[requestMessage.id] = button
        let requestInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: requestMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        requestInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
        let updateRequestPanelTimer = setInterval(() => this.updateRequestPanel(requestMessage, requestInteractionHandler, reactable, updateRequestPanelTimer), 5000)
    }

    async updateRequestPanel(message, interactionHandler, reactable, timer) {
        if (!this.active) {
            message.edit({ components: []})
            interactionHandler.stop()
            clearInterval(timer)
        }
        let reactablesRequestActionRow = []
        const button = this.reactRequests[message.id]
        const reactableButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(button.name)
            .setLabel(button.label())
        if (button.emote) reactableButton.setEmoji(button.emote.id)
        if (button.members.length >= button.limit) reactableButton.setDisabled(true)
        reactablesRequestActionRow.push(reactableButton)
        const component = new Discord.ActionRowBuilder({ components: reactablesRequestActionRow })
        message.edit({ components: [component] })
    }
}

module.exports = {
    name: 'afk',
    description: 'The new version of the afk check',
    requiredArgs: 1,
    args: '<run symbol> <location>',
    role: 'eventrl',
    /**
     * Main Execution Function
     * @param {Discord.Message} message
     * @param {String[]} args
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     */
    async execute(message, args, bot, db) {
        let alias = args.shift().toLowerCase()

        const afkTemplateNames = await AfkTemplate.resolveTemplateAlias(bot.settings[message.guild.id], message.member, message.guild.id, message.channel.id, alias)
        if (afkTemplateNames instanceof AfkTemplate.AfkTemplateValidationError) return message.channel.send(afkTemplateNames.message())
        if (afkTemplateNames.length == 0) return await message.channel.send('This afk template does not exist.')

        const afkTemplateName = afkTemplateNames.length == 1 ? afkTemplateNames[0] : await AfkTemplate.templateNamePrompt(message, afkTemplateNames)

        const afkTemplate = await AfkTemplate.AfkTemplate.tryCreate(bot, bot.settings[message.guild.id], message, afkTemplateName)
        if (afkTemplate instanceof AfkTemplate.AfkTemplateValidationError) {
            if (afkTemplate.invalidChannel()) await message.delete()
            await message.channel.send(afkTemplate.message())
            return
        }

        let location = args.join(' ')
        if (location.length >= 1024) return await message.channel.send('Location must be below 1024 characters, try again')
        if (location == '') location = 'None'
        message.react('✅')

        const afkModule = new afkCheck(afkTemplate, bot, db, message, location)
        await afkModule.createChannel()
        await afkModule.sendButtonChoices()
        await afkModule.sendInitialStatusMessage()
        if (afkTemplate.startDelay > 0) setTimeout(() => afkModule.start(), afkTemplate.startDelay*1000)
        else afkModule.start()
    },
    returnRaidIDsbyMemberID(bot, memberID) {
        return Object.keys(bot.afkChecks).filter(raidID => bot.afkChecks[raidID].leader == memberID)
    },
    returnRaidIDsbyMemberVoice(bot, voiceID) {
        return Object.keys(bot.afkChecks).filter(raidID => bot.afkChecks[raidID].channel == voiceID)
    },
    returnRaidIDsbyRaidID(bot, RSAID) {
        return Object.keys(bot.afkChecks).filter(raidID => bot.afkChecks[raidID].raidStatusMessage && bot.afkChecks[raidID].raidStatusMessage.id == RSAID)
    },
    returnRaidIDsbyAll(bot, memberID, voiceID, argument) {
        return [...new Set([
            ...this.returnRaidIDsbyMemberID(bot, memberID),
            ...this.returnRaidIDsbyMemberVoice(bot, voiceID),
            ...this.returnRaidIDsbyMemberVoice(bot, argument),
            ...this.returnRaidIDsbyRaidID(bot, argument)
        ])]
    },
    returnActiveRaidIDs(bot) {
        return Object.keys(bot.afkChecks)
    },
    async loadBotAfkChecks(guild, bot, db) {
        const storedAfkChecks = Object.values(require('../data/afkChecks.json')).filter(raid => raid.guild.id === guild.id);
        for (const currentStoredAfkCheck of storedAfkChecks) {
            const messageChannel = guild.channels.cache.get(currentStoredAfkCheck.message.channelId)
            const message = await messageChannel.messages.fetch(currentStoredAfkCheck.message.id)
            const afkTemplateName = currentStoredAfkCheck.afkTemplateName
            const afkTemplate = await AfkTemplate.AfkTemplate.tryCreate(bot, bot.settings[message.guild.id], message, afkTemplateName)
            if (afkTemplate instanceof AfkTemplate.AfkTemplateValidationError) {
                console.log(afkTemplate.message())
                continue
            }
            bot.afkModules[currentStoredAfkCheck.raidID] = new afkCheck(afkTemplate, bot, db, message, currentStoredAfkCheck.location)
            await bot.afkModules[currentStoredAfkCheck.raidID].loadBotAfkCheck(currentStoredAfkCheck)
        }
        console.log(`Restored ${storedAfkChecks.length} afk checks for ${guild.name}`);
   },
   afkCheck
}