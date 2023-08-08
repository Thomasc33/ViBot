const Discord = require('discord.js')
const fs = require('fs')
const ErrorLogger = require('../lib/logError')
const AfkTemplate = require('./afkTemplate.js')
const pointLogger = require('../lib/pointLogger')
const extensions = require(`../lib/extensions`)
const consumablePopTemplates = require(`../data/keypop.json`);
const popCommand = require('./pop.js');
const milestones = require('../data/milestone.json')

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
        const afkTemplate = new AfkTemplate.AfkTemplate(bot, bot.settings[message.guild.id], message, alias)
        await afkTemplate.init()
        const currentStatus = afkTemplate.getStatus()
        if (currentStatus.state == AfkTemplate.TemplateState.INVALID_CHANNEL) await message.delete()
        if (currentStatus.state != AfkTemplate.TemplateState.SUCCESS) return await message.channel.send(currentStatus.message)
        if (!afkTemplate.minimumStaffRoles.some(roles => roles.every(role => message.member.roles.cache.has(role.id)))) return await message.channel.send({embeds: [extensions.createEmbed(message, `You do not have a suitable set of roles out of ${afkTemplate.minimumStaffRoles.reduce((a, b) => `${a}, ${b.join(' + ')}`)} to run ${afkTemplate.name}.`, null)] })
        let location = args.join(' ')
        if (location.length >= 1024) return await message.channel.send('Location must be below 1024 characters, try again')
        if (location == '') location = 'None'
        message.react('✅')

        const afkModule = new afkCheck(afkTemplate, bot, db, message, location)
        await afkModule.createChannel()
        await afkModule.sendButtonChoices()
        await afkModule.sendInitialStatusMessage(afkModule.phase)
        await afkModule.createThreads()
        if (afkTemplate.startDelay > 0) setTimeout(start, afkTemplate.startDelay*1000, afkModule)
        else start(afkModule)
    },
    returnRaidIDsbyMemberID(bot, memberID) {
        const afkChecks = []
        for (let raidID in bot.afkChecks) {
            if (bot.afkChecks[raidID].leader == memberID) afkChecks.push(raidID)
        }
        return afkChecks
    },
    returnRaidIDsbyMemberVoice(bot, voiceID) {
        const afkChecks = []
        for (let raidID in bot.afkChecks) {
            if (bot.afkChecks[raidID].channel == voiceID) afkChecks.push(raidID)
        }
        return afkChecks
    },
    returnRaidIDsbyRaidID(bot, RSAID) {
        const afkChecks = []
        for (let raidID in bot.afkChecks) {
            if (bot.afkChecks[raidID].raidStatusMessage && bot.afkChecks[raidID].raidStatusMessage.id == RSAID) afkChecks.push(raidID)
        }
        return afkChecks
    },
    returnRaidIDsbyAll(bot, memberID, voiceID, argument) {
        const afkCheckPlaceHolders = []
        afkCheckPlaceHolders.push(...this.returnRaidIDsbyMemberID(bot, memberID))
        afkCheckPlaceHolders.push(...this.returnRaidIDsbyMemberVoice(bot, voiceID))
        afkCheckPlaceHolders.push(...this.returnRaidIDsbyMemberVoice(bot, argument))
        afkCheckPlaceHolders.push(...this.returnRaidIDsbyRaidID(bot, argument))
        const afkChecks = [...new Set(afkCheckPlaceHolders)]
        return afkChecks
    },
    returnActiveRaidIDs(bot) {
        const afkChecks = []
        for (let raidID in bot.afkChecks) {
            afkChecks.push(raidID)
        }
        return afkChecks
    },
    async loadBotAfkChecks(guild, bot, db) {
        let storedAfkChecks = require('../data/afkChecks.json')
        for (let raidID in storedAfkChecks) {
            if (storedAfkChecks[raidID].guild.id != guild.id) continue
            let currentStoredAfkCheck = storedAfkChecks[raidID]
            let messageChannel = guild.channels.cache.get(currentStoredAfkCheck.message.channelId)
            let message = await messageChannel.messages.fetch(currentStoredAfkCheck.message.id)
            bot.afkChecks[raidID] = new afkCheck(currentStoredAfkCheck.afkTemplate, bot, db, message, currentStoredAfkCheck.location)
            await bot.afkChecks[raidID].loadBotAfkCheck(currentStoredAfkCheck)
        }
   }
}

async function start(afkModule) {
    await Promise.all([afkModule.sendStatusMessage(afkModule.phase),afkModule.sendCommandsMessage(afkModule.phase), afkModule.sendChannelsMessage(afkModule.phase)])
    afkModule.startTimers()
    afkModule.saveBotAfkCheck()
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
    #message;
    #guild;
    #channel;
    #leader;
    #raidID;

    constructor(afkTemplate, bot, db, message, location) {
        this.#bot = bot // bot
        this.#botSettings = bot.settings[message.guild.id] // bot settings
        this.#afkTemplate = afkTemplate // static AFK template
        this.#db = db // bot database
        this.#message = message // message of the afk
        this.#guild = message.guild // guild of the afk
        this.#channel = null // channel of the afk
        this.#leader = message.member // leader of the afk
        this.#raidID = null // ID of the afk

        this.members = [] // All members in the afk
        this.earlyLocationMembers = [] // All members with early location in the afk
        this.earlySlotMembers = [] // All members with early slots in the afk
        this.dragMembers = [] // All members currently in drag system in the afk
        this.openInteractions = [] // All members currently in the middle of a button interaction
        this.reactables = {} // All members of each reactable and position on embed
        this.miniBossGuessing = {}
        this.miniBossGuessed = false
        Object.keys(afkTemplate.buttons).forEach((key) => this.reactables[key] = { members: [], position: null, logged: 0 })
        this.capButtons = [] // All buttons that rely on the afk cap
        Object.keys(afkTemplate.buttons).forEach((key) => { if (afkTemplate.buttons[key].limit == 0) this.capButtons.push(key) }) 

        this.location = location // Location of the afk
        this.phase = 1 // Current phase of the afk
        this.timer = null // Time left until next phase (in seconds)
        this.completes = 0 // Number of times the afk has been completed
        this.logging = false // Whether logging is active
        this.active = true // Whether the afk is active

        this.raidStatusEmbed = null // raid status embed
        this.raidStatusMessage = null // raid status message
        this.raidStatusInteractionHandler = null // raid status interaction handler
        this.raidCommandsEmbed = null // raid commands embed
        this.raidCommandsMessage = null // raid commands message
        this.raidInfoEmbed = null // raid info embed
        this.raidInfoMessage = null // raid info message
        this.raidCommandsInteractionHandler = null // raid commands interaction handler
        this.raidChannelsEmbed = null // raid channels embed
        this.raidChannelsMessage = null // raid channels message
        this.raidChannelsInteractionHandler = null // raid channels interaction handler
        this.vcLounge = this.#guild.channels.cache.get(this.#botSettings.voice.lounge)
        this.raidDragThreads = {}
        Object.keys(afkTemplate.buttons).forEach((key) => { if (afkTemplate.buttons[key].type == AfkTemplate.TemplateButtonType.DRAG) this.raidDragThreads[key] = { thread: null, collector: null } })

        this.raidLeaderDisplayName = this.#leader.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
        this.flag = this.location ? {'us': ':flag_us:', 'eu': ':flag_eu:'}[this.location.toLowerCase().substring(0, 2)] : ''
        this.pingText = this.#afkTemplate.pingRoles ? `${this.#afkTemplate.pingRoles.join(' ')}, ` : ``
    }
    
    saveBotAfkCheck(deleteCheck = false) {
        if (deleteCheck) delete this.#bot.afkChecks[this.#raidID]
        else {
            this.#bot.afkChecks[this.#raidID] = {
                afkTemplate: this.#afkTemplate,
                message: this.#message,
                guild: this.#guild,
                channel: this.#channel,
                leader: this.#leader,
                raidID: this.#raidID,
                members: this.members,
                earlyLocationMembers: this.earlyLocationMembers,
                earlySlotMembers: this.earlySlotMembers,
                reactables: this.reactables,
                capButtons: this.capButtons,
                
                time: Date.now(),
                location: this.location,
                phase: this.phase,
                timer: this.timer,
                completes: this.completes,
                active: this.active,

                raidStatusEmbed: this.raidStatusEmbed,
                raidStatusMessage: this.raidStatusMessage,
                raidCommandsEmbed: this.raidCommandsEmbed,
                raidCommandsMessage: this.raidCommandsMessage,
                raidInfoEmbed: this.raidInfoEmbed,
                raidInfoMessage: this.raidInfoMessage,
                raidChannelsEmbed: this.raidChannelsEmbed,
                raidChannelsMessage: this.raidChannelsMessage,
                raidDragThreads: this.raidDragThreads,
                vcLounge: this.vcLounge
            }
            this.#bot.afkModules[this.#raidID] = this
        }
        fs.writeFileSync('./data/afkChecks.json', JSON.stringify(this.#bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.#bot, this.#guild) })
    }

    async loadBotAfkCheck(storedAfkCheck) {
        this.#afkTemplate = storedAfkCheck.afkTemplate
        this.#afkTemplate.pingRoles = this.#afkTemplate.pingRoles.map(role => (role == '@here') ? '@here' : this.#guild.roles.cache.get(role.id))
        this.#afkTemplate.perkRoles = this.#botSettings.lists.perkRoles.map(role => this.#guild.roles.cache.get(this.#botSettings.roles[role]))
        this.#afkTemplate.minimumViewRaiderRoles = this.#afkTemplate.minimumViewRaiderRoles.map(role => this.#guild.roles.cache.get(role.id))
        this.#afkTemplate.minimumJoinRaiderRoles = this.#afkTemplate.minimumJoinRaiderRoles.map(role => this.#guild.roles.cache.get(role.id))
        this.#afkTemplate.minimumStaffRoles = this.#afkTemplate.minimumStaffRoles.map(roles => roles.map(role => this.#guild.roles.cache.get(role.id)))
        this.#afkTemplate.raidInfoChannel = this.#guild.channels.cache.get(this.#afkTemplate.raidInfoChannel.id)
        this.#afkTemplate.raidTemplateChannel = this.#guild.channels.cache.get(this.#afkTemplate.raidTemplateChannel.id)
        this.#afkTemplate.raidStatusChannel = this.#guild.channels.cache.get(this.#afkTemplate.raidStatusChannel.id)
        this.#afkTemplate.raidCommandChannel = this.#guild.channels.cache.get(this.#afkTemplate.raidCommandChannel.id)
        this.#afkTemplate.raidActiveChannel = this.#guild.channels.cache.get(this.#afkTemplate.raidActiveChannel.id)
        this.#channel = storedAfkCheck.channel ? this.#guild.channels.cache.get(storedAfkCheck.channel.id) : null
        this.#raidID = storedAfkCheck.raidID

        this.pingText = this.#afkTemplate.pingRoles ? `${this.#afkTemplate.pingRoles.join(' ')}, ` : ``

        this.members = storedAfkCheck.members
        this.earlyLocationMembers = storedAfkCheck.earlyLocationMembers
        this.earlySlotMembers = storedAfkCheck.earlySlotMembers
        this.reactables = storedAfkCheck.reactables
        this.capButtons = storedAfkCheck.capButtons

        this.location = storedAfkCheck.location
        this.phase = storedAfkCheck.phase
        this.timer = storedAfkCheck.timer
        this.completes = storedAfkCheck.completes
        this.active = storedAfkCheck.active

        this.raidStatusMessage = await this.#afkTemplate.raidStatusChannel.messages.fetch(storedAfkCheck.raidStatusMessage.id)
        this.raidCommandsMessage = await this.#afkTemplate.raidCommandChannel.messages.fetch(storedAfkCheck.raidCommandsMessage.id)
        this.raidInfoMessage = await this.#afkTemplate.raidInfoChannel.messages.fetch(storedAfkCheck.raidInfoMessage.id)
        this.raidChannelsMessage = await this.#afkTemplate.raidActiveChannel.messages.fetch(storedAfkCheck.raidChannelsMessage.id)
        this.vcLounge = await this.#guild.channels.cache.get(this.#botSettings.voice.lounge)

        this.raidStatusEmbed = new Discord.EmbedBuilder(storedAfkCheck.raidStatusEmbed)
        this.raidCommandsEmbed = new Discord.EmbedBuilder(storedAfkCheck.raidCommandsEmbed)
        this.raidInfoEmbed = new Discord.EmbedBuilder(storedAfkCheck.raidInfoEmbed)
        this.raidChannelsEmbed = new Discord.EmbedBuilder(storedAfkCheck.raidChannelsEmbed)

        if (this.phase <= this.#afkTemplate.phases) start(this)
        else {
            this.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
            this.raidCommandsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidCommandsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidCommandsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
            this.raidChannelsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidChannelsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidChannelsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
            if (this.active) this.postAfk(null)
        }
    }

    async createChannel() {
        if (this.#afkTemplate.vcOptions == AfkTemplate.TemplateVCOptions.NO_VC) return
        else if (this.#afkTemplate.vcOptions == AfkTemplate.TemplateVCOptions.STATIC_VC) return this.#channel = this.#leader.voice.channel
        let channel = await this.#afkTemplate.raidTemplateChannel.clone({
            name: `${this.raidLeaderDisplayName}'s ${this.#afkTemplate.name}`,
            parent: this.#afkTemplate.raidCategory.id,
            userLimit: this.#afkTemplate.cap,
            position: 0
        })
        await this.#leader.voice.setChannel(channel).catch(er => {})
        for (let minimumViewRaiderRole of this.#afkTemplate.minimumViewRaiderRoles) await channel.permissionOverwrites.edit(minimumViewRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await channel.permissionOverwrites.edit(this.#leader.id, { Connect: true, ViewChannel: true, Speak: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        this.#channel = channel
    }

    async sendButtonChoices() {
        this.#afkTemplate.processButtons(this.#channel)
        this.#afkTemplate.processReacts()
        let buttonChoices = this.#afkTemplate.getButtonChoices()
        let newButtonChoices = []
        for (let i of buttonChoices) {
            if (this.#afkTemplate.buttons[i].minStaffRoles && !this.#afkTemplate.buttons[i].minStaffRoles.some(role => this.#leader.roles.cache.has(role.id))) continue
            let choiceText = this.#afkTemplate.buttons[i].emote ? `${this.#afkTemplate.buttons[i].emote.text} **${i}**` : `**${i}**` 
            switch (this.#afkTemplate.buttons[i].choice) {
                case AfkTemplate.TemplateButtonChoice.YES_NO_CHOICE:
                    const text1 = `Do you want to add ${choiceText} reacts to this run?\n If no response is received, this run will use the default ${this.#afkTemplate.buttons[i].limit} ${choiceText}.`
                    const confirmButton1 = new Discord.ButtonBuilder()
                        .setLabel('✅ Confirm')
                        .setStyle(Discord.ButtonStyle.Success)
                    const cancelButton1 = new Discord.ButtonBuilder()
                    const {value: confirmValue1, interaction: subInteraction1} = await this.#message.confirmPanel(text1, null, confirmButton1, cancelButton1, 30000, true)
                    this.#afkTemplate.buttons[i].limit = (confirmValue1 == null || confirmValue1) ? this.#afkTemplate.buttons[i].limit : 0
                    break
                case AfkTemplate.TemplateButtonChoice.NUMBER_CHOICE_PRESET:
                    const text2 = `How many ${choiceText} reacts do you want to add to this run?\n If no response is received, this run will use the default ${this.#afkTemplate.buttons[i].limit} ${choiceText}.`
                    const confirmSelectMenu2 = new Discord.StringSelectMenuBuilder()
                        .setPlaceholder(`Number of ${i}s`)
                        .setOptions(
                            { label: '1', value: '1' },
                            { label: '2', value: '2' },
                            { label: '3', value: '3' },
                            { label: 'None', value: '0' },
                        )
                    const {value: confirmValue2, interaction: subInteraction2} = await this.#message.selectPanel(text2, null, confirmSelectMenu2, 30000, false, true)
                    this.#afkTemplate.buttons[i].limit = Number.isInteger(parseInt(confirmValue2)) ? parseInt(confirmValue2) : this.#afkTemplate.buttons[i].limit
                    break
                case AfkTemplate.TemplateButtonChoice.NUMBER_CHOICE_CUSTOM:
                    const text3 = `How many ${choiceText} reacts do you want to add to this run?\n If no response is received, this run will use the default ${this.#afkTemplate.buttons[i].limit} ${choiceText}.`
                    const confirmSelectMenu3 = new Discord.StringSelectMenuBuilder()
                        .setPlaceholder(`Number of ${i}s`)
                        .setOptions(
                            { label: '1', value: '1' },
                            { label: '2', value: '2' },
                            { label: '3', value: '3' },
                            { label: 'None', value: '0' },
                        )
                    const {value: confirmValue3, interaction: subInteraction3} = await this.#message.selectPanel(text3, null, confirmSelectMenu3, 30000, true, true)
                    this.#afkTemplate.buttons[i].limit = Number.isInteger(parseInt(confirmValue3)) ? parseInt(confirmValue3) : this.#afkTemplate.buttons[i].limit
                    break
            }
            if (this.#afkTemplate.buttons[i].limit == 0) {
                newButtonChoices.push(i)
                delete this.reactables[i]
            }
        }
        this.#afkTemplate.updateButtonChoice(newButtonChoices)
    }

    async createThreads() {
        for (let i in this.#afkTemplate.buttons) {
            if (this.#afkTemplate.buttons[i].type == AfkTemplate.TemplateButtonType.DRAG) {
                this.raidDragThreads[i].thread = await this.#afkTemplate.raidCommandChannel.threads.create({ name: `${this.raidLeaderDisplayName} Drag ${i}`, reason: `Dragging ${i} Reacts` })
                this.raidDragThreads[i].collector = new Discord.InteractionCollector(this.#bot, { channel: this.raidDragThreads[i].thread, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
                this.raidDragThreads[i].collector.on('collect', (interaction) => this.dragInteractionHandler(interaction))
                const emote = this.#afkTemplate.buttons[i].emote ? `${this.#afkTemplate.buttons[i].emote.text} ` : ``
                let descriptionBeginning = `This thread is for the ${emote}${i}.\n`
                let descriptionEnd = `Press ✅ on images to allow. Otherwise press ❌ to deny.`
                let descriptionMiddle = ``
                if (this.#afkTemplate.buttons[i].confirmationMessage) descriptionMiddle = `${this.#afkTemplate.buttons[i].confirmationMessage}\n`
                const text = `${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`
                await this.raidDragThreads[i].thread.send({ embeds: [extensions.createEmbed(this.#message, text, this.#afkTemplate.buttons[i].confirmationMedia)] })
            }
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

    async updatePanel(timer) {
        if (this.phase > this.#afkTemplate.phases) return clearInterval(timer)
        if (!this.timer) this.timer = this.#afkTemplate.body[this.phase].timeLimit
        this.timer = this.timer - 5
        if (this.timer == 0) return this.processPhaseNext()
        if (!this.raidStatusMessage) return
        this.raidStatusEmbed.setFooter({ text: `${this.#guild.name} • ${Math.floor(this.timer / 60)} Minutes and ${this.timer % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() })
        this.raidCommandsEmbed.setFooter({ text: `${this.#guild.name} • ${Math.floor(this.timer / 60)} Minutes and ${this.timer % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() })
        this.raidInfoEmbed.setFooter({ text: `${this.#guild.name} • ${Math.floor(this.timer / 60)} Minutes and ${this.timer % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() })
        this.raidChannelsEmbed.setFooter({ text: `${this.#guild.name} • ${Math.floor(this.timer / 60)} Minutes and ${this.timer % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() })
        let reactables = this.getReactables(this.phase)
        let components = reactables.concat(this.getPhaseControls(this.phase))
        if (this.raidStatusMessage) await this.raidStatusMessage.edit({ embeds: [this.raidStatusEmbed], components: components })
        if (this.raidCommandsMessage) await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed] })
        if (this.raidInfoMessage) await this.raidInfoMessage.edit({embeds: [this.raidInfoEmbed]})
        if (this.raidChannelsMessage) await this.raidChannelsMessage.edit({ embeds: [this.raidChannelsEmbed] })
        this.openInteractions = []
    }

    removeFromActiveInteractions(id) {
        let ind = this.openInteractions.indexOf(id)
        if (ind > -1) this.openInteractions.splice(ind)
    }

    async sendInitialStatusMessage(phase) {
        this.#afkTemplate.processBody(this.#channel)
        this.raidStatusEmbed = extensions.createEmbed(this.#message, `\`${this.#afkTemplate.name}\`${this.flag ? ` in (${this.flag})` : ''} will begin in ${Math.round(this.#afkTemplate.startDelay)} seconds. Be prepared to join the raid.`, null)
        this.raidStatusEmbed.setColor(this.#afkTemplate.body[phase].embed.color ? this.#afkTemplate.body[phase].embed.color : '#ffffff')
        this.raidStatusEmbed.setAuthor({ name: `AFK for ${this.#afkTemplate.name} by ${this.raidLeaderDisplayName}`, iconURL: this.#leader.user.avatarURL() })
        if (this.#afkTemplate.body[phase].embed.thumbnail) this.raidStatusEmbed.setThumbnail(this.#afkTemplate.body[phase].embed.thumbnail[Math.floor(Math.random()*this.#afkTemplate.body[phase].embed.thumbnail.length)])
        
        this.raidStatusMessage = await this.#afkTemplate.raidStatusChannel.send({ content: `${this.pingText}**${this.#afkTemplate.name}** ${this.flag ? ` (${this.flag})` : ''} by ${this.#leader} is starting inside of **${this.#guild.name}**${this.#channel ? ` in ${this.#channel}` : ``}`, embeds: [this.#afkTemplate.startDelay > 0 ? this.raidStatusEmbed : null] })
        for (let i in this.#afkTemplate.raidPartneredStatusChannels) this.#afkTemplate.raidPartneredStatusChannels[i].map(async channel => await channel.send({ content: `**${this.#afkTemplate.name}** is starting inside of **${this.#guild.name}**${this.#channel ? ` in ${this.#channel}` : ``}` }))
        
        let tempRaidStatusMessage = null
        if (this.#afkTemplate.body[phase].message) tempRaidStatusMessage = await this.#afkTemplate.raidStatusChannel.send({ content: `${this.#afkTemplate.body[phase].message} in 5 seconds...` })
        setTimeout(async () => { if (tempRaidStatusMessage) await tempRaidStatusMessage.delete() }, 5000)

        this.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
        this.#raidID = this.raidStatusMessage.id
    }

    async sendStatusMessage(phase) {
        if (!this.raidStatusEmbed) {
            this.raidStatusEmbed = extensions.createEmbed(this.#message, `PlaceHolder`, null)
            this.raidStatusEmbed.setAuthor({ name: `AFK for ${this.#afkTemplate.name} by ${this.raidLeaderDisplayName}`, iconURL: this.#leader.user.avatarURL() })
        }
        this.raidStatusEmbed.setColor(this.#afkTemplate.body[phase].embed.color ? this.#afkTemplate.body[phase].embed.color : '#ffffff')
        this.raidStatusEmbed.setDescription(this.#afkTemplate.body[phase].embed.description)
        if (this.#afkTemplate.body[phase].embed.thumbnail) this.raidStatusEmbed.setThumbnail(this.#afkTemplate.body[phase].embed.thumbnail[Math.floor(Math.random()*this.#afkTemplate.body[phase].embed.thumbnail.length)])
        if (this.#afkTemplate.body[phase].embed.image) this.raidStatusEmbed.setImage(this.#botSettings.strings[this.#afkTemplate.body[phase].embed.image] ? this.#botSettings.strings[this.#afkTemplate.body[phase].embed.image] : this.#afkTemplate.body[phase].embed.image)
        this.raidStatusEmbed.setFooter({ text: `${this.#guild.name} • ${Math.floor(this.#afkTemplate.body[phase].timeLimit / 60)} Minutes and ${this.#afkTemplate.body[phase].timeLimit % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() })
        
        let reactables = this.getReactables(phase)
        let components = reactables.concat(this.getPhaseControls(phase))
        this.raidStatusMessage = await this.raidStatusMessage.edit({ content: `${this.pingText}**${this.#afkTemplate.name}** ${this.flag ? ` (${this.flag})` : ''}`, embeds: [this.raidStatusEmbed], components: components })
        
        if (!this.raidStatusInteractionHandler) {
            this.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
        }

        for (let i in this.#afkTemplate.reacts) {
            let start = this.#afkTemplate.reacts[i].start
            let end = start + this.#afkTemplate.reacts[i].lifetime
            if (start > phase) continue
            if (end <= phase) {
                await this.raidStatusMessage.reactions.cache.get(this.#afkTemplate.reacts[i].emote.id).remove()
                continue
            }
            await this.raidStatusMessage.react(this.#afkTemplate.reacts[i].emote.id)
        }
    }

    async sendCommandsMessage(phase) {
        if (!this.raidCommandsEmbed) {
            this.raidCommandsEmbed = extensions.createEmbed(this.#message, `PlaceHolder`, null)
            this.raidCommandsEmbed.setAuthor({ name: `AFK for ${this.#afkTemplate.name} by ${this.raidLeaderDisplayName}`, iconURL: this.#leader.user.avatarURL() })

            let position = 0
            for (let i in this.#afkTemplate.buttons) {
                this.reactables[i].position = position
                this.raidCommandsEmbed.addFields({ name: `${this.#afkTemplate.buttons[i].emote ? this.#afkTemplate.buttons[i].emote.text : ''} ${i} ${this.#afkTemplate.buttons[i].limit ? `(${this.#afkTemplate.buttons[i].limit}) ${this.#afkTemplate.buttons[i].location ? `\`L\`` : `` }` : ''}`, value: 'None!', inline: true })
                position++
            }
        }
        this.raidCommandsEmbed.setColor(this.#afkTemplate.body[phase].embed.color ? this.#afkTemplate.body[phase].embed.color : '#ffffff')
        this.raidCommandsEmbed.setDescription(`**Raid Leader: ${this.#leader} \`\`${this.#leader.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.location}\`\` ${this.flag ? ` in (${this.flag})` : ''}`)
        this.raidCommandsEmbed.setFooter({ text: `${this.#guild.name} • ${Math.floor(this.#afkTemplate.body[phase].timeLimit / 60)} Minutes and ${this.#afkTemplate.body[phase].timeLimit % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() })
        this.raidInfoEmbed = Discord.EmbedBuilder.from(this.raidCommandsEmbed)

        let components = this.getPhaseControls(phase)
        
        if (this.raidCommandsMessage) this.raidCommandsMessage = await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed], components: components})
        else this.raidCommandsMessage = await this.#afkTemplate.raidCommandChannel.send({ embeds: [this.raidCommandsEmbed], components: components})
        if (this.raidInfoMessage) this.raidInfoMessage = await this.raidInfoMessage.edit({embeds: [this.raidInfoEmbed]})
        else this.raidInfoMessage = await this.#afkTemplate.raidInfoChannel.send({embeds: [this.raidInfoEmbed]})
        
        if (!this.raidCommandsInteractionHandler) {
            this.raidCommandsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidCommandsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidCommandsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
    }

    async sendChannelsMessage(phase) {
        if (!this.raidChannelsEmbed) {
            this.raidChannelsEmbed = extensions.createEmbed(this.#message, `PlaceHolder`, null)
            this.raidChannelsEmbed.setAuthor({ name: `AFK for ${this.#afkTemplate.name} by ${this.raidLeaderDisplayName}`, iconURL: this.#leader.user.avatarURL() })
            this.raidChannelsEmbed.addFields({ name: `Logging Info`, value: this.getLoggingText(), inline: false })
        }
        this.raidChannelsEmbed.setColor(this.#afkTemplate.body[phase].embed.color ? this.#afkTemplate.body[phase].embed.color : '#ffffff')
        this.raidChannelsEmbed.setDescription(`**Raid Leader: ${this.#leader} \`\`${this.#leader.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.location}\`\` ${this.flag ? ` in (${this.flag})` : ''}\n\nWhenever the run is over. Click the button to delete the channel.`)
        this.raidChannelsEmbed.setFooter({ text: `${this.#guild.name} • ${Math.floor(this.#afkTemplate.body[phase].timeLimit / 60)} Minutes and ${this.#afkTemplate.body[phase].timeLimit % 60} Seconds Remaining`, iconURL: this.#guild.iconURL() })
        
        let components = this.getPhaseControls(phase)

        if (this.raidChannelsMessage) this.raidChannelsMessage = await this.raidChannelsMessage.edit({content: `${this.#message.member}`, embeds: [this.raidChannelsEmbed], components: components })
        else this.raidChannelsMessage = await this.#afkTemplate.raidActiveChannel.send({content: `${this.#message.member}`, embeds: [this.raidChannelsEmbed], components: components })
       
        if (!this.raidChannelsInteractionHandler) {
            this.raidChannelsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidChannelsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidChannelsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
    }

    getPhaseControls(phase) {
        const components = []
        const phaseActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel(`✅ ${this.#afkTemplate.body[phase].nextPhaseButton ? `${this.#afkTemplate.body[phase].nextPhaseButton}` : `Phase ${phase}`}`)
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

    getReactables(phase) {
        const components = []
        let reactablesActionRow = []
        let counter = 0
        for (let i in this.#afkTemplate.buttons) {
            if (i == 'MiniBossGuessing' && !this.#botSettings.backend.miniBossGuessing) { continue }
            let disableStart = this.#afkTemplate.buttons[i].disableStart
            let start = this.#afkTemplate.buttons[i].start
            let end = start + this.#afkTemplate.buttons[i].lifetime
            if (disableStart < start && disableStart > phase) continue
            if (!(disableStart < start) && start > phase) continue
            if (end <= phase) continue
            if (this.capButtons.includes(i)) this.#afkTemplate.buttons[i].limit = this.#afkTemplate.cap
            const reactableButton = new Discord.ButtonBuilder()
                .setStyle(2)
                .setCustomId(`${i}`)
            let label = `${this.#afkTemplate.buttons[i].displayName ? `${i} ` : ``}${this.#afkTemplate.buttons[i].limit ? ` ${this.reactables[i].members.length}/${this.#afkTemplate.buttons[i].limit}` : ``}`
            reactableButton.setLabel(label)
            if (this.#afkTemplate.buttons[i].emote) reactableButton.setEmoji(this.#afkTemplate.buttons[i].emote.id)
            if (this.#afkTemplate.buttons[i].limit && this.reactables[i].members.length >= this.#afkTemplate.buttons[i].limit) reactableButton.setDisabled(true)
            if (disableStart < start && start > phase) reactableButton.setDisabled(true)
            reactablesActionRow.push(reactableButton)
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
        let loggingText = ``
        if (this.#botSettings.backend.allowAdditionalCompletes) loggingText += `Completes: \`${this.completes}\`\n`
        for (let i in this.#afkTemplate.buttons) {
            const buttonType = this.#afkTemplate.buttons[i].type
            const buttonInfo = this.#afkTemplate.buttons[i]
            const logged = this.reactables[i].logged
            const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``
            if (buttonType == AfkTemplate.TemplateButtonType.LOG || buttonType == AfkTemplate.TemplateButtonType.LOG_SINGLE) {
                loggingText += `${emote}${i} Logged: \`${logged}\`\n`
            }
        }
        return loggingText
    }

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     */
    async interactionHandler(interaction) {
        if (!interaction.isButton()) return
        if (this.openInteractions.includes(interaction.member.id)) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You are already in the process of reacting. Please wait and try again!`, null)], ephemeral: true })
            return
        }
        this.openInteractions.push(interaction.member.id)

        if (this.#afkTemplate.buttons[interaction.customId]) {
            const buttonType = this.#afkTemplate.buttons[interaction.customId].type
            const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
            const position = this.reactables[interaction.customId].position
            const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

            if (buttonInfo.minRole && !interaction.member.roles.cache.has(buttonInfo.minRole.id)) {
                await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have the required role ${buttonInfo.minRole} to react to this run.`, null)], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (this.reactables[interaction.customId].members.includes(interaction.member.id)) {
                await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId}. Try another react or try again next run.`, null)], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (interaction.customId.includes('request') && this.reactables[interaction.customId.substring(0, interaction.customId.length - 8)].members.includes(interaction.member.id)) {
                await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId.substring(0, interaction.customId - 7)}. Try another react or try again next run.`, null)], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (buttonInfo.limit && this.reactables[interaction.customId].members.length >= buttonInfo.limit) {
                await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for that. Try another react or try again next run.`, null)], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) if (this.reactables[i].members.length >= this.#afkTemplate.buttons[i].limit) {
                    await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for the main react ${i}. Try another react or try again next run.`, null)], ephemeral: true })
                    return this.removeFromActiveInteractions(interaction.member.id)
                }
            }
            this.reactables[interaction.customId].members.push(interaction.member.id)

            let buttonStatus = false
            switch (buttonType) {
                case AfkTemplate.TemplateButtonType.LOG:
                case AfkTemplate.TemplateButtonType.LOG_SINGLE:
                case AfkTemplate.TemplateButtonType.NORMAL:
                    buttonStatus = await this.processReactableNormal(interaction)
                    break
                case AfkTemplate.TemplateButtonType.SUPPORTER:
                    buttonStatus = await this.processReactableSupporter(interaction)
                    break
                case AfkTemplate.TemplateButtonType.POINTS:
                    buttonStatus = await this.processReactablePoints(interaction)
                    break
                case AfkTemplate.TemplateButtonType.DRAG:
                    buttonStatus = await this.processReactableDrag(interaction)
                    break
                case AfkTemplate.TemplateButtonType.OPTION:
                    buttonStatus = await this.processReactableOption(interaction)
                    return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (!buttonStatus) {
                let ind = this.reactables[interaction.customId].members.indexOf(interaction.member.id)
                if (ind > -1) this.reactables[interaction.customId].members.splice(ind)
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) {
                    const parentButtonInfo = this.#afkTemplate.buttons[i]
                    const parentPosition = this.reactables[i].position
                    const parentEmote = parentButtonInfo.emote ? `${parentButtonInfo.emote.text} ` : ``
                    if (!this.reactables[i].members.includes(interaction.member.id)) this.reactables[i].members.push(interaction.member.id)
                    if (parentButtonInfo.location && !this.earlyLocationMembers.includes(interaction.member.id)) this.earlyLocationMembers.push(interaction.member.id)
                    this.raidCommandsEmbed.data.fields[parentPosition].value = this.reactables[i].members.reduce((string, id, ind) => string + `${parentEmote ? parentEmote : ind+1}: <@!${id}>\n`, '')
                }
            }
            if (!this.earlySlotMembers.includes(interaction.member.id)) this.earlySlotMembers.push(interaction.member.id)
            if (buttonInfo.location && !this.earlyLocationMembers.includes(interaction.member.id)) this.earlyLocationMembers.push(interaction.member.id)
            this.raidCommandsEmbed.data.fields[position].value = this.reactables[interaction.customId].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            if (interaction.customId.includes('request')) {
                this.raidCommandsEmbed.data.fields[position].value = this.reactables[interaction.customId.substring(0, interaction.customId.length - 8)].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
                this.raidCommandsEmbed.data.fields[position].value += this.reactables[interaction.customId].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            } else if (this.reactables[`${interaction.customId}_request`]) {
                this.raidCommandsEmbed.data.fields[position].value = this.reactables[interaction.customId].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
                this.raidCommandsEmbed.data.fields[position].value += this.reactables[`${interaction.customId}_request`].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            }
            if (this.raidCommandsEmbed.data.fields[position].value.length >= 1024) this.raidCommandsEmbed.data.fields[position].value = '*Too many users to process*'
            this.raidInfoEmbed = Discord.EmbedBuilder.from(this.raidCommandsEmbed)
            await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.raidInfoMessage.edit({ embeds: [this.raidInfoEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            return this.removeFromActiveInteractions(interaction.member.id)
        }
        else if (['abort', 'phase', 'cap', 'additional', 'end', 'miniboss'].includes(interaction.customId) || interaction.customId.includes(`Log`)) {
            if (this.#afkTemplate.minimumStaffRoles.some(roles => roles.every(role => interaction.member.roles.cache.has(role.id)))) return await this.processPhaseControl(interaction)
            else {
                await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have the required Staff Role to use this button.`, null)], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
        } else if (interaction.customId == 'reconnect') {
            await this.processReconnect(interaction)
            return this.removeFromActiveInteractions(interaction.member.id)
        } else {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `How did you press something that's unpressable? ඞ.`, null)], ephemeral: true })
            return this.removeFromActiveInteractions(interaction.member.id)
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
            case "miniboss":
                await this.processPhaseMiniboss(interaction)
                break
            default:
                if (interaction.customId.includes('Log')) await this.processPhaseLog(interaction)
                break
        }
        return this.removeFromActiveInteractions(interaction.member.id)
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

        for (let i in this.raidDragThreads) {
            if (this.raidDragThreads[i].collector) this.raidDragThreads[i].collector.stop()
            if (this.raidDragThreads[i].thread) await this.raidDragThreads[i].thread.delete()
        }

        if (this.moveInEarlysTimer) clearInterval(this.moveInEarlysTimer)
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)
        if (this.#channel) await this.#channel.delete()
        
        this.raidStatusEmbed.setImage(null)
        this.raidStatusEmbed.setDescription(`This afk check has been aborted`)
        this.raidStatusEmbed.setFooter({ text: `${this.#guild.name} • Aborted by ${this.#guild.members.cache.get(interaction.member.id).nickname}`, iconURL: this.#guild.iconURL() })
        this.raidCommandsEmbed.setFooter({ text: `${this.#guild.name} • Aborted by ${this.#guild.members.cache.get(interaction.member.id).nickname}`, iconURL: this.#guild.iconURL() })
        this.raidInfoEmbed.setFooter({ text: `${this.#guild.name} • Aborted by ${this.#guild.members.cache.get(interaction.member.id).nickname}`, iconURL: this.#guild.iconURL() })

        this.raidStatusMessage.reactions.removeAll()
        await this.raidStatusMessage.edit({ content: null, embeds: [this.raidStatusEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed], components: []})
        await this.raidInfoMessage.edit({ embeds: [this.raidInfoEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidChannelsMessage.delete()
        
        this.active = false
        this.saveBotAfkCheck(true)
    }

    async processPhaseNext(interaction) {
        if (interaction && interaction.member != this.#leader) {
            const text = `Are you sure you want to move to the next phase in this run?`
            const confirmButton = new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
            const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, null, confirmButton, cancelButton, 10000, true)
            if (!subInteraction) return await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })
            else if (!confirmValue) return await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
            else subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully moved to the next phase of the run. You can dismiss this message.`, null)], components: [] })
        } else if (interaction) interaction.reply({ embeds: [extensions.createEmbed(interaction, `Successfully moved to the next phase of the run. You can dismiss this message.`, null)], ephemeral: true })
        
        this.phase++
        let phase = this.phase
        this.timer = null
        if (phase > this.#afkTemplate.phases) {
            if (interaction) this.removeFromActiveInteractions(interaction.member.id)
            return this.postAfk(interaction)
        }
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)
        let tempRaidStatusMessage = null
        if (this.#afkTemplate.body[phase].message) tempRaidStatusMessage = await this.#afkTemplate.raidStatusChannel.send({ content: `${this.#afkTemplate.body[phase].message} in 5 seconds...` })
        
        this.raidStatusMessage.editButtons({ disabled: true})
        this.raidCommandsMessage.editButtons({ disabled: true})
        this.raidChannelsMessage.editButtons({ disabled: true})

        setTimeout(async () => {
            if (this.#afkTemplate.body[phase].vcState == AfkTemplate.TemplateVCState.OPEN && this.#channel) for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            else if (this.#afkTemplate.body[phase].vcState == AfkTemplate.TemplateVCState.LOCKED && this.#channel) for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await Promise.all([this.sendStatusMessage(phase), this.sendCommandsMessage(phase), this.sendChannelsMessage(phase)])
            if (phase <= this.#afkTemplate.phases) {
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
        this.#afkTemplate.cap = number
        if (this.#channel) this.#channel.setUserLimit(this.#afkTemplate.cap)
        this.updatePanel()
    }

    async processPhaseAdditional(interaction) {
        if (this.logging) return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already logged an additional complete recently. Please wait and try again!`, null)], ephemeral: true })
        const text = `Are you sure you want to log an additional complete to all members of this run?`
        const confirmButton = new Discord.ButtonBuilder()
            .setLabel('Log Additional Complete')
            .setStyle(Discord.ButtonStyle.Secondary)
        const cancelButton = new Discord.ButtonBuilder()
        const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, null, confirmButton, cancelButton, 10000, true)
        if (!subInteraction) return await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })   
        else if (!confirmValue) return await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
        else await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully logged an additional complete to all members of the run. You can dismiss this message.`, null)], components: [] })
        this.logging = true
        this.completes++
        this.raidChannelsEmbed.data.fields[0].value = this.getLoggingText()
        await this.raidChannelsMessage.edit({ embeds: [this.raidChannelsEmbed] })
        setTimeout(this.loggingAfk.bind(this), 60000)
    }

    async processPhaseLog(interaction) {
        const button = interaction.customId.substring(4)
        const buttonInfo = this.#afkTemplate.buttons[button]

        let member = null
        let number = null
        let logOption = null
        let isModded = false
        let logBool = Object.keys(buttonInfo.logOptions).length > 1
        let choiceText = buttonInfo.emote ? `${buttonInfo.emote.text} **${button}**` : `**${button}**`

        const text1 = `Which member do you want to log ${choiceText} reacts for this run?\nChoose or input a username or id.`
        const confirmMemberMenu = new Discord.StringSelectMenuBuilder()
            .setPlaceholder(`Name of ${button}s`)
        for (let i of this.reactables[button].members) confirmMemberMenu.addOptions({ label: this.#guild.members.cache.get(i).nickname, value: i })
        const {value: confirmMemberValue, interaction: subInteractionMember} = await interaction.selectPanel(text1, null, confirmMemberMenu, 10000, true, true)
        if (!member && confirmMemberValue) member = this.#guild.members.cache.get(confirmMemberValue)
        if (!member && confirmMemberValue) member = this.#guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(confirmMemberValue.toLowerCase()))
        if (!subInteractionMember) return await interaction.followUp({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], ephemeral: true })
        else if (!member) return await subInteractionMember.update({ embeds: [extensions.createEmbed(interaction, `Cancelled or Invalid Member. You can dismiss this message.`, null)], components: [] })
        else await subInteractionMember.update({ embeds: [extensions.createEmbed(interaction, `Successfully set the member to ${member}. You can dismiss this message.`, null)], components: [] })

        if (!(buttonInfo.type == AfkTemplate.TemplateButtonType.LOG_SINGLE)) {
            const text2 = `How many ${choiceText} reacts do you want to log for this run?\nChoose or input a number.`
            const confirmNumberMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Number of ${button}s`)
                .setOptions(
                    { label: '1', value: '1' },
                    { label: '2', value: '2' },
                    { label: '3', value: '3' },
                    { label: 'None', value: '0' },
                )
            const {value: confirmNumberValue, interaction: subInteractionNumber} = await interaction.selectPanel(text2, null, confirmNumberMenu, 10000, true, true)
            number = Number.isInteger(parseInt(confirmNumberValue)) ? parseInt(confirmNumberValue) : null
            if (!subInteractionNumber) return await interaction.followUp({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], ephemeral: true })   
            else if (!number) return await subInteractionNumber.update({ embeds: [extensions.createEmbed(interaction, `Cancelled or Invalid Number. You can dismiss this message.`, null)], components: [] })
            else await subInteractionNumber.update({ embeds: [extensions.createEmbed(interaction, `Successfully set the number to ${number}. You can dismiss this message.`, null)], components: [] })
        } else number = 1

        if (logBool) {
            const text3 = `How do you want ${choiceText} to be logged for this run?\nChoose or input an option.`
            const confirmOptionMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Option for ${button}s`)
            for (let i in buttonInfo.logOptions) confirmOptionMenu.addOptions({ label: i, value: i })
            const {value: confirmOptionValue, interaction: subInteractionOption} =  await interaction.selectPanel(text3, null, confirmOptionMenu, 10000, false, true)
            isModded = confirmOptionValue == "Modded"
            logOption = buttonInfo.logOptions[confirmOptionValue]
            if (!subInteractionOption) return await interaction.followUp({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], ephemeral: true })   
            else if (!logOption) return await subInteractionOption.update({ embeds: [extensions.createEmbed(interaction, `Cancelled or Invalid Option. You can dismiss this message.`, null)], components: [] })
            else await subInteractionOption.update({ embeds: [extensions.createEmbed(interaction, `Successfully set the option to ${confirmOptionValue}. You can dismiss this message.`, null)], components: [] })
        } else logOption = buttonInfo.logOptions[Object.keys(buttonInfo.logOptions)[0]]
        
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
                    .setTitle(`${button} logged!`)
                    .setDescription(`${member} now has \`\`${parseInt(rows[0][option]) + parseInt(number)}\`\` ${choiceText} pops`)
                await this.#afkTemplate.raidCommandChannel.send({ embeds: [embed] })
            })
        }
        if (this.#botSettings.backend.points) {
            let points = logOption.points * number * logOption.multiplier
            this.#db.query(`UPDATE users SET points = points + ${points} WHERE id = '${member.id}'`, (err, rows) => {
                if (err) return console.log(`error logging ${i} points in `, this.#guild.id)
            })
            let pointsLog = [{ uid: member.id, points: points, reason: `${button}`}]
            await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.raidInfoEmbed)
        }
        this.reactables[button].logged += number
        this.raidChannelsEmbed.data.fields[0].value = this.getLoggingText()
        await this.raidChannelsMessage.edit({ embeds: [this.raidChannelsEmbed] })
        await interaction.followUp({ embeds: [extensions.createEmbed(interaction, `Successfully logged ${number} ${choiceText} for ${member}. You can dismiss this message.`, null)], ephemeral: true })
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

        for (let i in this.raidDragThreads) {
            if (this.raidDragThreads[i].collector) this.raidDragThreads[i].collector.stop()
            if (this.raidDragThreads[i].thread) await this.raidDragThreads[i].thread.delete()
        }

        if (this.#channel) await this.#channel.delete()

        await this.raidStatusMessage.edit({ content: null, embeds: [this.raidStatusEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed], components: []})
        await this.raidInfoMessage.edit({ embeds: [this.raidInfoEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidChannelsMessage.delete()
        this.active = false
        this.saveBotAfkCheck(true)
    }

    async processPhaseMiniboss(interaction) {
        const buttonInfo = this.#afkTemplate.buttons['MiniBossGuessing']

        if (this.miniBossGuessed) {
            this.removeFromActiveInteractions(interaction.member.id)
            return await interaction.reply({ content: "You have already set the miniboss.\nPut more runs up to do more miniboss guessing! :)", ephemeral: true })
        }

        let points = this.#botSettings.points.miniBossGuessingPoints
        let embed = new Discord.EmbedBuilder()
            .setTitle('Set the Miniboss')
            .setDescription(`Choose one of the minibosses below.\nAll of the users who reacted correctly will recieve \`${points}\` points.`)
            .setColor('#FFFFFF')
        await interaction.reply({ embeds: [embed], ephemeral: true, fetchReply: true })
        const choice = await interaction.confirmListEmojisWithText(
            Object.keys(buttonInfo.logOptions).map(key => this.#bot.storedEmojis[buttonInfo.logOptions[key].emojiName].id),
            Object.keys(buttonInfo.logOptions).map(key => buttonInfo.logOptions[key].name),
            Object.keys(buttonInfo.logOptions).map(key => buttonInfo.logOptions[key].emojiName),
            interaction.member.id)
        if (!choice || choice == 'Cancelled') { return interaction.editReply({ embeds: [failEmbed], ephemeral: true, components: [] }) }

        let choicePrettyName = buttonInfo.logOptions[choice].name;
        let choiceEmote = this.#bot.storedEmojis[buttonInfo.logOptions[choice].emojiName].text;
        embed.setDescription(`You set the Miniboss to ${choiceEmote} **${choicePrettyName}** ${choiceEmote}\nThank you!`)

        await interaction.followUp({ embeds: [embed], components: [], ephemeral: true })
        await interaction.deleteReply()

        const rows = await this.#db.promise().query(`SELECT * FROM miniBossEvent WHERE guildid = '${this.#guild.id}' AND raidid = '${this.#raidID}' AND miniboss = '${choice}'`)
        rows[0].map(row => {
            this.#db.query(`UPDATE users SET points = points + ${points} WHERE id = '${row.userid}'`)
            let user = this.#guild.members.cache.get(row.userid)
            try {
                user.send(`Congratiulations!\nYou have been awared ${points} points for guessing the correct miniboss!\nThe Miniboss was ${choiceEmote} **${choicePrettyName}** ${choiceEmote}`)
            } catch (e) {
                console.log('Could not DM user\n\n', e)
            }
        })
        this.miniBossGuessed = true
        this.removeFromActiveInteractions(interaction.member.id)
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

    async processReactableNormal(interaction) {
        const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            let descriptionMiddle = ``
            if (buttonInfo.confirmationMessage) descriptionMiddle = `${buttonInfo.confirmationMessage}\n`
            const text = `${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`
            const confirmButton = new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
            const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, buttonInfo.confirmationMedia, confirmButton, cancelButton, 10000, true)
            if (!subInteraction) {
                await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] })   
                return false
            } else if (!confirmValue) {
                await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
                return false
            }
            await interaction.deleteReply()
        }
        let locationText = ''
        if (buttonInfo.location) locationText = `The location for this run has been set to \`${this.location}\`, get there ASAP!${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`
        else locationText = `The location for this run is not given for this reaction.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`
        if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [extensions.createEmbed(interaction, locationText, null)], ephemeral: true })
        else await interaction.reply({ embeds: [extensions.createEmbed(interaction, locationText, null)], ephemeral: true })
        return true
    }

    async processReactableSupporter(interaction) {
        if (this.earlySlotMembers.includes(interaction.member.id)) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Supporter Perks in \`${interaction.guild.name}\` only gives a guaranteed slot in the raid and you already have this from another react.\nYour Supporter Perks have not been used.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`, null)], ephemeral: true })
            return false
        }
        if (interaction.member.roles.highest.position >= interaction.guild.roles.cache.get(this.#botSettings.roles.trialrl).position) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `The location for this run has been set to \`${this.location}\``, null)], ephemeral: true })
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
        if (this.reactables[interaction.customId].members.length > this.#botSettings.numerical.supporterlimit) {
            this.#afkTemplate.buttons[interaction.customId].limit = this.#botSettings.numerical.supporterlimit
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.`, null)], ephemeral: true })
            return false 
        }
        if (this.reactables[interaction.customId].members.length > this.#botSettings.supporter[`supporterLimit${supporterRole}`]) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.`, null)], ephemeral: true })
            return false
        }
        let cooldown = this.#botSettings.supporter[`supporterCooldownSeconds${supporterRole}`]
        let uses = this.#botSettings.supporter[`supporterUses${supporterRole}`]
        let lastUseCheck = Date.now() - (cooldown * 1000)
        let [rows,] = await this.#db.promise().query(`SELECT * FROM supporterusage WHERE guildid = '${interaction.guild.id}' AND userid = '${interaction.member.id}' AND utime > '${lastUseCheck}'`)
        if (rows.length >= uses) {
            let cooldown_text = ''
            if (cooldown < 3600) cooldown_text = `${(cooldown/60).toFixed(0)} minutes`
            else cooldown_text = `${(cooldown/3600).toFixed(0)} hours`
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Your perks are limited to ${uses} times every ${cooldown_text}. Your next use is available <t:${(((cooldown*1000)+parseInt(rows[0].utime))/1000).toFixed(0)}:R>`, null)], ephemeral: true })
            return false
        }
        await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have received a guaranteed slot.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`, null)], ephemeral: true })
        return true
    }

    async processReactablePoints(interaction) {
        const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        if (!this.#botSettings.backend.points) {
            await interaction.deferUpdate()
            return false
        }
        
        let points = 0
        let [userRows,] = await this.#db.promise().query(`SELECT points FROM users WHERE id = '${interaction.member.id}'`)
        if (userRows.length == 0) return this.#db.query(`INSERT INTO users (id) VALUES ('${interaction.member.id}')`)
        points = userRows[0].points

        if (points < this.#botSettings.points.earlylocation) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have enough points.\nYou currently have ${emote} \`${points}\` points\nEarly location costs ${emote} \`${this.#botSettings.points.earlylocation}\``, null)], ephemeral: true })
            return false
        }

        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            let descriptionMiddle = ``
            if (buttonInfo.confirmationMessage) descriptionMiddle = `${buttonInfo.confirmationMessage}\n`
            else descriptionMiddle = `You currently have ${emote} \`${points}\` points\nEarly location costs ${emote} \`${this.#botSettings.points.earlylocation}\`.\n`
            const text = `${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`
            const confirmButton = new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
            const {value: confirmValue, interaction: subInteraction} = await interaction.confirmPanel(text, buttonInfo.confirmationMedia, confirmButton, cancelButton, 10000, true)
            if (!subInteraction) {
                await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] }) 
                return false
            } else if (!confirmValue) {
                await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
                return false
            }
            interaction.deleteReply()
        }

        let locationText = ''
        if (buttonInfo.location) locationText = `The location for this run has been set to \`${this.location}\`, get there ASAP!${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`
        else locationText = `The location for this run is not given for this reaction.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`
        if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [extensions.createEmbed(interaction, locationText, null)], ephemeral: true })
        else await interaction.reply({ embeds: [extensions.createEmbed(interaction, locationText, null)], ephemeral: true })
        return true
    }

    async processReactableDrag(interaction) {
        const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        function isImageURL(url) {
            return /^https?:\/\/.+\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url)
        }

        if (this.dragMembers.includes(interaction.member.id)) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId}. Please wait for the RL to accept or deny you.`, null)], ephemeral: true })
            return this.removeFromActiveInteractions(interaction.member.id)
        }

        let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
        let descriptionEnd = `Press ⬆️ and upload an image (have a link on hand) to confirm your reaction. Otherwise press ❌`
        let descriptionMiddle = ``
        if (buttonInfo.confirmationMessage) descriptionMiddle = `${buttonInfo.confirmationMessage}\n`
        const text = `${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`
        const confirmButton = new Discord.ButtonBuilder()
            .setLabel('⬆️ Upload')
            .setStyle(Discord.ButtonStyle.Success)
        const cancelButton = new Discord.ButtonBuilder()
        const {value: confirmValue, interaction: subInteraction} = await interaction.confirmMenuPanel(text, buttonInfo.confirmationMedia, confirmButton, cancelButton, 30000, true)
        if (!subInteraction) {
            await interaction.editReply({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], components: [] }) 
            return false
        } else if (!confirmValue) {
            await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled. You can dismiss this message.`, null)], components: [] })
            return false
        } else if (!isImageURL(confirmValue)) {
            await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Invalid Image URL. You can dismiss this message.`, null)], components: [] })
            return false
        } else if (this.reactables[interaction.customId].members.length >= buttonInfo.limit) {
            await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for that. Try another react or try again next run.`, null)], components: [] })
            return false
        } else if (buttonInfo.parent) {
            for (let i of buttonInfo.parent) if (this.reactables[i].members.length >= this.#afkTemplate.buttons[i].limit) {
                await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for the main react ${i}. Try another react or try again next run.`, null)], components: [] })
                return false
            }
        }
        await subInteraction.update({ embeds: [extensions.createEmbed(interaction, `Successfully sent Image. You can dismiss this message.`, null)], components: [] })
        const threadEmbed = new Discord.EmbedBuilder()
            .setDescription(`${interaction.member.id}`)
            .setImage(confirmValue)
        const threadActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setCustomId(`${interaction.member.id}`)
                .setLabel('✅ Accept')
                .setStyle(Discord.ButtonStyle.Success),
            new Discord.ButtonBuilder()
                .setCustomId('Deny')
                .setLabel('❌ Deny')
                .setStyle(Discord.ButtonStyle.Danger)
        ])
        await this.raidDragThreads[interaction.customId].thread.send({ content: `${interaction.member}`, embeds: [threadEmbed], components: [threadActionRow] })
        this.dragMembers.push(interaction.member.id)
        return false
    }

    async processReactableOption(interaction) {
        const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``
        let points = this.#botSettings.points.miniBossGuessingPoints

        let failEmbed = new Discord.EmbedBuilder()
            .setTitle('Interaction Failed')
            .setDescription('You either cancelled your interaction, or the interaction timed out.\nTry again if this was a mistake')
            .setColor('#FF0000')
        let embed = new Discord.EmbedBuilder()
            .setTitle('Guess The MiniBoss!')
            .setDescription(`Choose one of the minibosses below.\nIf you guess correctly you get \`${points}\``)
            .setColor('#FFFFFF')
        await interaction.reply({ embeds: [embed], ephemeral: true, fetchReply: true })
        const choice = await interaction.confirmListEmojisWithText(
            Object.keys(buttonInfo.logOptions).map(key => this.#bot.storedEmojis[buttonInfo.logOptions[key].emojiName].id),
            Object.keys(buttonInfo.logOptions).map(key => buttonInfo.logOptions[key].name),
            Object.keys(buttonInfo.logOptions).map(key => buttonInfo.logOptions[key].emojiName),
            interaction.member.id)
        if (!choice || choice == 'Cancelled') {
            let ind = this.reactables[interaction.customId].members.indexOf(interaction.member.id)
            if (ind > -1) this.reactables[interaction.customId].members.splice(ind)
            return await interaction.editReply({ embeds: [failEmbed], ephemeral: true, components: [] }) 
        }
        let choicePrettyName = buttonInfo.logOptions[choice].name;
        let choiceEmote = this.#bot.storedEmojis[buttonInfo.logOptions[choice].emojiName].text;
        embed.setDescription(`You guessed ${choiceEmote} **${choicePrettyName}** ${choiceEmote}`)
        this.miniBossGuessing[interaction.member.id] = choice
        await interaction.followUp({ embeds: [embed], components: [], ephemeral: true })
        await interaction.deleteReply()
    }

    async dragInteractionHandler(interaction) {
        await interaction.message.delete()
        const memberID = interaction.message.embeds[0].description
        const member = this.#guild.members.cache.get(memberID)
        if (!member || !memberID) return
        const DMEmbed = extensions.createEmbed(interaction, 'PlaceHolder', null)
        if (interaction.customId == 'Deny') {
            let ind = this.dragMembers.indexOf(memberID)
            if (ind > -1) this.dragMembers.splice(ind)
            DMEmbed.setDescription(`You have been denied by ${interaction.member}.`)
            await member.send({ embeds: [DMEmbed], components: [] }).catch(er => {})
        } else {
            let customID = null
            for (let i in this.raidDragThreads) if (interaction.channel.id == this.raidDragThreads[i].thread.id) customID = i
            if (!customID) return
            const buttonInfo = this.#afkTemplate.buttons[customID]
            const position = this.reactables[customID].position
            const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``
            if (this.#afkTemplate.buttons[customID].location) DMEmbed.setDescription(`You have been accepted by ${interaction.member}.\nThe location for this run has been set to \`${this.location}\`, get there ASAP!${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            else DMEmbed.setDescription(`You have been accepted by ${interaction.member}.\nYou do not get location for this reaction.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            await member.send({ embeds: [DMEmbed], components: [] }).catch(er => {})

            this.reactables[customID].members.push(memberID)
            if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) {
                    const parentButtonInfo = this.#afkTemplate.buttons[i]
                    const parentPosition = this.reactables[i].position
                    const parentEmote = parentButtonInfo.emote ? `${parentButtonInfo.emote.text} ` : ``
                    if (!this.reactables[i].members.includes(memberID)) this.reactables[i].members.push(memberID)
                    if (parentButtonInfo.location && !this.earlyLocationMembers.includes(memberID)) this.earlyLocationMembers.push(memberID)
                    this.raidCommandsEmbed.data.fields[parentPosition].value = this.reactables[i].members.reduce((string, id, ind) => string + `${parentEmote ? parentEmote : ind+1}: <@!${id}>\n`, '')
                }
            }
            if (!this.earlySlotMembers.includes(memberID)) this.earlySlotMembers.push(memberID)
            if (buttonInfo.location && !this.earlyLocationMembers.includes(memberID)) this.earlyLocationMembers.push(memberID)
            this.raidCommandsEmbed.data.fields[position].value = this.reactables[customID].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            this.raidInfoEmbed = Discord.EmbedBuilder.from(this.raidCommandsEmbed)
            await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.raidInfoMessage.edit({ embeds: [this.raidInfoEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        }
    }

    async postAfk(interaction) {
        if (this.moveInEarlysTimer) clearInterval(this.moveInEarlysTimer)
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)

        if (this.#channel) {
            for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.#channel.setPosition(this.vcLounge.position + 1)
        }

        this.raidStatusEmbed.setDescription(`This afk check has been ended.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` If you get disconnected during the run, **JOIN LOUNGE** *then* press the huge **RECONNECT** button` : ``}`)
        this.raidStatusEmbed.setFooter({ text: `${this.#guild.name} • Ended by ${interaction ? this.#guild.members.cache.get(interaction.member.id).nickname : this.#guild.members.cache.get(this.#leader.id).nickname}`, iconURL: this.#guild.iconURL() })
        this.raidCommandsEmbed.setFooter({ text: `${this.#guild.name} • Ended by ${interaction ? this.#guild.members.cache.get(interaction.member.id).nickname : this.#guild.members.cache.get(this.#leader.id).nickname}`, iconURL: this.#guild.iconURL() })
        this.raidInfoEmbed.setFooter({ text: `${this.#guild.name} • Ended by ${interaction ? this.#guild.members.cache.get(interaction.member.id).nickname : this.#guild.members.cache.get(this.#leader.id).nickname}`, iconURL: this.#guild.iconURL() })
        this.raidChannelsEmbed.setFooter({ text: `${this.#guild.name} • Ended by ${interaction ? this.#guild.members.cache.get(interaction.member.id).nickname : this.#guild.members.cache.get(this.#leader.id).nickname}`, iconURL: this.#guild.iconURL() })

        const reconnectComponents = this.addReconnectButton()
        const deleteAndLoggingComponents = this.addDeleteandLoggingButtons()

        this.raidStatusMessage.reactions.removeAll()
        await this.raidStatusMessage.edit({ content: null, embeds: [this.raidStatusEmbed], components: reconnectComponents }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed], components: deleteAndLoggingComponents }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidChannelsMessage.edit({ embeds: [this.raidChannelsEmbed], components: deleteAndLoggingComponents }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))

        if (this.#channel) this.#channel.members.forEach(m => this.members.push(m.id))
        else this.earlySlotMembers.forEach(id => this.members.push(id))

        for (let u of this.members) {
            this.#db.query(`SELECT id FROM users WHERE id = '${u}'`, async (err, rows) => {
                if (err) return
                if (rows.length == 0) return this.#db.query(`INSERT INTO users (id) VALUES('${u}')`)
            })
        }
        
        if (this.#botSettings.backend.points) {
            let pointsLog = []
            for (let i in this.reactables) for (let memberID of this.reactables[i].members) {
                switch (this.#afkTemplate.buttons[i].type) {
                    case AfkTemplate.TemplateButtonType.OPTION:
                        if (this.miniBossGuessing.hasOwnProperty(memberID) && this.members.includes(memberID)) {
                            this.#db.query(`INSERT INTO miniBossEvent (userid, guildid, raidid, unixtimestamp, miniboss) VALUES ('${memberID}', '${this.#guild.id}', '${this.#raidID}', '${Date.now()}', '${this.miniBossGuessing[memberID]}')`)
                        }
                        break
                    case AfkTemplate.TemplateButtonType.SUPPORTER:
                        this.#db.query(`INSERT INTO supporterusage (guildid, userid, utime) VALUES ('${this.#guild.id}', '${memberID}', '${Date.now()}')`)
                    default:
                        let points = this.#afkTemplate.buttons[i].points
                        if (this.#afkTemplate.buttons[i].type != AfkTemplate.TemplateButtonType.POINTS && this.#guild.members.cache.get(memberID).roles.cache.hasAny(...this.#afkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                        this.#db.query(`UPDATE users SET points = points + ${points} WHERE id = '${memberID}'`, (err, rows) => {
                            if (err) return console.log(`error logging ${i} points in `, this.#guild.id)
                        })
                        pointsLog.push({ uid: memberID, points: points, reason: `${i}`})
                }
            }
            let pointlog_mid = await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.raidInfoEmbed)
            this.raidInfoEmbed.addFields({ name: 'Points Log MID', value: pointlog_mid })
        }
        let raiders_text = `Raiders`
        let raiders_value = `None!`
        this.members.forEach(m => {
            if (raiders_value.length >= 1000) {
                this.raidInfoEmbed.addFields({ name: raiders_text, value: raiders_value })
                raiders_text = `-`
                raiders_value = `, <@!${m}>`
            } else raiders_value == 'None!' ? raiders_value = `<@!${m}>` : raiders_value += `, <@!${m}>`
        })
        this.raidInfoEmbed.addFields({ name: raiders_text, value: raiders_value })
        await this.raidInfoMessage.edit({ embeds: [this.raidInfoEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#guild.channels.cache.get(this.#botSettings.channels.history).send({ embeds: [this.raidInfoEmbed] })

        this.logging = true
        this.completes++
        this.raidChannelsEmbed.data.fields[0].value = this.getLoggingText()
        await this.raidChannelsMessage.edit({ embeds: [this.raidChannelsEmbed] })
        setTimeout(this.loggingAfk.bind(this), 60000)
        this.active = false
        this.saveBotAfkCheck()
    }

    async loggingAfk() {
        if (this.#channel && this.#channel.members.size != 0) {
            this.members = []
            this.#channel.members.forEach(m => this.members.push(m.id))
        }
        for (let u of this.members) {
            let completionrunsValueNames = `userid, guildid, unixtimestamp, amount, templateid, raidid, parenttemplateid`
            let completionrunsValues = `'${u}', '${this.#guild.id}', '${Date.now()}', '1', '${this.#afkTemplate.templateID}', '${this.#raidID}', '${this.#afkTemplate.parentTemplateID}'`
            this.#db.query(`INSERT INTO completionruns (${completionrunsValueNames}) VALUES (${completionrunsValues})`, (err, rows) => {
                if (err) return console.log(`${u} could not be inserted into completionruns`)
            })
            if (this.#afkTemplate.logName) {
                this.#db.query(`UPDATE users SET ${this.#afkTemplate.logName} = ${this.#afkTemplate.logName} + 1 WHERE id = '${u}'`, (err, rows) => {
                    if (err) return console.log('error logging run completes in ', this.#guild.id)
                })
            }
            if (this.#botSettings.backend.points) {
                let points = this.#botSettings.points.perrun
                if (this.#guild.members.cache.get(u).roles.cache.hasAny(...this.#afkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                this.#db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`, (err, rows) => {
                    if (err) return console.log('error logging points for run completes in ', this.#guild.id)
                })
            }
            let [userRows,] = await this.#db.promise().query('SELECT * FROM completionruns WHERE userid = ? AND unixtimestamp > ?', [u, this.#botSettings.numerical.milestoneStartTimestamp])
            for (let milestoneName of Object.keys(milestones[this.#guild.id])) {
                let filteredUserRows = userRows.filter(row => milestones[this.#guild.id][milestoneName].templateIDs.includes(parseInt(row.templateid)))
                let completed = filteredUserRows.length
                let milestoneNumber = 0
                let index = 0
                while (completed >= milestoneNumber) {
                    milestoneNumber += milestones[this.#guild.id][milestoneName].milestones[index].number
                    if (completed == milestoneNumber) {
                        if (this.#botSettings.backend.points) {
                            this.#db.query(`UPDATE users SET points = points + ${milestones[this.#guild.id][milestoneName].milestones[index].points} WHERE id = '${u}'`, (err, rows) => {
                                if (err) return console.log('error logging points for milestones in ', this.#guild.id)
                            })
                            this.#guild.members.cache.get(u).send(`Congratulations! You have completed the ${milestones[this.#guild.id][milestoneName].milestones[index].number} ${milestoneName} milestone! You have been awarded ${milestones[this.#guild.id][milestoneName].milestones[index].points} points!`)
                        }
                    }
                    if (!milestones[this.#guild.id][milestoneName].milestones[index].recurring) index++
                }
            }
        }
        this.logging = false
    }

    addReconnectButton() {
        const reconnectActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('Reconnect')
                .setStyle(1)
                .setCustomId('reconnect')
        ])
        return [reconnectActionRow]
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

        if (this.#botSettings.backend.miniBossGuessing) {
            counter++
            const phaseMinibossButton = new Discord.ButtonBuilder()
                .setLabel('Set Miniboss')
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId('miniboss')
                .setEmoji(this.#bot.storedEmojis.oryxSanctuaryPortal.id)
            phaseActionRow.push(phaseMinibossButton)
        }

        for (let i in this.#afkTemplate.buttons) {
            if (this.#afkTemplate.buttons[i].type != AfkTemplate.TemplateButtonType.LOG && this.#afkTemplate.buttons[i].type != AfkTemplate.TemplateButtonType.LOG_SINGLE) continue
            const phaseButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(`Log ${i}`)
            phaseButton.setLabel(`Log ${i}`)
            if (this.#afkTemplate.buttons[i].emote) phaseButton.setEmoji(this.#afkTemplate.buttons[i].emote.id)
            phaseActionRow.push(phaseButton)
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
        this.flag = this.location ? {'us': ':flag_us:', 'eu': ':flag_eu:'}[this.location.toLowerCase().substring(0, 2)] : '' 
        await Promise.all([this.sendStatusMessage(this.phase), this.sendCommandsMessage(this.phase), this.sendChannelsMessage(this.phase)])
        for (let i of this.earlyLocationMembers) {
            let member = this.#guild.members.cache.get(i)
            await member.send(`The location for this run has been changed to \`${this.location}\`, get there ASAP!`)
        }
    }

    async updateReactsRequest(reactable, number) {
        let reactablesRequestActionRow = []
        const i = `${reactable}_request`
        this.reactables[i] = { members: [], position: this.reactables[reactable].position}
        this.#afkTemplate.buttons[i] = JSON.parse(JSON.stringify(this.#afkTemplate.buttons[reactable]))
        this.#afkTemplate.buttons[i].limit = number
        this.#afkTemplate.buttons[i].disableStart = 69
        this.#afkTemplate.buttons[i].start = 69
        this.#afkTemplate.buttons[i].lifetime = 69
        const emote = this.#afkTemplate.buttons[i].emote ? `${this.#afkTemplate.buttons[i].emote.text} ` : ``
        const reactableButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(i)
        let label = `${this.#afkTemplate.buttons[i].displayName ? `${reactable} ` : ``}${this.#afkTemplate.buttons[i].limit ? ` ${this.reactables[i].members.length}/${this.#afkTemplate.buttons[i].limit}` : ``}`
        reactableButton.setLabel(label)
        if (this.#afkTemplate.buttons[i].emote) reactableButton.setEmoji(this.#afkTemplate.buttons[i].emote.id)
        reactablesRequestActionRow.push(reactableButton)
        const component = new Discord.ActionRowBuilder({ components: reactablesRequestActionRow })

        let requestMessage = await this.#afkTemplate.raidStatusChannel.send({ content: `@here`, embeds: [extensions.createEmbed(this.#message, `${this.#leader} is requesting a ${emote}${reactable}.`)], components: [component] })
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
        const i = `${reactable}_request`
        const reactableButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(i)
        let label = `${this.#afkTemplate.buttons[i].displayName ? `${reactable} ` : ``}${this.#afkTemplate.buttons[i].limit ? ` ${this.reactables[i].members.length}/${this.#afkTemplate.buttons[i].limit}` : ``}`
        reactableButton.setLabel(label)
        if (this.#afkTemplate.buttons[i].emote) reactableButton.setEmoji(this.#afkTemplate.buttons[i].emote.id)
        if (this.reactables[i].members.length >= this.#afkTemplate.buttons[i].limit) reactableButton.setDisabled(true)
        reactablesRequestActionRow.push(reactableButton)
        const component = new Discord.ActionRowBuilder({ components: reactablesRequestActionRow })
        message.edit({ components: [component] })
    }
}