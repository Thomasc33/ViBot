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
        const afkTemplateNames = AfkTemplate.resolveTemplateAlias(message.guild.id, alias)
        if (afkTemplateNames.length == 0) return await message.channel.send('This afk template does not exist.')
        const afkTemplateName = afkTemplateNames.length == 1 ? afkTemplateNames[0] : await AfkTemplate.templateNamePrompt(message, afkTemplateNames)

        const afkTemplate = await AfkTemplate.AfkTemplate.tryCreate(bot, bot.settings[message.guild.id], message, afkTemplateName)
        if (afkTemplate instanceof AfkTemplate.AfkTemplateValidationError) {
            if (afkTemplate.invalidChannel()) await message.delete()
            await message.channel.send(afkTemplate.message())
            return
        }

        if (!afkTemplate.minimumStaffRoles.some(roles => roles.every(role => message.member.roles.cache.has(role.id)))) return await message.channel.send({embeds: [extensions.createEmbed(message, `You do not have a suitable set of roles out of ${afkTemplate.minimumStaffRoles.reduce((a, b) => `${a}, ${b.join(' + ')}`)} to run ${afkTemplate.name}.`, null)] })
        let location = args.join(' ')
        if (location.length >= 1024) return await message.channel.send('Location must be below 1024 characters, try again')
        if (location == '') location = 'None'
        message.react('✅')

        const afkModule = new afkCheck(afkTemplate, bot, db, message, location)
        await afkModule.createChannel()
        await afkModule.sendButtonChoices()
        await afkModule.sendInitialStatusMessage()
        await afkModule.createThreads()
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
        const storedAfkChecks = require('../data/afkChecks.json')
        for (let raidID in storedAfkChecks) {
            if (storedAfkChecks[raidID].guild.id != guild.id) continue
            const currentStoredAfkCheck = storedAfkChecks[raidID]
            const messageChannel = guild.channels.cache.get(currentStoredAfkCheck.message.channelId)
            const message = await messageChannel.messages.fetch(currentStoredAfkCheck.message.id)
            bot.afkChecks[raidID] = new afkCheck(currentStoredAfkCheck.afkTemplate, bot, db, message, currentStoredAfkCheck.location)
            await bot.afkChecks[raidID].loadBotAfkCheck(currentStoredAfkCheck)
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
    #message;
    #guild;
    #channel;
    #leader;
    #raidID;
    #pointlog_mid;

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
        this.#pointlog_mid = null

        this.members = [] // All members in the afk
        this.earlyLocationMembers = [] // All members with early location in the afk
        this.earlySlotMembers = [] // All members with early slots in the afk
        this.dragMembers = [] // All members currently in drag system in the afk
        this.reactables = Object.keys(afkTemplate.buttons).reduce((obj, key) => { obj[key] = { members: [], position: null, logged: 0 }; return obj }, {}) // All members of each reactable and position on embed
        this.miniBossGuessing = {}
        this.miniBossGuessed = false

        this.location = location // Location of the afk
        this.singleUseHotfixStopTimersDontUseThisAnywhereElse = false // DO NOT USE THIS. ITS A HOTFIX. https://canary.discord.com/channels/343704644712923138/706670131115196588/1142549685719027822
        // Phase 0 is a special case, before start delay has expired
        this.phase = this.#afkTemplate.startDelay > 0 ? 0 : 1 // Current phase of the afk
        this.timer = null // End time of the current phase of the AFK (Date)
        this.completes = 0 // Number of times the afk has been completed
        this.logging = false // Whether logging is active
        this.ended_by = null
        this.aborted_by = null
        this.deleted_by = null

        this.raidStatusMessage = null // raid status message
        this.raidStatusInteractionHandler = null // raid status interaction handler
        this.raidCommandsMessage = null // raid commands message
        this.raidInfoMessage = null // raid info message
        this.raidCommandsInteractionHandler = null // raid commands interaction handler
        this.raidChannelsMessage = null // raid channels message
        this.raidChannelsInteractionHandler = null // raid channels interaction handler
        this.vcLounge = this.#guild.channels.cache.get(this.#botSettings.voice.lounge)
        this.raidDragThreads = {}
        Object.keys(afkTemplate.buttons).forEach((key) => { if (afkTemplate.buttons[key].type == AfkTemplate.TemplateButtonType.DRAG) this.raidDragThreads[key] = { thread: null, collector: null } })
    }

    get active() {
        return !(this.ended_by || this.aborted_by || this.deleted_by)
    }

    #raidLeaderDisplayName() {
        return this.#leader.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
    }

    #afkTitle() {
        return `${this.#raidLeaderDisplayName()}'s ${this.#afkTemplate.name}`
    }

    #capButtons() {
        return Object.keys(this.#afkTemplate.buttons).filter(key => this.#afkTemplate.buttons[key].limit == 0)
    }

    #pingText() {
        return this.#afkTemplate.pingRoles ? `${this.#afkTemplate.pingRoles.join(' ')}, ` : ``
    }

    async start() {
        if (this.phase === 0) this.phase = 1
        this.timer = new Date(Date.now() + (this.#afkTemplate.body[this.phase].timeLimit * 1000))
        await Promise.all([this.sendStatusMessage(), this.sendCommandsMessage(), this.sendChannelsMessage()])
        this.startTimers()
        this.saveBotAfkCheck()
    }

    get flag() {
        return this.location ? {'us': ':flag_us:', 'eu': ':flag_eu:'}[this.location.toLowerCase().substring(0, 2)] : ''
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
                
                time: Date.now(),
                location: this.location,
                phase: this.phase,
                timer: this.timer.getTime(),
                completes: this.completes,
                ended_by: this.ended_by,
                aborted_by: this.aborted_by,
                deleted_by: this.deleted_by,

                raidStatusMessage: this.raidStatusMessage,
                raidCommandsMessage: this.raidCommandsMessage,
                pointlog_mid: this.#pointlog_mid,
                raidInfoMessage: this.raidInfoMessage,
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

        this.members = storedAfkCheck.members
        this.earlyLocationMembers = storedAfkCheck.earlyLocationMembers
        this.earlySlotMembers = storedAfkCheck.earlySlotMembers
        this.reactables = storedAfkCheck.reactables

        this.location = storedAfkCheck.location
        this.phase = storedAfkCheck.phase
        this.timer = new Date(storedAfkCheck.timer)
        this.completes = storedAfkCheck.completes
        this.ended_by = storedAfkCheck.ended_by == null ? null : this.#guild.members.cache.get(storedAfkCheck.ended_by.id)
        this.deleted_by = storedAfkCheck.deleted_by == null ? null : this.#guild.members.cache.get(storedAfkCheck.deleted_by.id)
        this.aborted_by = storedAfkCheck.aborted_by == null ? null : this.#guild.members.cache.get(storedAfkCheck.aborted_by.id)

        this.raidStatusMessage = await this.#afkTemplate.raidStatusChannel.messages.fetch(storedAfkCheck.raidStatusMessage.id)
        this.raidCommandsMessage = await this.#afkTemplate.raidCommandChannel.messages.fetch(storedAfkCheck.raidCommandsMessage.id)
        this.raidInfoMessage = await this.#afkTemplate.raidInfoChannel.messages.fetch(storedAfkCheck.raidInfoMessage.id)
        this.raidChannelsMessage = await this.#afkTemplate.raidActiveChannel.messages.fetch(storedAfkCheck.raidChannelsMessage.id)
        this.vcLounge = await this.#guild.channels.cache.get(this.#botSettings.voice.lounge)

        this.#pointlog_mid = storedAfkCheck.pointlog_mid

        if (this.phase <= this.#afkTemplate.phases) this.start()
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
            name: this.#afkTitle(),
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
                this.raidDragThreads[i].thread = await this.#afkTemplate.raidCommandChannel.threads.create({ name: `${this.#raidLeaderDisplayName()} Drag ${i}`, reason: `Dragging ${i} Reacts` })
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
            .setAuthor({ name: `AFK for ${this.#afkTemplate.name} by ${this.#raidLeaderDisplayName()}`, iconURL: this.#leader.user.avatarURL() })
            .setColor(this.#afkTemplate.body[this.phase || 1].embed.color ? this.#afkTemplate.body[this.phase || 1].embed.color : '#ffffff')
            .setTimestamp(Date.now())
    }

    #genRaidStatusEmbed() {
        const afkTemplateBody = this.#afkTemplate.body[this.phase || 1]
        const embed = this.#genEmbedBase()

        // This RNG might need to get fixed or it will change every time the embed is generated
        if (afkTemplateBody.embed.thumbnail) embed.setThumbnail(afkTemplateBody.embed.thumbnail[Math.floor(Math.random()*afkTemplateBody.embed.thumbnail.length)])

        if (this.phase == 0) {
            embed.setDescription(`\`${this.#afkTemplate.name}\`${this.flag ? ` in (${this.flag})` : ''} will begin in ${Math.round(this.#afkTemplate.startDelay)} seconds. Be prepared to join the raid.`)
            embed.setFooter({ text: this.#message.guild.name, iconURL: this.#message.guild.iconURL() })
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
        if (this.ended_by) components = this.addReconnectButton()
        if (this.aborted_by || this.deleted_by) components = []
        return { embeds: [this.#genRaidStatusEmbed()], components }
    }

    #genRaidCommandsEmbed() {
        const embed = this.#genEmbedBase()
        embed.setDescription(`**Raid Leader: ${this.#leader} \`\`${this.#leader.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.location}\`\` ${this.flag ? ` in (${this.flag})` : ''}`)
        embed.setFooter(this.#genEmbedFooter())

        let position = 0
        for (let i in this.#afkTemplate.buttons) {
            this.reactables[i].position = position
            embed.addFields({ name: `${this.#afkTemplate.buttons[i].emote ? this.#afkTemplate.buttons[i].emote.text : ''} ${i}${this.#afkTemplate.buttons[i].limit ? ` (${this.#afkTemplate.buttons[i].limit})` : ''}${this.#afkTemplate.buttons[i].location ? ` \`L\`` : `` }`, value: 'None!', inline: true })
            position++
        }

        for (const customId of Object.keys(this.reactables)) {
            const position = this.reactables[customId].position
            const buttonInfo = Object.values(this.#afkTemplate.buttons)[position]
            const emote = (buttonInfo && buttonInfo.emote) ? `${buttonInfo.emote.text} ` : ``
            if (this.reactables[customId].members.length == 0) {
                embed.data.fields[position].value = "None!"
            } else if (customId.includes('request')) {
                embed.data.fields[position].value = this.reactables[customId.substring(0, customId.length - 8)].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
                embed.data.fields[position].value += this.reactables[customId].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            } else if (this.reactables[`${customId}_request`]) {
                embed.data.fields[position].value = this.reactables[customId].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
                embed.data.fields[position].value += this.reactables[`${customId}_request`].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            } else {
                embed.data.fields[position].value = this.reactables[customId].members.reduce((string, id, ind) => string + `${emote ? emote : ind+1}: <@!${id}>\n`, '')
            }
            if (embed.data.fields[position].value.length >= 1024) embed.data.fields[position].value = '*Too many users to process*'
        }

        return embed
    }

    #genRaidCommands() {
        let components = this.getPhaseControls()
        if (this.aborted_by || this.deleted_by) components = []
        if (this.ended_by) components = this.addDeleteandLoggingButtons()
        return { embeds: [this.#genRaidCommandsEmbed()], components }
    }

    #genRaidInfoEmbed() {
        const embed = this.#genRaidCommandsEmbed()
        if (this.ended_by) {
            if (this.#pointlog_mid) embed.addFields({ name: 'Points Log MID', value: this.#pointlog_mid })

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
        embed.addFields({ name: `Logging Info`, value: this.getLoggingText(), inline: false })
        embed.setDescription(`**Raid Leader: ${this.#leader} \`\`${this.#leader.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.location}\`\` ${this.flag ? ` in (${this.flag})` : ''}\n\nWhenever the run is over. Click the button to delete the channel.`)
        embed.setFooter(this.#genEmbedFooter())
        return embed
    }

    #genRaidChannels() {
        let components = this.getPhaseControls()
        if (!this.active) components = this.addDeleteandLoggingButtons()

        return { content: `${this.#message.member}`, embeds: [this.#genRaidChannelsEmbed()], components }
    }

    async sendInitialStatusMessage() {
        this.#afkTemplate.processBody(this.#channel)
        
        const raidStatusMessageContents = {
            content: `${this.#pingText()}**${this.#afkTemplate.name}** ${this.flag ? ` (${this.flag})` : ''} by ${this.#leader} is starting inside of **${this.#guild.name}**${this.#channel ? ` in ${this.#channel}` : ``}`,
            embeds: [this.#afkTemplate.startDelay > 0 ? this.#genRaidStatusEmbed() : null]
        };
        [this.raidStatusMessage] = await Promise.all([
            this.#afkTemplate.raidStatusChannel.send(raidStatusMessageContents),
            this.#afkTemplate.body[1].message && this.#afkTemplate.raidStatusChannel.send({ content: `${this.#afkTemplate.body[1].message} in 5 seconds...` }).then(msg => setTimeout(async () => await msg.delete(), 5000)),
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

    async sendCommandsMessage() {
        const raidCommandsMessageContents = this.#genRaidCommands()
        const raidInfoMessageContents = this.#genRaidInfo();
        [
            this.raidCommandsMessage,
            this.raidInfoMessage
        ] = await Promise.all([
            this.raidCommandsMessage?.edit(raidCommandsMessageContents) || this.#afkTemplate.raidCommandChannel.send(raidCommandsMessageContents),
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
                .setLabel(`✅ ${this.#afkTemplate.body[this.phase].nextPhaseButton ? `${this.#afkTemplate.body[this.phase].nextPhaseButton}` : `Phase ${this.phase}`}`)
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
        for (let i in this.#afkTemplate.buttons) {
            if (i == 'MiniBossGuessing' && !this.#botSettings.backend.miniBossGuessing) { continue }
            let disableStart = this.#afkTemplate.buttons[i].disableStart
            let start = this.#afkTemplate.buttons[i].start
            let end = start + this.#afkTemplate.buttons[i].lifetime
            if (disableStart < start && disableStart > this.phase) continue
            if (!(disableStart < start) && start > this.phase) continue
            if (end <= this.phase) continue
            if (this.#capButtons().includes(i)) this.#afkTemplate.buttons[i].limit = this.#afkTemplate.cap
            const reactableButton = new Discord.ButtonBuilder()
                .setStyle(2)
                .setCustomId(`${i}`)
            let label = `${this.#afkTemplate.buttons[i].displayName ? `${i} ` : ``}${this.#afkTemplate.buttons[i].limit ? ` ${this.reactables[i].members.length}/${this.#afkTemplate.buttons[i].limit}` : ``}`
            reactableButton.setLabel(label)
            if (this.#afkTemplate.buttons[i].emote) reactableButton.setEmoji(this.#afkTemplate.buttons[i].emote.id)
            if (this.#afkTemplate.buttons[i].limit && this.reactables[i].members.length >= this.#afkTemplate.buttons[i].limit) reactableButton.setDisabled(true)
            if (disableStart < start && start > this.phase) reactableButton.setDisabled(true)
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

    #reactionIsFull(customId) {
        const buttonInfo = this.#afkTemplate.buttons[customId]
        return (buttonInfo.limit && this.reactables[customId].members.length >= buttonInfo.limit)
            || (buttonInfo.parent && buttonInfo.parent.some(i => this.reactables[i].members.length >= this.#afkTemplate.buttons[i].limit))
    }

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     */
    async interactionHandler(interaction) {
        if (!interaction.isButton()) return

        if (this.#afkTemplate.buttons[interaction.customId]) {
            const buttonType = this.#afkTemplate.buttons[interaction.customId].type
            const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
            const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

            if (buttonInfo.minRole && !interaction.member.roles.cache.has(buttonInfo.minRole.id)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have the required role ${buttonInfo.minRole} to react to this run.`, null)], ephemeral: true })
            }
            if (this.reactables[interaction.customId].members.includes(interaction.member.id)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId}. Try another react or try again next run.`, null)], ephemeral: true })
            }
            if (interaction.customId.includes('request') && this.reactables[interaction.customId.substring(0, interaction.customId.length - 8)].members.includes(interaction.member.id)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId.substring(0, interaction.customId - 7)}. Try another react or try again next run.`, null)], ephemeral: true })
            }
            if (this.#reactionIsFull(interaction.customId)) {
                return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for that. Try another react or try again next run.`, null)], ephemeral: true })
            }

            let confirmInteraction = false
            switch (buttonType) {
                case AfkTemplate.TemplateButtonType.LOG:
                case AfkTemplate.TemplateButtonType.LOG_SINGLE:
                case AfkTemplate.TemplateButtonType.NORMAL:
                    confirmInteraction = await this.processReactableNormal(interaction)
                    break
                case AfkTemplate.TemplateButtonType.SUPPORTER:
                    confirmInteraction = await this.processReactableSupporter(interaction)
                    break
                case AfkTemplate.TemplateButtonType.POINTS:
                    confirmInteraction = await this.processReactablePoints(interaction)
                    break
                case AfkTemplate.TemplateButtonType.DRAG:
                    confirmInteraction = await this.processReactableDrag(interaction)
                    break
                case AfkTemplate.TemplateButtonType.OPTION:
                    return await this.processReactableOption(interaction)
            }

            if (!confirmInteraction) return

            if (this.#reactionIsFull(interaction.customId)) {
                return await confirmInteraction.reply({ embeds: [extensions.createEmbed(interaction, `Too many people have already reacted and confirmed for that. Try another react or try again next run.`, null)], ephemeral: true })
            }

            if (this.reactables[interaction.customId].members.includes(interaction.member.id)) {
                return await confirmInteraction.reply({ embeds: [extensions.createEmbed(interaction, `You have already been confirmed for this reaction`, null)], ephemeral: true })
            }

            this.reactables[interaction.customId].members.push(interaction.member.id)

            if ([
                AfkTemplate.TemplateButtonType.LOG,
                AfkTemplate.TemplateButtonType.LOG_SINGLE,
                AfkTemplate.TemplateButtonType.NORMAL,
                AfkTemplate.TemplateButtonType.POINTS,
                AfkTemplate.TemplateButtonType.SUPPORTER
            ].includes(buttonType)) await this.reactableSendLoc(confirmInteraction, buttonInfo.location)

            if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) {
                    if (!this.reactables[i].members.includes(interaction.member.id)) this.reactables[i].members.push(interaction.member.id)
                    const parentButtonInfo = this.#afkTemplate.buttons[i]
                    if (parentButtonInfo.location && !this.earlyLocationMembers.includes(interaction.member.id)) this.earlyLocationMembers.push(interaction.member.id)
                }
            }
            if (!this.earlySlotMembers.includes(interaction.member.id)) this.earlySlotMembers.push(interaction.member.id)
            if (buttonInfo.location && !this.earlyLocationMembers.includes(interaction.member.id)) this.earlyLocationMembers.push(interaction.member.id)
            await Promise.all([
                this.raidCommandsMessage.edit(this.#genRaidCommands()).catch(er => ErrorLogger.log(er, this.#bot, this.#guild)),
                this.raidInfoMessage.edit(this.#genRaidInfo()).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            ])
            return
        }
        else if (['abort', 'phase', 'cap', 'additional', 'end', 'miniboss'].includes(interaction.customId) || interaction.customId.startsWith('log ')) {
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
            case "miniboss":
                await this.processPhaseMiniboss(interaction)
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

        for (let i in this.raidDragThreads) {
            if (this.raidDragThreads[i].collector) this.raidDragThreads[i].collector.stop()
            if (this.raidDragThreads[i].thread) await this.raidDragThreads[i].thread.delete()
        }

        if (this.moveInEarlysTimer) clearInterval(this.moveInEarlysTimer)
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)
        if (this.#channel) await this.#channel.delete()
        
        this.aborted_by = this.#guild.members.cache.get(interaction.member.id)

        this.raidStatusMessage.reactions.removeAll()
        await Promise.all([
            this.raidStatusMessage.edit({ content: null, ...this.#genRaidStatus() }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild)),
            this.raidCommandsMessage.edit(this.#genRaidCommands()),
            this.raidInfoMessage.edit(this.#genRaidInfo()).catch(er => ErrorLogger.log(er, this.#bot, this.#guild)),
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
        this.timer = new Date(Date.now() + (this.#afkTemplate.body[this.phase].timeLimit * 1000))
        if (this.updatePanelTimer) clearInterval(this.updatePanelTimer)
        
        const [tempRaidStatusMessage] = await Promise.all([
            this.#afkTemplate.body[this.phase].message && this.#afkTemplate.raidStatusChannel.send({ content: `${this.#afkTemplate.body[this.phase].message} in 5 seconds...` }),
            (interaction?.message.id == this.raidStatusMessage   ? interaction.editButtons({ disabled: true }) : this.raidStatusMessage.editButtons({ disabled: true })),
            (interaction?.message.id == this.raidCommandsMessage ? interaction.editButtons({ disabled: true }) : this.raidCommandsMessage.editButtons({ disabled: true })),
            (interaction?.message.id == this.raidChannelsMessage ? interaction.editButtons({ disabled: true }) : this.raidChannelsMessage.editButtons({ disabled: true }))
        ])

        setTimeout(async () => {
            if (this.#afkTemplate.body[this.phase].vcState == AfkTemplate.TemplateVCState.OPEN && this.#channel) for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            else if (this.#afkTemplate.body[this.phase].vcState == AfkTemplate.TemplateVCState.LOCKED && this.#channel) for (let minimumJoinRaiderRole of this.#afkTemplate.minimumJoinRaiderRoles) await this.#channel.permissionOverwrites.edit(minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
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
        const button = interaction.customId.split(' ')[2]
        const buttonType = interaction.customId.split(' ')[1]
        const buttonInfo = this.#afkTemplate.buttons[button]

        let member = null
        let number = 1
        let logOption = buttonInfo.logOptions[interaction.customId.split(' ')[1]]
        let isModded = interaction.customId.split(' ')[1] == 'Modded'
        let choiceText = buttonInfo.emote ? `${buttonInfo.emote.text} **${buttonType} ${button}**` : `**${buttonType} ${button}**`

        if (this.reactables[button].members.length == 0) {
            [member, interaction] = await this.#keyNameInputPrompt(interaction)
            if (!member) return
        } else if (this.reactables[button].members.length == 1) {
            member = this.#guild.members.cache.get(this.reactables[button].members[0])
        } else {
            const text1 = `Which member do you want to log ${choiceText} reacts for this run?\nChoose or input a username or id.`
            const confirmMemberMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Name of ${button}s`)
            for (let i of this.reactables[button].members) confirmMemberMenu.addOptions({ label: this.#guild.members.cache.get(i).nickname, value: i })
            const {value: confirmMemberValue, interaction: logKeyInteraction} = await interaction.selectPanel(text1, null, confirmMemberMenu, 10000, true, true)
            if (confirmMemberValue) member = this.#lookupGuildMember(confirmMemberValue)
            if (!logKeyInteraction) return await interaction.followUp({ embeds: [extensions.createEmbed(interaction, `Timed out. You can dismiss this message.`, null)], ephemeral: true })
            else if (!member) return await logKeyInteraction.update({ embeds: [extensions.createEmbed(interaction, `Cancelled or Invalid Member. You can dismiss this message.`, null)], components: [] })
            interaction = logKeyInteraction
        }

        const keyCountMsg = await interaction.reply({
            embeds: [
                new Discord.EmbedBuilder()
                    .setDescription(`Logging ${number} ${choiceText} for ${member}.`)
                    .setFooter({ text: `${interaction.guild.name} • ${this.#afkTitle()}`, iconURL: interaction.guild.iconURL() })
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
                    .setTitle(`${button} logged!`)
                    .setDescription(`${member} now has \`\`${parseInt(rows[0][option]) + parseInt(number)}\`\` (+\`${number}\`) ${choiceText} pops`)
                    .setFooter({ text: `${interaction.guild.name} • ${this.#afkTitle()}`, iconURL: interaction.guild.iconURL() })
                await (this.raidCommandsMessage?.reply({ embeds: [embed] }) || this.#afkTemplate.raidCommandChannel.send({ embeds: [embed] }))
            })
        }
        if (this.#botSettings.backend.points) {
            let points = logOption.points * number * logOption.multiplier
            await this.#db.promise().query('UPDATE users SET points = points + ? WHERE id = ?', [points, member.id])
            let pointsLog = [{ uid: member.id, points: points, reason: `${button}`}]
            await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.#genEmbedBase())
        }
        this.reactables[button].logged += number
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

        for (let i in this.raidDragThreads) {
            if (this.raidDragThreads[i].collector) this.raidDragThreads[i].collector.stop()
            if (this.raidDragThreads[i].thread) await this.raidDragThreads[i].thread.delete()
        }

        if (this.#channel) await this.#channel.delete()

        this.deleted_by = this.#guild.members.cache.get(interaction.member.id)

        await Promise.all([
            this.raidStatusMessage.edit({ content: null, ...this.#genRaidStatus() }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild)),
            this.raidCommandsMessage.edit(this.#genRaidCommands()),
            this.raidInfoMessage.edit(this.#genRaidInfo()).catch(er => ErrorLogger.log(er, this.#bot, this.#guild)),
            this.raidChannelsMessage.delete()
        ])
        this.saveBotAfkCheck(true)
    }

    async processPhaseMiniboss(interaction) {
        const buttonInfo = this.#afkTemplate.buttons['MiniBossGuessing']

        if (this.miniBossGuessed) {
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
        if (!choice || choice == 'Cancelled') {
            return interaction.editReply({ embeds: [failEmbed], ephemeral: true, components: [] })
        }

        let choicePrettyName = buttonInfo.logOptions[choice].name;
        let choiceEmote = this.#bot.storedEmojis[buttonInfo.logOptions[choice].emojiName].text;
        embed.setDescription(`You set the Miniboss to ${choiceEmote} **${choicePrettyName}** ${choiceEmote}\nThank you!`)

        await interaction.followUp({ embeds: [embed], components: [], ephemeral: true })
        await interaction.deleteReply()

        const [rows] = await this.#db.promise().query('SELECT userid FROM miniBossEvent WHERE guildid = ? AND raidid = ? AND miniboss = ?', [this.#guild.id, this.#raidID, choice])
        await this.#db.promise().query('UPDATE users SET points = points + ? WHERE id IN (?)', [points, rows.map(row => row.userid)])
        rows.forEach(row => {
            let user = this.#guild.members.cache.get(row.userid)
            try {
                user.send(`Congratulations!\nYou have been awarded ${points} points for guessing the correct miniboss!\nThe Miniboss was ${choiceEmote} **${choicePrettyName}** ${choiceEmote}`)
            } catch (e) {
                console.log('Could not DM user\n\n', e)
            }
        })
        this.miniBossGuessed = true
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
            return subInteraction
        }
        return interaction
    }

    async processReactableSupporter(interaction) {    
        const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
       
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

    async processReactablePoints(interaction) {
        const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        if (!this.#botSettings.backend.points) {
            await interaction.deferUpdate()
            return false
        }
        
        let points = 0
        let [userRows,] = await this.#db.promise().query('SELECT points FROM users WHERE id = ?', [interaction.member.id])
        if (userRows.length == 0) return this.#db.promise().query('INSERT INTO users (id) VALUES (?)', [interaction.member.id])
        points = userRows[0].points

        if (points < this.#botSettings.points.earlylocation) {
            await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You do not have enough points.\nYou currently have ${emote} \`${points}\` points\n${buttonInfo.location ? `Early location` : `A guaranteed slot in the channel`} costs ${emote} \`${this.#botSettings.points.earlylocation}\``, null)], ephemeral: true })
            return false
        }

        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            let descriptionMiddle = ``
            if (buttonInfo.confirmationMessage) descriptionMiddle = `${buttonInfo.confirmationMessage}\n`
            else descriptionMiddle = `You currently have ${emote} \`${points}\` points\n${buttonInfo.location ? `Early location` : `A guaranteed slot in the channel`} costs ${emote} \`${this.#botSettings.points.earlylocation}\`.\n`
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
            return subInteraction
        }
        return interaction
    }

    async processReactableDrag(interaction) {
        const buttonInfo = this.#afkTemplate.buttons[interaction.customId]
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        function isImageURL(url) {
            return /^https?:\/\/.+\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url)
        }

        if (this.dragMembers.includes(interaction.member.id)) {
            return await interaction.reply({ embeds: [extensions.createEmbed(interaction, `You have already reacted as ${emote}${interaction.customId}. Please wait for the RL to accept or deny you.`, null)], ephemeral: true })
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
            if (this.#afkTemplate.buttons[customID].location) DMEmbed.setDescription(`You have been accepted by ${interaction.member}.\nThe location for this run has been set to \`${this.location}\`, get there ASAP!${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            else DMEmbed.setDescription(`You have been accepted by ${interaction.member}.\nYou do not get location for this reaction.${this.#afkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            await member.send({ embeds: [DMEmbed], components: [] }).catch(er => {})

            this.reactables[customID].members.push(memberID)
            if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) {
                    if (!this.reactables[i].members.includes(memberID)) this.reactables[i].members.push(memberID)
                    if (parentButtonInfo.location && !this.earlyLocationMembers.includes(memberID)) this.earlyLocationMembers.push(memberID)
                }
            }
            if (!this.earlySlotMembers.includes(memberID)) this.earlySlotMembers.push(memberID)
            if (buttonInfo.location && !this.earlyLocationMembers.includes(memberID)) this.earlyLocationMembers.push(memberID)
            await this.raidCommandsMessage.edit(this.#genRaidCommands()).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.raidInfoMessage.edit(this.#genRaidInfo()).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        }
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
            (interaction?.message.id == this.raidStatusMessage   ? interaction.update(this.#genRaidStatus()) : this.raidStatusMessage.edit(this.#genRaidStatus())).catch(er => ErrorLogger.log(er, this.#bot, this.#guild)),
            (interaction?.message.id == this.raidCommandsMessage ? interaction.update(this.#genRaidCommands()) : this.raidCommandsMessage.edit(this.#genRaidCommands())).catch(er => ErrorLogger.log(er, this.#bot, this.#guild)),
            (interaction?.message.id == this.raidChannelsMessage ? interaction.update(this.#genRaidChannels()) : this.raidChannelsMessage.edit(this.#genRaidChannels())).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        ])

        let members = []
        if (this.#channel) this.#channel.members.forEach(m => members.push(m.id))
        else this.earlySlotMembers.forEach(id => members.push(id))

        if (members.length > 0) {
            let [db_members] = await this.#db.promise().query('SELECT id FROM users WHERE id IN (?)', [members])
            db_members = db_members.map(u => u.id)
            const new_members = members.filter(u => !db_members.includes(u))
            if (new_members.length > 0) await this.#db.promise().query('INSERT INTO users (id) VALUES (?)', [new_members])
        }
        
        if (this.#botSettings.backend.points) {
            let pointsLog = []
            for (let i in this.reactables) for (let memberID of this.reactables[i].members) {
                switch (this.#afkTemplate.buttons[i].type) {
                    case AfkTemplate.TemplateButtonType.OPTION:
                        if (this.miniBossGuessing.hasOwnProperty(memberID) && members.includes(memberID)) {
                            this.#db.query(`INSERT INTO miniBossEvent (userid, guildid, raidid, unixtimestamp, miniboss) VALUES ('${memberID}', '${this.#guild.id}', '${this.#raidID}', '${Date.now()}', '${this.miniBossGuessing[memberID]}')`)
                        }
                        break
                    case AfkTemplate.TemplateButtonType.SUPPORTER:
                        this.#db.query(`INSERT INTO supporterusage (guildid, userid, utime) VALUES ('${this.#guild.id}', '${memberID}', '${Date.now()}')`)
                    default:
                        let points = this.#afkTemplate.buttons[i].points
                        if (this.#afkTemplate.buttons[i].type != AfkTemplate.TemplateButtonType.POINTS && this.#guild.members.cache.get(memberID).roles.cache.hasAny(...this.#afkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                        await this.#db.promise().query('UPDATE users SET points = points + ? WHERE id = ?', [points, memberID])
                        pointsLog.push({ uid: memberID, points: points, reason: `${i}`})
                }
            }
            this.#pointlog_mid = await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.#genEmbedBase())
        }
        await this.raidInfoMessage.edit(this.#genRaidInfo()).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#guild.channels.cache.get(this.#botSettings.channels.history).send({ embeds: [this.#genRaidInfoEmbed()] })

        this.logging = true
        this.completes++
        await this.raidChannelsMessage.edit(this.#genRaidChannels())
        setTimeout(this.loggingAfk.bind(this), 60000)
        this.saveBotAfkCheck()
    }

    async loggingAfk() {
        this.members = this.#channel && this.#channel.members.size != 0 ? this.#channel.members.map(m => m.id) : []
        if (this.members.length > 0) {
            await this.#db.promise().query('INSERT INTO completionruns (??) VALUES ?', [
                                      ['userid', 'guildid',      'unixtimestamp', 'amount', 'templateid',                 'raidid',     'parenttemplateid'],
                     this.members.map(u => [u,        this.#guild.id, Date.now(),      1,        this.#afkTemplate.templateID, this.#raidID, this.#afkTemplate.parentTemplateID])
            ])
            if (this.#afkTemplate.logName) {
                await this.#db.promise().query('UPDATE users SET ?? = ?? + 1 WHERE id IN (?)', [this.#afkTemplate.logName, this.#afkTemplate.logName, [...this.members]])
            }
        }
        for (let u of this.members) {
            if (this.#botSettings.backend.points) {
                let points = this.#botSettings.points.perrun
                if (this.#guild.members.cache.get(u).roles.cache.hasAny(...this.#afkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                this.#db.query('UPDATE users SET points = points + ? WHERE id = ?', [points, u], (err, rows) => {
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
                    if (completed != milestoneNumber) { continue }
                    if (!this.#botSettings.backend.points) { continue }
                    let isMilestoneRecurring = milestones[this.#guild.id][milestoneName].milestones[index].recurring
                    let [hasGottenMilestone,] = await this.#db.promise().query('SELECT * FROM milestoneAchievements WHERE userid = ? AND guildid = ? AND milestoneName = ? AND milestoneIndex = ?', [
                        u, this.#guild.id, milestoneName, index])
                    if (hasGottenMilestone.length > 0 && !isMilestoneRecurring) { continue }
                    this.#db.query('UPDATE users SET points = points + ? WHERE id = ?', [milestones[this.#guild.id][milestoneName].milestones[index].points, u], (err, rows) => {
                        if (err) return console.log('error logging points for milestones in ', this.#guild.id)
                    })
                    this.#db.query('INSERT INTO milestoneAchievements (??) VALUES (?)', [
                        ['userid', 'guildid', 'milestoneName', 'milestoneIndex'],
                        [u, this.#guild.id, milestoneName, index]
                    ], (err, rows) => {
                        if (err) return console.log(`error inserting ${u} into milestoneAchievements.\nUser ID: ${u}\nGuild ID: ${this.#guild.id}\nMilestone Name: ${milestoneName}\nMilestone Index: ${index}`)
                    })
                    this.#guild.members.cache.get(u).send(`Congratulations! You have completed the ${milestones[this.#guild.id][milestoneName].milestones[index].number} ${milestoneName} milestone! You have been awarded ${milestones[this.#guild.id][milestoneName].milestones[index].points} points!`)
                    if (!milestones[this.#guild.id][milestoneName].milestones[index].recurring) index++
                }
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
            const logOptions = Object.keys(this.#afkTemplate.buttons[i].logOptions)
            const phaseButtons = logOptions.map(type => {
                const phaseButton = new Discord.ButtonBuilder()
                            .setStyle(2)
                            .setCustomId(`log ${type} ${i}`)
                            .setLabel(logOptions.length > 1 ? `Log ${type} ${i}` : `Log ${i}`)
                if (this.#afkTemplate.buttons[i].emote) phaseButton.setEmoji(this.#afkTemplate.buttons[i].emote.id)
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
