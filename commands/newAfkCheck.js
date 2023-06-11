const Discord = require('discord.js')
const AfkTemplate = require('./newAfkTemplate.js')
const Channels = require('./vibotChannels')
const fs = require('fs')
const ErrorLogger = require('../lib/logError')
const realmEyeScrape = require('../lib/realmEyeScrape')
const points = require('./points')
const keyRoles = require('./keyRoles')
const restart = require('./restart')
const EventEmitter = require('events').EventEmitter
const pointLogger = require('../lib/pointLogger')
const afkTemplates = require('../data/afkTemplates.json')
const bannedNames = require('../data/bannedNames.json')
var emitter = new EventEmitter()
require(`../lib/extensions`)

var runs = [] //{channel: id, afk: afk instance}
var registeredWithRestart = false
var registeredWithVibotChannels = false

module.exports = {
    name: 'newafk',
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
        // NEEDS TO BE RETOOLED
        if (!registeredWithRestart) {
            restart.registerAFKCheck(module.exports)
            registeredWithRestart = true
        }
        if (!registeredWithVibotChannels) {
            Channels.registerAFKCheck(module.exports)
            registeredWithVibotChannels = true
        }
        // NEEDS TO BE RETOOLED
        let alias = args.shift().toLowerCase()
        const afkTemplate = new AfkTemplate.AfkTemplate(bot, bot.settings[message.guild.id], message, alias)
        await afkTemplate.init()
        const currentStatus = afkTemplate.getStatus()
        if (currentStatus.state != AfkTemplate.TemplateState.SUCCESS) return await message.channel.send(currentStatus.message)
        if (message.guild.members.cache.get(message.member.id).roles.highest.position < afkTemplate.minimumStaffRole.position) return await message.channel.send(`You do not have a suitable role above ${afkTemplate.minimumStaffRole.position} to run ${afkTemplate.name}.`)
        let location = args.join(' ')
        if (location.length >= 1024) return await message.channel.send('Location must be below 1024 characters, try again')
        if (location == '') location = 'None'

        const afkModule = new afkCheck(afkTemplate, bot, db, message, location)
        await afkModule.createChannel()
        await afkModule.sendButtonChoices()
        await afkModule.sendInitialStatusMessage()
        await afkModule.createThreads()
        afkModule.updateBotAfkCheck()
        if (afkTemplate.startDelay > 0) {
            setTimeout(start, afkTemplate.startDelay*1000, afkModule)
        }
        else {
            start(afkModule)
        }
    },
    // NEEDS TO BE RETOOLED
    changeLocation(location, channelID) {
        for (const run of runs) {
            if (run.channel == channelID) {
                run.afk.changeLocation(location);
                return;
            }
        }
        return 'Run not found';
    },
    async checkRuns() {
        let activeRuns = []
        for (let i of runs)
            if (i.afk.active) activeRuns.push(i.channel)
        return activeRuns
    },
    async returnRunByID(channel_id) {
        for (let i of runs) {
            if (i.afk.active && i.channel == channel_id) { return i.afk; }
        }
        return undefined;
    }
    // NEEDS TO BE RETOOLED
}

async function start(afkModule) {
    await Promise.all([afkModule.sendStatusMessage(),afkModule.sendCommandsMessage(), afkModule.sendChannelsMessage()])
    afkModule.startTimers()
}

class afkCheck {
    /**
     * @param {newAfkTemplate} newAfkTemplate
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     * @param {Discord.Message} message
     * @param {String} location
     */
    #bot;
    #botSettings;
    #db;
    #newAfkTemplate;
    #message;
    #guild;
    #channel;
    #leader;
    #raidID;

    constructor(newAfkTemplate, bot, db, message, location) {
        this.#bot = bot // bot
        this.#botSettings = bot.settings[message.guild.id] // bot settings
        this.#newAfkTemplate = newAfkTemplate // static AFK template
        this.#db = db // bot database
        this.#message = message // message of the afk
        this.#guild = message.guild // guild of the afk
        this.#channel = null // channel of the afk
        this.#leader = message.member // leader of the afk
        this.#raidID = null // ID of the afk

        this.members = [] // All members in the afk
        this.earlyMembers = [] // All members with early slots in the afk
        this.dragMembers = [] // All members currently in drag system in the afk
        this.openInteractions = [] // All members currently in the middle of a button interaction
        this.reactables = {} // All members of each reactable and position on embed
        Object.keys(newAfkTemplate.buttons).forEach((key) => this.reactables[key] = { members: [], position: null }) 
        this.location = location // Location of the afk
        this.phase = 1 // Current phase of the afk
        this.timer = null // Time left until next phase (in seconds)
        this.active = true // Whether the afk is active

        this.raidStatusEmbed = null // raid status embed
        this.raidStatusMessage = null // raid status message
        this.raidStatusInteractionHandler = null // raid status interaction handler
        this.raidCommandsEmbed = null // raid commands embed
        this.raidCommandsMessage = null // raid commands message
        this.raidInfoMessage = null // raid info message
        this.raidCommandsInteractionHandler = null // raid commands interaction handler
        this.raidChannelsEmbed = null // raid channels embed
        this.raidChannelsMessage = null // raid channels message
        this.raidChannelsInteractionHandler = null // raid channels interaction handler
        this.raidDragThreads = {}
        Object.keys(newAfkTemplate.buttons).forEach((key) => { if (newAfkTemplate.buttons[key].type == AfkTemplate.TemplateButtonType.DRAG) this.raidDragThreads[key] = { thread: null, collector: null } }) 
    }
    
    updateBotAfkCheck() {
        this.#bot.afkChecks[this.#raidID] = {
            guild: this.#guild.id,
            channel: this.#channel ? this.#channel.id : null,
            leader: this.#leader.id,
            leaderNick: this.#leader.displayName.replace(/[^a-z|]/gi, '').split('|')[0],
            time: Date.now(),
            active: this.active,
            newAfkTemplate: this.#newAfkTemplate,
            members: this.members,
            earlyMembers: this.earlyMembers,
            reactables: this.reactables,
            location: this.location,
            phase: this.phase
        }
        fs.writeFileSync('./data/afkChecks.json', JSON.stringify(this.#bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.#bot, this.#guild) })
    }

    async createChannel() {
        if (this.#newAfkTemplate.vcOptions == AfkTemplate.TemplateVCOptions.NO_VC) return
        else if (this.#newAfkTemplate.vcOptions == AfkTemplate.TemplateVCOptions.STATIC_VC) return this.#channel = this.#leader.voice.channel
        let raidLeaderDisplayName = this.#leader.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
        let channel = await this.#newAfkTemplate.raidTemplateChannel.clone({
            name: `${raidLeaderDisplayName}'s ${this.#newAfkTemplate.name}`,
            parent: this.#newAfkTemplate.raidCategory.id,
            userLimit: this.#newAfkTemplate.cap,
            position: 0
        })
        await this.#leader.voice.setChannel(channel).catch(er => {})
        await channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumViewRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await channel.permissionOverwrites.edit(this.#leader.id, { Connect: true, ViewChannel: true, Speak: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        this.#channel = channel
    }

    async sendButtonChoices() {
        this.#newAfkTemplate.processButtons(this.#channel)
        this.#newAfkTemplate.processReacts()
        let buttonChoices = this.#newAfkTemplate.getButtonChoice()
        let newButtonChoices = []
        for (let i of buttonChoices) {
            if (this.#newAfkTemplate.buttons[i].minStaffRole && this.#leader.roles.highest.position < this.#newAfkTemplate.buttons[i].minStaffRole.position) continue
            let choiceText = this.#newAfkTemplate.buttons[i].emote ? `${this.#newAfkTemplate.buttons[i].emote.text} **${i}**` : `**${i}**` 
            let confirmEmbed = new Discord.EmbedBuilder()
            switch (this.#newAfkTemplate.buttons[i].choice) {
                case AfkTemplate.TemplateButtonChoice.YES_NO_CHOICE:
                    confirmEmbed.setDescription(`Do you want to add ${choiceText} reacts to this run?\nPress ✅ to add this react. Otherwise press ❌ to remove it.\nThis window will close in 10 seconds and use the default ${this.#newAfkTemplate.buttons[i].limit} ${choiceText}.`)
                    const confirmButton1 = new Discord.ButtonBuilder()
                        .setCustomId('Confirmed')
                        .setLabel('✅ Confirm')
                        .setStyle(Discord.ButtonStyle.Success)
                    const cancelButton1 = new Discord.ButtonBuilder()
                        .setCustomId('Cancelled')
                        .setLabel('❌ Cancel')
                        .setStyle(Discord.ButtonStyle.Danger)
                    const confirmMessage1 = await this.#message.channel.send({ content: `${this.#leader}`, embeds: [confirmEmbed] })
                    const confirmValue1 = await confirmMessage1.confirmPanel(confirmButton1, cancelButton1, this.#leader.id, 10000)
                    await confirmMessage1.delete()
                    this.#newAfkTemplate.buttons[i].limit = (confirmValue1 == null || confirmValue1) ? this.#newAfkTemplate.buttons[i].limit : 0
                    break
                case AfkTemplate.TemplateButtonChoice.NUMBER_CHOICE:
                    confirmEmbed.setDescription(`How many ${choiceText} reacts do you want to add to this run?\nChoose or input a number for how many reacts you want.\nThis window will close in 10 seconds and use the default ${this.#newAfkTemplate.buttons[i].limit} ${choiceText}.`)
                    const confirmMenu = new Discord.StringSelectMenuBuilder()
                        .setCustomId(`limit`)
                        .setPlaceholder(`Number of ${i}s`)
                        .setMinValues(1)
                        .setMaxValues(1)
                        .setOptions(
                            { label: '0', value: '0' },
                            { label: '1', value: '1' },
                            { label: '2', value: '2' },
                            { label: '3', value: '3' }
                        )
                    const confirmMessage2 = await this.#message.channel.send({ content: `${this.#leader}`, embeds: [confirmEmbed] })
                    const confirmValue2 = await confirmMessage2.selectPanel(confirmMenu, this.#leader.id, 10000)
                    await confirmMessage2.delete()
                    this.#newAfkTemplate.buttons[i].limit = Number.isInteger(parseInt(confirmValue2)) ? parseInt(confirmValue2) : this.#newAfkTemplate.buttons[i].limit
                    break
            }
            if (this.#newAfkTemplate.buttons[i].limit == 0) {
                newButtonChoices.push(i)
                delete this.reactables[i]
            }
        }
        this.#newAfkTemplate.updateButtonChoice(newButtonChoices)
    }

    async createThreads() {
        let raidLeaderDisplayName = this.#leader.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
        for (let i in this.#newAfkTemplate.buttons) if (this.#newAfkTemplate.buttons[i].type == AfkTemplate.TemplateButtonType.DRAG) {
            this.raidDragThreads[i].thread = await this.#newAfkTemplate.raidCommandChannel.threads.create({
                name: `${raidLeaderDisplayName} Drag ${i}`,
                reason: `Dragging ${i} Reacts`
            })
            this.raidDragThreads[i].collector = new Discord.InteractionCollector(this.#bot, { channel: this.raidDragThreads[i].thread, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidDragThreads[i].collector.on('collect', (interaction) => this.dragInteractionHandler(interaction))
            const embed = new Discord.EmbedBuilder()
            const emote = this.#newAfkTemplate.buttons[i].emote ? `${this.#newAfkTemplate.buttons[i].emote.text} ` : ``
            let descriptionBeginning = `This thread is for the ${emote}${i}.\n`
            let descriptionEnd = `Press ✅ on images to allow. Otherwise press ❌ to deny.`
            let descriptionMiddle = ``
            if (this.#newAfkTemplate.buttons[i].confirmationMessage) descriptionMiddle = this.#newAfkTemplate.buttons[i].confirmationMessage
            embed.setDescription(`${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`)
            if (this.#newAfkTemplate.buttons[i].confirmationMedia) embed.setImage(this.#newAfkTemplate.buttons[i].confirmationMedia)
            await this.raidDragThreads[i].thread.send({ embeds: [embed] })
        }
    }

    startTimers() {
        this.moveInEarlysTimer = setInterval(() => this.moveInEarlys(), 10000)
        this.updateStatusTimer = setInterval(() => this.updateStatus(), 5000)
    }

    async moveInEarlys() {
        for (let i of this.earlyMembers) {
            let member = this.#guild.members.cache.get(i)
            if (!member.voice.channel) continue
            if (member.voice.channel.name.includes('lounge') || member.voice.channel.name.includes('Lounge') || member.voice.channel.name.includes('drag')) await member.voice.setChannel(this.channel.id).catch(er => { })
        }
    }

    async updateStatus() {
        if (!this.timer) this.timer = this.#newAfkTemplate.body[this.phase].timeLimit
        this.timer = this.timer - 5
        if (this.timer == 0) return this.processPhaseNext()
        if (!this.raidStatusMessage) return
        this.raidStatusEmbed.setFooter({ text: `Time Remaining: ${Math.floor(this.timer / 60)} minutes and ${this.timer % 60} seconds` });
        let reactables = this.getReactables()
        let components = reactables.concat(this.getPhaseControls())
        if (this.raidStatusMessage) await this.raidStatusMessage.edit({ embeds: [this.raidStatusEmbed], components: components })
    }

    removeFromActiveInteractions(id) {
        let ind = this.openInteractions.indexOf(id)
        if (ind > -1) this.openInteractions.splice(ind)
    }

    async sendInitialStatusMessage() {
        this.#newAfkTemplate.processBody(this.#channel)
        let flag = {'us': ':flag_us:', 'eu': ':flag_eu:'}[this.location.substring(0, 2)]
        let pingText = this.#newAfkTemplate.pingRoles.join(' ')
        this.raidStatusEmbed = new Discord.EmbedBuilder()
            .setColor(this.#newAfkTemplate.body[this.phase].embed.color ? this.#newAfkTemplate.body[this.phase].embed.color : '#ffffff')
            .setDescription(`\`${this.#newAfkTemplate.name}\`${flag ? ` in (${flag})` : ''} will begin in ${Math.round(this.#newAfkTemplate.startDelay)} seconds. Be prepared to join the raid.`)
        if (this.#newAfkTemplate.body[this.phase].embed.thumbnail) this.raidStatusEmbed.setThumbnail(this.#newAfkTemplate.body[this.phase].embed.thumbnail[Math.floor(Math.random()*this.#newAfkTemplate.body[this.phase].embed.thumbnail.length)])
        this.raidStatusMessage = await this.#newAfkTemplate.raidStatusChannel.send({
            content: `${pingText}, ${this.#newAfkTemplate.name}${flag ? ` (${flag})` : ''}. Reactables will be prioritised. After everything is confirmed, the channel will open up.`,
            embeds: [this.#newAfkTemplate.startDelay > 0 ? this.raidStatusEmbed : null]
        })
        for (let i in this.#newAfkTemplate.raidPartneredStatusChannels) {
            this.#newAfkTemplate.raidPartneredStatusChannels[i].map(async channel => await channel.send({ content: `**${this.#newAfkTemplate.name}** is starting inside of **${this.#guild.name}**${this.#channel ? ` in ${this.#channel}` : ``}` }))
        }
        this.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
        this.#raidID = this.raidStatusMessage.id
    }

    async sendStatusMessage() {
        this.raidStatusEmbed.setAuthor({name: `${this.#newAfkTemplate.name} Has Been Started`})
        this.raidStatusEmbed.setFooter({text: `Time Remaining: ${Math.floor(this.#newAfkTemplate.body[this.phase].timeLimit / 60)} minutes and ${this.#newAfkTemplate.body[this.phase].timeLimit % 60} seconds`})
        this.raidStatusEmbed.setTimestamp(Date.now())
        this.raidStatusEmbed.setColor(this.#newAfkTemplate.body[this.phase].embed.color ? this.#newAfkTemplate.body[this.phase].embed.color : '#ffffff')
        if (this.#newAfkTemplate.body[this.phase].embed.description) this.raidStatusEmbed.setDescription(this.#newAfkTemplate.body[this.phase].embed.description)
        if (this.#leader.avatarURL()) this.raidStatusEmbed.data.author.iconURL = this.#leader.avatarURL()
        if (this.#newAfkTemplate.body[this.phase].embed.image) this.raidStatusEmbed.setImage(this.#newAfkTemplate.body[this.phase].embed.image)
        if (this.#newAfkTemplate.body[this.phase].embed.thumbnail) this.raidStatusEmbed.setThumbnail(this.#newAfkTemplate.body[this.phase].embed.thumbnail[Math.floor(Math.random()*this.#newAfkTemplate.body[this.phase].embed.thumbnail.length)])
        let reactables = this.getReactables()
        let components = reactables.concat(this.getPhaseControls())
        this.raidStatusMessage = await this.raidStatusMessage.edit({ embeds: [this.raidStatusEmbed], components: components })
        
        for (let i in this.#newAfkTemplate.reacts) {
            let start = this.#newAfkTemplate.reacts[i].start
            let end = start + this.#newAfkTemplate.reacts[i].lifetime
            if (start > this.phase) continue
            if (end <= this.phase) {
                await this.raidStatusMessage.reactions.cache.get(this.#newAfkTemplate.reacts[i].emote.id).remove()
                continue
            }
            await this.raidStatusMessage.react(this.#newAfkTemplate.reacts[i].emote.id)
        }
    }

    async sendCommandsMessage() {
        if (!this.raidCommandsEmbed) {
            this.raidCommandsEmbed = new Discord.EmbedBuilder()
                .setColor(this.#newAfkTemplate.body[this.phase].embed.color ? this.#newAfkTemplate.body[this.phase].embed.color : '#ffffff')
                .setTitle(`${this.#leader.nickname}'s ${this.#newAfkTemplate.name}`)
                .setFooter({text: `Click ✅ to move to the next phase, Click ❌ to abort`})
                .setDescription(`**Raid Leader: ${this.#leader} \`\`${this.#leader.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.location}\`\``)
            let position = 0
            for (let i in this.#newAfkTemplate.buttons) {
                this.reactables[i].position = position
                this.raidCommandsEmbed.addFields({ name: `${this.#newAfkTemplate.buttons[i].emote ? this.#newAfkTemplate.buttons[i].emote.text : ''} ${i} ${this.#newAfkTemplate.buttons[i].limit ? `(${this.#newAfkTemplate.buttons[i].limit})` : ''}`, value: 'None!', inline: true })
                position++
            }
        }
        let components = this.getPhaseControls()
        
        if (this.raidCommandsMessage) this.raidCommandsMessage = await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed], components: components})
        else this.raidCommandsMessage = await this.#newAfkTemplate.raidCommandChannel.send({ embeds: [this.raidCommandsEmbed], components: components})
        if (this.raidInfoMessage) this.raidInfoMessage = await this.raidInfoMessage.edit({embeds: [this.raidCommandsEmbed]})
        else this.raidInfoMessage = await this.#newAfkTemplate.raidInfoChannel.send({embeds: [this.raidCommandsEmbed]})
        
        if (!this.raidCommandsInteractionHandler) {
            this.raidCommandsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidCommandsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidCommandsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
    }

    async sendChannelsMessage() {
        if (!this.raidChannelsEmbed) {
            let raidLeaderDisplayName = this.#leader.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
            this.raidChannelsEmbed = new Discord.EmbedBuilder()
                .setFooter({ text: `${this.#channel ? this.#channel.id : "VCLess"}` })
                .setTimestamp(Date.now())
                .setColor(this.#newAfkTemplate.body[this.phase].embed.color ? this.#newAfkTemplate.body[this.phase].embed.color : '#ffffff')
                .setTitle(`${raidLeaderDisplayName}'s ${this.#newAfkTemplate.name}`)
                .setDescription(`Whenever the run is over. Click the button to delete the channel. View the timestamp for more information\nLocation: \`${this.location}\``)
        }
        let components = this.getPhaseControls()

        if (this.raidChannelsMessage) this.raidChannelsMessage = await this.raidChannelsMessage.edit({content: `${this.#message.member}`, embeds: [this.raidChannelsEmbed], components: components })
        else this.raidChannelsMessage = await this.#newAfkTemplate.raidActiveChannel.send({content: `${this.#message.member}`, embeds: [this.raidChannelsEmbed], components: components })
       
        if (!this.raidChannelsInteractionHandler) {
            this.raidChannelsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.raidChannelsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.raidChannelsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
    }

    getPhaseControls() {
        const components = []
        const phaseActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel(`✅ ${this.#newAfkTemplate.body[this.phase].nextPhaseButton ? `${this.#newAfkTemplate.body[this.phase].nextPhaseButton}` : `Phase ${this.phase}`}`)
                .setStyle(3)
                .setCustomId(`phase`),
            new Discord.ButtonBuilder()
                .setLabel('❌ Abort')
                .setStyle(4)
                .setCustomId(`abort`)
        ])
        components.push(phaseActionRow)
        return components
    }

    getReactables() {
        const components = []
        let reactablesActionRow = []
        let counter = 0
        for (let i in this.#newAfkTemplate.buttons) {
            let disableStart = this.#newAfkTemplate.buttons[i].disableStart
            let start = this.#newAfkTemplate.buttons[i].start
            let end = start + this.#newAfkTemplate.buttons[i].lifetime
            if (disableStart < start && disableStart > this.phase) continue
            if (!(disableStart < start) && start > this.phase) continue
            if (end <= this.phase) continue
            const reactableButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(`${i}`)
            let label = `${this.#newAfkTemplate.buttons[i].displayName ? `${i} ` : ``}${this.#newAfkTemplate.buttons[i].limit ? ` ${this.reactables[i].members.length}/${this.#newAfkTemplate.buttons[i].limit}` : ``}`
            reactableButton.setLabel(label)
            if (this.#newAfkTemplate.buttons[i].emote) reactableButton.setEmoji(this.#newAfkTemplate.buttons[i].emote.id)
            if (this.reactables[i].members.length == this.#newAfkTemplate.buttons[i].limit) reactableButton.setDisabled(true)
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

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     */
    async interactionHandler(interaction) {
        if (!interaction.isButton()) return
        const embed = new Discord.EmbedBuilder()
        if (this.openInteractions.includes(interaction.member.id)) {
            embed.setDescription(`You are already in the process of reacting. Please wait and try again!`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return
        }
        this.openInteractions.push(interaction.member.id)

        if (this.#newAfkTemplate.buttons[interaction.customId]) {
            const buttonType = this.#newAfkTemplate.buttons[interaction.customId].type
            const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
            const position = this.reactables[interaction.customId].position
            const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

            if (buttonInfo.minRole && !interaction.member.roles.cache.has(buttonInfo.minRole)) {
                embed.setDescription(`You do not have the required role ${this.#guild.roles.cache.get(buttonInfo.minRole)} to react to this run.`)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (this.reactables[interaction.customId].members.includes(interaction.member.id)) {
                embed.setDescription(`You have already reacted as ${emote}${interaction.customId}. Try another react or try again next run.`)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (buttonInfo.limit && this.reactables[interaction.customId].members.length >= buttonInfo.limit) {
                embed.setDescription(`Too many people have already reacted and confirmed for that. Try another react or try again next run.`)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) if (this.reactables[i].members.length >= this.#newAfkTemplate.buttons[i].limit) {
                    embed.setDescription(`Too many people have already reacted and confirmed for the main react ${i}. Try another react or try again next run.`)
                    await interaction.reply({ embeds: [embed], ephemeral: true })
                    return this.removeFromActiveInteractions(interaction.member.id)
                }
            }

            let buttonStatus = false

            switch (buttonType) {
                case AfkTemplate.TemplateButtonType.LOG:
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
            }
            if (!buttonStatus) return this.removeFromActiveInteractions(interaction.member.id)
            this.reactables[interaction.customId].members.push(interaction.member.id)
            if (!this.earlyMembers.includes(interaction.member.id)) this.earlyMembers.push(interaction.member.id)
            this.raidCommandsEmbed.data.fields[position].value = this.reactables[interaction.customId].members.reduce((string, id, ind) => string + `${emote ? emote : ind}: <@!${id}>\n`, '')
            await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.raidInfoMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            return this.removeFromActiveInteractions(interaction.member.id)
        }
        else if (interaction.customId == 'abort' || interaction.customId == 'phase' || interaction.customId.includes(`Log`) || interaction.customId == 'end') {
            if (interaction.member.roles.highest.position >= interaction.guild.roles.cache.get(this.#botSettings.roles.eventrl).position) return await this.processPhaseControl(interaction)
            else {
                embed.setDescription(`You do not have the required Staff Role to use this button.`)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
        } else  {
            embed.setDescription(`How did you press something that's unpressable? ඞ.`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
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
            case "end":
                await this.processPhaseEnd(interaction)
                break
            default:
                if (interaction.customId.includes('Log')) await this.processPhaseLog(interaction)
                break
        }
        return this.removeFromActiveInteractions(interaction.member.id)
    }

    async processPhaseAbort(interaction) {
        const confirmEmbed = new Discord.EmbedBuilder()
            .setDescription(`Are you sure you want to abort this run?\nThis window will close in 10 seconds and cancel.`)
        const confirmButton = new Discord.ButtonBuilder()
            .setCustomId('Confirmed')
            .setLabel('Abort')
            .setStyle(Discord.ButtonStyle.Danger)
        const cancelButton = new Discord.ButtonBuilder()
            .setCustomId('Cancelled')
            .setLabel('❌ Cancel')
            .setStyle(Discord.ButtonStyle.Secondary)
        const confirmValue = await interaction.confirmPanel(confirmButton, cancelButton, confirmEmbed, true, 10000)
        if (!confirmValue) {
            confirmEmbed.setDescription(`Cancelled. You can dismiss this message.`)
            await interaction.editReply({ embeds: [confirmEmbed], components: [] })
            return
        } else {
            confirmEmbed.setDescription(`Channel successfully aborted. You can dismiss this message.`)
            await interaction.editReply({ embeds: [confirmEmbed], components: [] })
        }

        this.raidStatusInteractionHandler.stop()
        this.raidCommandsInteractionHandler.stop()
        this.raidChannelsInteractionHandler.stop()

        for (let i in this.raidDragThreads) {
            if (this.raidDragThreads[i].collector) this.raidDragThreads[i].collector.stop()
            if (this.raidDragThreads[i].thread) await this.raidDragThreads[i].thread.delete()
        }

        if (this.moveInEarlysTimer) clearInterval(this.moveInEarlysTimer)
        if (this.updateStatusTimer) clearInterval(this.updateStatusTimer)
        if (this.#channel) await this.#channel.delete()
        
        this.raidStatusEmbed.setImage(null)
        this.raidStatusEmbed.setDescription(`This afk check has been aborted`)
        this.raidStatusEmbed.setFooter({ text: `The afk check has been aborted by ${this.#guild.members.cache.get(interaction.member.id).nickname}` })
        this.raidStatusMessage.reactions.removeAll()

        await this.raidStatusMessage.edit({ content: null, embeds: [this.raidStatusEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed], components: []})
        await this.raidInfoMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidChannelsMessage.delete()
        this.active = false
        this.updateBotAfkCheck()
    }

    async processPhaseNext(interaction) {
        this.phase++
        if (this.phase > this.#newAfkTemplate.phases) {
            if (interaction) this.removeFromActiveInteractions(interaction.member.id)
            return this.postAfk(interaction)
        }
        let tempRaidStatusMessage = null
        if (this.#newAfkTemplate.body[this.phase].message) tempRaidStatusMessage = await this.#newAfkTemplate.raidStatusChannel.send({ content: `${this.#newAfkTemplate.body[this.phase].message}` })
        if (interaction) await interaction.deferUpdate()
        setTimeout(async () => {
            if (this.#newAfkTemplate.body[this.phase].vcState == AfkTemplate.TemplateVCState.OPEN && this.#channel) await this.#channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            else if (this.#newAfkTemplate.body[this.phase].vcState == AfkTemplate.TemplateVCState.LOCKED && this.#channel) await this.#channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await Promise.all([this.sendStatusMessage(),this.sendCommandsMessage(), this.sendChannelsMessage()])
        }, 5000)
        setTimeout(async () => { if (tempRaidStatusMessage) await tempRaidStatusMessage.delete() }, 20000)
    }

    async processPhaseLog(interaction) {
        const button = interaction.customId.substring(4)
        const buttonInfo = this.#newAfkTemplate.buttons[button]

        let member = null
        let number = null
        let choiceText = buttonInfo.emote ? `${buttonInfo.emote.text} **${button}**` : `**${button}**`
        const confirmEmbed = new Discord.EmbedBuilder()
        confirmEmbed.setDescription(`Which member you want to log ${choiceText} reacts for in this run?\nChoose or input a username or id.\nThis window will cancel and close in 10 seconds.`)
        const confirmMemberMenu = new Discord.StringSelectMenuBuilder()
            .setCustomId(`member`)
            .setPlaceholder(`Name of ${button}s`)
            .setMinValues(1)
            .setMaxValues(1)
        for (let i of this.reactables[button].members) confirmMemberMenu.addOptions({ label: this.#guild.members.cache.get(i).nickname, value: i })
        const confirmMemberValue = await interaction.selectPanel(confirmMemberMenu, confirmEmbed, true, 10000)
        if (!member && confirmMemberValue) member = this.#guild.members.cache.get(confirmMemberValue)
        if (!member && confirmMemberValue) member = this.#guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(confirmMemberValue.toLowerCase()))
        if (!member) {
            confirmEmbed.setDescription(`Invalid member, try again. You can dismiss this message.`)
            return await interaction.editReply({ embeds: [confirmEmbed], components: [] })
        }
        confirmEmbed.setDescription(`How many ${choiceText} reacts do you want to log for this member?\nChoose or input a number.\nThis window will cancel and close in 10 seconds.`)
        const confirmNumberMenu = new Discord.StringSelectMenuBuilder()
            .setCustomId(`number`)
            .setPlaceholder(`Number of ${button}s`)
            .setMinValues(1)
            .setMaxValues(1)
            .setOptions(
                { label: '0', value: '0' },
                { label: '1', value: '1' },
                { label: '2', value: '2' },
                { label: '3', value: '3' }
            )
        const confirmNumberValue = await interaction.selectPanel(confirmNumberMenu, confirmEmbed, false, 10000)
        number = Number.isInteger(parseInt(confirmNumberValue)) ? parseInt(confirmNumberValue) : null
        if (!number) {
            confirmEmbed.setDescription(`Invalid number, try again. You can dismiss this message.`)
            return await interaction.editReply({ embeds: [confirmEmbed], components: [] })
        }
        this.#db.query(`UPDATE users SET ${buttonInfo.logName} = ${buttonInfo.logName} + ${number} WHERE id = '${member.id}'`, (err, rows) => {
            if (err) return console.log(`${buttonInfo.logName} missing from ${this.#guild.name} ${this.#guild.id}`)
        })
        this.#db.query(`SELECT ${buttonInfo.logName} FROM users WHERE id = '${member.id}'`, async (err, rows) => {
            if (err) return console.log(`${buttonInfo.logName} missing from ${this.#guild.name} ${this.#guild.id}`)
            let embed = new Discord.EmbedBuilder()
                .setColor('#0000ff')
                .setTitle(`${button} logged!`)
                .setDescription(`${member} now has \`\`${parseInt(rows[0][buttonInfo.logName]) + parseInt(number)}\`\` ${choiceText} pops`)
            await this.#newAfkTemplate.raidCommandChannel.send({ embeds: [embed] })
        })
        confirmEmbed.setDescription('Sucessfully logged. You can dismiss this message.')
        await interaction.editReply({ embeds: [confirmEmbed], components: [] })
    }

    async processPhaseEnd(interaction) {
        const confirmEmbed = new Discord.EmbedBuilder()
        confirmEmbed.setDescription(`Are you sure you want to delete this run?\nThis window will close in 10 seconds and cancel.`)
        const confirmButton = new Discord.ButtonBuilder()
            .setCustomId('Confirmed')
            .setLabel('Delete Channel')
            .setStyle(Discord.ButtonStyle.Danger)
        const cancelButton = new Discord.ButtonBuilder()
            .setCustomId('Cancelled')
            .setLabel('❌ Cancel')
            .setStyle(Discord.ButtonStyle.Secondary)
        const confirmValue = await interaction.confirmPanel(confirmButton, cancelButton, confirmEmbed, true, 10000)
        if (!confirmValue) {
            confirmEmbed.setDescription(`Cancelled. You can dismiss this message.`)
            await interaction.editReply({ embeds: [confirmEmbed], components: [] })
            return
        } else {
            confirmEmbed.setDescription(`Channel successfully deleted. You can dismiss this message.`)
            await interaction.editReply({ embeds: [confirmEmbed], components: [] })
        }
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
        await this.raidInfoMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidChannelsMessage.delete()
        this.active = false
        this.updateBotAfkCheck()
    } 

    async processReactableNormal(interaction) {
        const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
        const embed = new Discord.EmbedBuilder()
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            let descriptionMiddle = ``
            if (buttonInfo.confirmationMessage) descriptionMiddle = buttonInfo.confirmationMessage
            embed.setDescription(`${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`)
            if (buttonInfo.confirmationMedia) embed.setImage(buttonInfo.confirmationMedia)
            const confirmButton = new Discord.ButtonBuilder()
                .setCustomId('Confirmed')
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
                .setCustomId('Cancelled')
                .setLabel('❌ Cancel')
                .setStyle(Discord.ButtonStyle.Danger)
            const confirmValue = await interaction.confirmPanel(confirmButton, cancelButton, embed, true, 30000)
            if (!confirmValue) {
                embed.setImage(null)
                embed.setDescription(`Cancelled. You can dismiss this message.`)
                await interaction.editReply({ embeds: [embed], components: [] })
                return false
            } else if (this.reactables[interaction.customId].members.length >= buttonInfo.limit) {
                embed.setImage(null)
                embed.setDescription('Too many people have already reacted and confirmed for that. Try another react or try again next run.')
                await interaction.editReply({ embeds: [embed], components: [] })
                return false
            } else if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) if (this.reactables[i].members.length >= this.#newAfkTemplate.buttons[i].limit) {
                    embed.setImage(null)
                    embed.setDescription(`Too many people have already reacted and confirmed for the main react ${i}. Try another react or try again next run.`)
                    await interaction.editReply({ embeds: [embed], components: [] })
                    return false
                }
            }
        }

        if (buttonInfo.location) embed.setDescription(`The location for this run has been set to \`${this.location}\`, get there ASAP!${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
        else embed.setDescription(`You do not get location for this reaction.${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
        if (buttonInfo.confirm) await interaction.editReply({ embeds: [embed], components: [] })
        else await interaction.reply({ embeds: [embed], ephemeral: true })
        return true
    }

    async processReactableSupporter(interaction) {
        const embed = new Discord.EmbedBuilder()

        if (this.earlyMembers.includes(interaction.member.id)) {
            embed.setDescription(`Supporter Perks in \`${interaction.guild.name}\` only gives a guaranteed slot in the raid and you already have this from another react.\nYour Supporter Perks have not been used.${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return false
        }
        if (interaction.member.roles.highest.position >= interaction.guild.roles.cache.get(this.#botSettings.roles.trialrl).position) {
            embed.setDescription(`The location for this run has been set to \`${this.location}\``)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return false
        }
        for (let i of this.#botSettings.lists.earlyLocation) { //custom early location roles
            if (interaction.member.roles.cache.has(i)) {
                embed.setDescription(`The location for this run has been set to \`${this.location}\``)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                return false
            }
        }
        if (!interaction.member.roles.cache.hasAny(...this.#newAfkTemplate.perkRoles.map(role => role.id))) {
            embed.setDescription(`You are not eligible for this reaction as you do not have the required Supporter role`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return false
        }
        let supporterRole = interaction.member.supporterHierarchy(this.#botSettings)
        if (!supporterRole) {
            embed.setDescription(`You are not eligible for this reaction as you do not have the required Supporter role`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return false
        }
        if (this.reactables[interaction.customId].members.length >= this.#botSettings.numerical.supporterlimit) {
            this.#newAfkTemplate.buttons[interaction.customId].limit = this.#botSettings.numerical.supporterlimit
            embed.setDescription('Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.');
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return false 
        }
        if (this.reactables[interaction.customId].members.length >= this.#botSettings.supporter[`supporterLimit${supporterRole}`]) {
            embed.setDescription(`Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return false
        }
        let cooldown = this.#botSettings.supporter[`supporterCooldownSeconds${supporterRole}`]
        let uses = this.#botSettings.supporter[`supporterUses${supporterRole}`]
        let lastUseCheck = Date.now() - (cooldown * 1000)
        this.#db.query(`SELECT * FROM supporterusage WHERE guildid = '${interaction.guild.id}' AND userid = '${interaction.member.id}' AND utime > '${lastUseCheck}'`, async (err, rows) => {
            if (err) {
                ErrorLogger.log(err, this.#bot, this.#guild)
                return false
            }
            if (rows.length >= uses) {
                let cooldown_text = ''
                if (cooldown < 3600) cooldown_text = `${(cooldown/60).toFixed(0)} minutes`
                else cooldown_text = `${(cooldown/3600).toFixed(0)} hours`
                embed.setDescription(
                    `Your perks are limited to ${uses} times every ${cooldown_text}. Your next use is available <t:${(((cooldown*1000)+parseInt(rows[0].utime))/1000).toFixed(0)}:R>`
                )
                await interaction.reply({ embeds: [embed], ephemeral: true })
                return false
            }
            embed.setDescription(`You have received a guaranteed slot.${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return true
        })
    }

    async processReactablePoints(interaction) {
        const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
        const embed = new Discord.EmbedBuilder()
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        if (!this.#botSettings.backend.points) {
            await interaction.deferUpdate()
            return false
        }
        
        let points = 0
        this.#db.query(`SELECT points FROM users WHERE id = '${interaction.member.id}'`, (err, rows) => {
            if (err) {
                ErrorLogger.log(err, this.#bot, this.#guild)
                return false
            }
            if (rows.length == 0) return this.#db.query(`INSERT INTO users (id) VALUES ('${interaction.member.id}')`)
            points = rows[0].points
        })

        if (points < this.earlyLocationCost) {
            embed.setDescription(`You do not have enough points.\nYou currently have ${emote} \`${rows[0].points}\` points\nEarly location costs ${emote} \`${earlyLocationCost}\``)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return false
        }

        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            if (buttonInfo.confirmationMessage) descriptionMiddle = buttonInfo.confirmationMessage
            else descriptionMiddle = `You currently have ${emote} \`${rows[0].points}\` points\nEarly location costs ${emote} \`${earlyLocationCost}\``
            embed.setDescription(`${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`)
            if (buttonInfo.confirmationMedia) embed.setImage(buttonInfo.confirmationMedia)
            embed.setAuthor({ name: 'Please Confirm Point Usage', iconURL: interaction.member.avatarURL() ? interaction.member.avatarURL() : null})
            const confirmButton = new Discord.ButtonBuilder()
                .setCustomId('Confirmed')
                .setLabel('✅ Confirm')
                .setStyle(Discord.ButtonStyle.Success)
            const cancelButton = new Discord.ButtonBuilder()
                .setCustomId('Cancelled')
                .setLabel('❌ Cancel')
                .setStyle(Discord.ButtonStyle.Danger)
            const confirmValue = await interaction.confirmPanel(confirmButton, cancelButton, embed, true, 30000)
            if (!confirmValue) {
                embed.setImage(null)
                embed.setDescription(`Cancelled. You can dismiss this message.`)
                await interaction.editReply({ embeds: [embed], components: [] })
                return false
            } else if (this.reactables[interaction.customId].members.length >= buttonInfo.limit) {
                embed.setImage(null)
                embed.setDescription('Too many people have already reacted and confirmed for that.')
                await interaction.editReply({ embeds: [embed], components: [] })
                return false
            } else if (buttonInfo.parent) {
                for (let i of buttonInfo.parent) if (this.reactables[i].members.length >= this.#newAfkTemplate.buttons[i].limit) {
                    embed.setImage(null)
                    embed.setDescription(`Too many people have already reacted and confirmed for the main react ${i}. Try another react or try again next run.`)
                    await interaction.editReply({ embeds: [embed], components: [] })
                    return false
                }
            }
        }

        if (buttonInfo.location) embed.setDescription(`The location for this run has been set to \`${this.location}\`, get there ASAP!${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
        else embed.setDescription(`You do not get location for this reaction.${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
        if (buttonInfo.confirm) await interaction.editReply({ embeds: [embed], components: [] })
        else await interaction.reply({ embeds: [embed], ephemeral: true })
        return true
    }

    async processReactableDrag(interaction) {
        const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
        const embed = new Discord.EmbedBuilder()
        const emote = buttonInfo.emote ? `${buttonInfo.emote.text} ` : ``

        function isImageURL(url) {
            return /^https?:\/\/.+\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url);
        }

        if (this.dragMembers.includes(interaction.member.id)) {
            embed.setDescription(`You have already reacted as ${emote}${interaction.customId}. Please wait for the RL to accept or deny you.`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return this.removeFromActiveInteractions(interaction.member.id)
        }

        let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
        let descriptionEnd = `Press ✅ and upload an image (have a link on hand) to confirm your reaction. Otherwise press ❌`
        let descriptionMiddle = ``
        if (buttonInfo.confirmationMessage) descriptionMiddle = buttonInfo.confirmationMessage
        embed.setDescription(`${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`)
        if (buttonInfo.confirmationMedia) embed.setImage(buttonInfo.confirmationMedia)
        const confirmButton = new Discord.ButtonBuilder()
            .setCustomId('Confirmed')
            .setLabel('⬆️ Upload')
            .setStyle(Discord.ButtonStyle.Success)
        const cancelButton = new Discord.ButtonBuilder()
            .setCustomId('Cancelled')
            .setLabel('❌ Cancel')
            .setStyle(Discord.ButtonStyle.Danger)
        const confirmValue = await interaction.confirmMenuPanel(confirmButton, cancelButton, embed, true, 30000)
        if (!confirmValue) {
            embed.setImage(null)
            embed.setDescription(`Cancelled. You can dismiss this message.`)
            await interaction.editReply({ embeds: [embed], components: [] })
            return false
        } else if (!isImageURL(confirmValue)) {
            embed.setImage(null)
            embed.setDescription(`Invalid Image, try again. You can dismiss this message.`)
            await interaction.editReply({ embeds: [embed], components: [] })
            return false
        } else if (this.reactables[interaction.customId].members.length >= buttonInfo.limit) {
            embed.setImage(null)
            embed.setDescription('Too many people have already reacted and confirmed for that. Try another react or try again next run.')
            await interaction.editReply({ embeds: [embed], components: [] })
            return false
        } else if (buttonInfo.parent) {
            for (let i of buttonInfo.parent) if (this.reactables[i].members.length >= this.#newAfkTemplate.buttons[i].limit) {
                embed.setImage(null)
                embed.setDescription(`Too many people have already reacted and confirmed for the main react ${i}. Try another react or try again next run.`)
                await interaction.editReply({ embeds: [embed], components: [] })
                return false
            }
        }
        embed.setImage(null)
        embed.setDescription(`Image has been sent. You can dismiss this message.`)
        await interaction.editReply({ embeds: [embed], components: [] })

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

    async dragInteractionHandler(interaction) {
        await interaction.message.delete()
        const memberID = interaction.message.embeds[0].description
        const member = this.#guild.members.cache.get(memberID)
        if (!member || !memberID) return
        const DMEmbed = new Discord.EmbedBuilder()
        if (interaction.customId == 'Deny') {
            let ind = this.dragMembers.indexOf(memberID)
            if (ind > -1) this.dragMembers.splice(ind)
            DMEmbed.setDescription(`You have been denied by ${interaction.member}.`)
            await member.send({ embeds: [DMEmbed], components: [] }).catch(er => {})
        } else {
            let customID = null
            for (let i in this.raidDragThreads) if (interaction.channel.id == this.raidDragThreads[i].thread.id) customID = i
            if (!customID) return
            const position = this.reactables[customID].position
            const emote = this.#newAfkTemplate.buttons[customID].emote ? `${this.#newAfkTemplate.buttons[customID].emote.text} ` : ``
            if (this.#newAfkTemplate.buttons[customID].location) DMEmbed.setDescription(`You have been accepted by ${interaction.member}.\nThe location for this run has been set to \`${this.location}\`, get there ASAP!${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            else DMEmbed.setDescription(`You have been accepted by ${interaction.member}.\nYou do not get location for this reaction.${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` Join lounge to be moved into the channel.` : ``}`)
            await member.send({ embeds: [DMEmbed], components: [] }).catch(er => {})
            
            this.reactables[customID].members.push(memberID)
            if (!this.earlyMembers.includes(memberID)) this.earlyMembers.push(memberID)
            this.raidCommandsEmbed.data.fields[position].value = this.reactables[customID].members.reduce((string, id, ind) => string + `${emote ? emote : ind}: <@!${id}>\n`, '')
            await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.raidInfoMessage.edit({ embeds: [this.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        }
    }

    async postAfk(interaction) {
        if (this.moveInEarlysTimer) clearInterval(this.moveInEarlysTimer)
        if (this.updateStatusTimer) clearInterval(this.updateStatusTimer)

        if (this.#channel) {
            await this.#channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.#channel.setPosition(0)
        }

        this.raidStatusEmbed.setDescription(`This afk check has been ended.${this.#newAfkTemplate.vcOptions != AfkTemplate.TemplateVCOptions.NO_VC ? ` If you get disconnected during the run, **JOIN LOUNGE** *then* press the huge **RECONNECT** button` : ``}`)
        this.raidStatusEmbed.setFooter({ text: `The afk check has been ended by ${interaction ? this.#guild.members.cache.get(interaction.member.id).nickname : this.#guild.members.cache.get(this.#leader.id).nickname}` })

        const reconnectActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('Reconnect')
                .setStyle(1)
                .setCustomId('reconnect')
        ])
        const phaseComponents = []
        let phaseActionRow = []
        let counter = 1
        for (let i in this.#newAfkTemplate.buttons) {
            if (this.#newAfkTemplate.buttons[i].type != AfkTemplate.TemplateButtonType.LOG) continue
            const phaseButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(`Log ${i}`)
            phaseButton.setLabel(`Log ${i}`)
            if (this.#newAfkTemplate.buttons[i].emote) phaseButton.setEmoji(this.#newAfkTemplate.buttons[i].emote.id)
            phaseActionRow.push(phaseButton)
            counter ++
            if (counter == 5) {
                counter = 0
                const phaseComponent = new Discord.ActionRowBuilder({ components: phaseActionRow })
                phaseComponents.push(phaseComponent)
                phaseActionRow = []
            }
        }
        const phaseButton = new Discord.ButtonBuilder()
            .setLabel('Delete Channel')
            .setStyle(Discord.ButtonStyle.Danger)
            .setCustomId('end')
        phaseActionRow.push(phaseButton)
        const phaseComponent = new Discord.ActionRowBuilder({ components: phaseActionRow })
        phaseComponents.push(phaseComponent)

        if (this.raidStatusInteractionHandler) this.raidStatusInteractionHandler.stop()
        this.raidStatusMessage.reactions.removeAll()

        await this.raidStatusMessage.edit({ content: null, embeds: [this.raidStatusEmbed], components: [reconnectActionRow] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidCommandsMessage.edit({ embeds: [this.raidCommandsEmbed], components: phaseComponents }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.raidChannelsMessage.edit({ embeds: [this.raidChannelsEmbed], components: phaseComponents }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))

        if (this.#channel) this.#channel.members.forEach(m => this.members.push(m.id))
        else this.earlyMembers.forEach(id => this.members.push(id))

        for (let u of this.members) {
            this.#db.query(`SELECT id FROM users WHERE id = '${u}'`, (err, rows) => {
                if (err) return
                if (rows.length == 0) return this.#db.query(`INSERT INTO users (id) VALUES('${u}')`)
            })
        }

        let raiders_text = `Raiders`
        let raiders_value = `None!`
        this.members.forEach(m => {
            if (raiders_value.length >= 1000) {
                this.raidCommandsEmbed.addFields({ name: raiders_text, value: raiders_value })
                raiders_text = `-`
                raiders_value = `, <@!${m}>`
            } else raiders_value == 'None!' ? raiders_value = `<@!${m}>` : raiders_value += `, <@!${m}>`
        })
        
        if (this.#botSettings.backend.points) {
            let pointsLog = []
            for (let i in this.reactables) for (let u of this.reactables[i].members) {
                switch (this.#newAfkTemplate.buttons[i].type) {
                    case AfkTemplate.TemplateButtonType.LOG:
                        break
                    case AfkTemplate.TemplateButtonType.SUPPORTER:
                        this.#db.query(`INSERT INTO supporterusage (guildid, userid, utime) VALUES ('${this.#guild.id}', '${u}', '${Date.now()}')`)
                    default:
                        let points = 0
                        if (Number.isInteger(this.#newAfkTemplate.buttons[i].points)) points = this.#newAfkTemplate.buttons[i].points
                        else if (this.#botSettings.points[this.#newAfkTemplate.buttons[i].points]) points = this.#botSettings.points[this.#newAfkTemplate.buttons[i].points]
                        if (this.#newAfkTemplate.buttons[i].type != AfkTemplate.TemplateButtonType.POINTS && this.#guild.members.cache.get(u).roles.cache.hasAny(...this.#newAfkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                        this.#db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`, (err, rows) => {
                            if (err) return console.log(`error logging ${i} points in `, this.#guild.id)
                            pointsLog.push({ uid: u, points: points, reason: `${i}`})
                        })
                }
            }
            let pointlog_mid = await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.raidCommandsEmbed)
            this.raidCommandsEmbed.addFields({ name: 'Points Log MID', value: pointlog_mid })
        }
        this.raidCommandsEmbed.addFields({ name: raiders_text, value: raiders_value })
        await this.raidInfoMessage.edit({ embeds: [this.raidCommandsEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#guild.channels.cache.get(this.#botSettings.channels.history).send({ embeds: [this.raidCommandsEmbed] })

        if (restart.restarting) this.loggingAfk()
        else setTimeout(this.loggingAfk.bind(this), 10000)
        this.updateBotAfkCheck()
    }

    async loggingAfk() {
        if (this.#channel && this.#channel.members.size != 0) {
            this.members = []
            this.#channel.members.forEach(m => this.members.push(m.id))
        }
        for (let u of this.members) {
            this.#db.query(`UPDATE users SET ${this.#newAfkTemplate.logName} = ${this.#newAfkTemplate.logName} + 1 WHERE id = '${u}'`, (err, rows) => {
                if (err) return console.log('error logging run completes in ', this.#guild.id)
            })
            if (this.#botSettings.backend.points) {
                let points = this.#botSettings.points.perrun
                if (this.#guild.members.cache.get(u).roles.cache.hasAny(...this.#newAfkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                this.#db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`, (err, rows) => {
                    if (err) return console.log('error logging points for run completes in ', this.#guild.id)
                })
            }
        }
    }
    
    // NEEDS TO BE RETOOLED
    async changeLocation(location) {
        this.afkInfo.location = location;

        if (!this.leaderEmbed) return
        this.leaderEmbed.setDescription(`**Raid Leader: ${this.message.member} \`\`${this.message.member.nickname}\`\`\nVC: ${this.channel}\nLocation:** \`\`${this.afkInfo.location}\`\``)
        this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild));
        this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild));
        if (this.partneredMessageSent && this.partneredMessage) {
            this.partneredMessage.edit(`${this.partneredPings},  **${this.afkInfo.runName}** is starting inside of **${this.message.guild.name}** in ${this.channel} at \`\`${this.afkInfo.location}\`\``)
        }

        for (let i of this.earlyLocation) {
            await i.send(`The location for this run has changed to \`${this.afkInfo.location}\``)
        }
    }
    // NEEDS TO BE RETOOLED
}
// NEEDS TO BE RETOOLED
function getBannedName(name, guildid) {
    let n = new Set(bannedNames[guildid])
    if (n.has(name.toLowerCase())) return true
    return false
}
// NEEDS TO BE RETOOLED
// NEEDS TO BE RETOOLED
function getRunType(char, guildid) {
    for (let i in afkTemplates[guildid]) {
        if (char.toLowerCase() == afkTemplates[guildid][i].symbol) return afkTemplates[guildid][i];
        if (afkTemplates[guildid][i].aliases) {
            if (afkTemplates[guildid][i].aliases.includes(char.toLowerCase())) return afkTemplates[guildid][i];
        }
    }
    return null
}
// NEEDS TO BE RETOOLED
// NEEDS TO BE RETOOLED
async function getTemplate(message, afkTemplates, runType) {
    if (afkTemplates[message.author.id] && afkTemplates[message.author.id][runType.toLowerCase()]) return afkTemplates[message.author.id][runType.toLowerCase()]
    else return null
}
// NEEDS TO BE RETOOLED
// NEEDS TO BE RETOOLED
async function destroyInactiveRuns() {
    for (let i of runs) {
        if (!i.afk.active) {
            delete i.afk;
        }
    }
    runs = runs.filter((v, i, r) => v.afk)
}
// NEEDS TO BE RETOOLED
// NEEDS TO BE RETOOLED
function requestButtonHandler(interaction, channelId, limit) {
    for (let i of runs) {
        if (i.channel == channelId) {
            i.afk.buttonHandler(interaction, limit)
            return
        }
    }
}
// NEEDS TO BE RETOOLED