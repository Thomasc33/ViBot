const Discord = require('discord.js')
const botSettings = require('../settings.json')
const newAfkTemplate = require('./newAfkTemplate.js').AfkTemplate
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


/*
- Running Execute on the AFK Check with Alias and Location
- Obtain Template Object from Alias + GuildID which holds information about the AFK Check
- Add AFK Checks to the bot so that other commands can always view the current AFK Checks
    - Figure out where to update the AFK Checks to the bot
    - Also add a way to remove inactive AFK Checks from the bot
- Check Minimum Staff Role
- Create AFK Check Object which uses the Template Object to obtain information about the AFK Check
- Initialise all the list variables for the AFK which must be updated
- Start by creating the AFK Check Embed and asking for optional early location reacts
- Create the initial AFK Check Status Message and send it
- Create the AFK Check Voice Channel if needed, create the raidbot info panel with buttons, create afk check panel with buttons
- Send the AFK Check Messages
- Logic for parsing buttons with particular IDs and the interaction handler should be attached to the buttons
- Each Button should be seperated by their type for their logic
- Create a Post AFK Check Function which will be called when the AFK Check is ended
- Handle the Post AFK Check Logic for Points and Database


Parameters which are not needed:
- settings.backend
    - useStaticVCForRaiding
    - allowAdvancedRun
- settings.voice
    - raiding
    - vetraiding
    - eventraiding
- settings.channels
    - raidstatus
    - eventstatus
    - vetstatus
    - exaltstatus
    - raidcommands
    - eventcommands
    - vetcommands
    - accursedcommands
    - accursedstatus
    - raidingchannels
    - eventchannels
    - vetchannels

     * @param {String} afkInfo.guild
     * @param {String} afkInfo.channel
     * @param {String} afkInfo.raidLeader
     * @param {String} afkInfo.location
    
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     * @param {Discord.Guild} guild
     * @param {Discord.VoiceChannel} channel
     * @param {Discord.Message} message
*/

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
        if (!registeredWithRestart) {
            restart.registerAFKCheck(module.exports)
            registeredWithRestart = true
        }
        if (!registeredWithVibotChannels) {
            Channels.registerAFKCheck(module.exports)
            registeredWithVibotChannels = true
        }
        let shift = args.shift().toLowerCase()
        const afkTemplate = new newAfkTemplate(bot, bot.settings[message.guild.id], message.guild, message.channel, alias)
        const currentState = afkTemplate.getState()
        if (currentState.state != 0) return await message.channel.send(currentState.message)

        const runInfo = {}

        //set Raid Leader
        runInfo.leaderID = message.member.id;
        //set guildid
        runInfo.guildID = message.guild.id;

        //get/set location
        let location = args.join(' ')
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again')
        if (location == '') location = 'None'
        runInfo.location = location.trim()

        if (message.guild.members.cache.get(runInfo.leaderID).roles.highest.position < afkTemplate.minimumStaffRole.position) return message.channel.send(`You do not have a suitable role above ${afkTemplate.minimumStaffRole.position} to run ${afkTemplate.name}.`)

        const afkModule = new afkCheck(afkTemplate, runInfo, bot, db, message.guild, message)
        await afkModule.createChannel()
        await afkModule.sendButtonChoices()
        await afkModule.sendInitialStatusMessage()
        if (afkTemplate.startDelay > 0) {
            setTimeout(start, afkTemplate.startDelay*1000, afkModule)
        }
        else {
            start(afkModule)
        }
    },
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
    //used by vibotChannels to abort runs when channels are closed
    async returnRunByID(channel_id) {
        for (let i of runs) {
            if (i.afk.active && i.channel == channel_id) { return i.afk; }
        }
        return undefined;
    }
}

function start(afkModule) {
    afkModule.sendStatusMessage()
    afkModule.sendCommandsMessage()
    afkModule.sendChannelsMessage()
    afkModule.startTimers()
    
    //afkModule.sendMessages()
}

class afkCheck {
    /**
     *
     * @param {newAfkTemplate} newAfkTemplate
     * @param {Object} afkInfo
     * @param {String} afkInfo.guildID
     * @param {String} afkInfo.channelID
     * @param {String} afkInfo.leaderID
     * @param {String} afkInfo.location
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     * @param {Discord.Guild} guild
     * @param {Discord.VoiceChannel} channel
     * @param {Discord.Message} message
     */
    #bot;
    #botSettings;
    #db;
    #newAfkTemplate;
    #afkInfo;
    #guild;
    #channel;
    #message;

    constructor(newAfkTemplate, afkInfo, bot, db, guild, message) {
        this.#bot = bot
        this.#botSettings = bot.settings[guild.id]
        this.#newAfkTemplate = newAfkTemplate
        this.#db = db
        this.#guild = guild
        this.#channel = null
        this.#message = message
        afkInfo.members = []
        afkInfo.openInteractions = []
        afkInfo.earlySlot = []
        afkInfo.reactables = {}
        afkInfo.phase = 1
        afkInfo.reactables = newAfkTemplate.buttons.map(() => ({users: [], position: null}))
        afkInfo.active = true
        this.#afkInfo = afkInfo
        bot.afkChecks[afkInfo.leaderID] = {
            leaderNick: message.member.displayName.replace(/[^a-z|]/gi, '').split('|')[0],
            guild: guild.id,
            raidleader: afkInfo.leaderID,
            time: Date.now(),
            afkInfo: afkInfo,
            active: true,
            newAfkTemplate: newAfkTemplate
        }
        fs.writeFileSync('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot, guild) })
    }

    async createChannel() {
        if (this.#newAfkTemplate.vcOptions == 0) return
        else if (this.#newAfkTemplate.vcOptions == 1) return this.#channel = this.#message.member.voice.channel
        let raidLeaderDisplayName = this.#message.member.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
        let channel = await this.#newAfkTemplate.raidTemplateChannel.clone({
            name: `${raidLeaderDisplayName}'s ${this.#newAfkTemplate.name}`,
            parent: this.#message.guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === this.#newAfkTemplate.raidCategory).id,
            userLimit: this.#newAfkTemplate.cap
        }).then(c => c.setPosition(0))
        await this.#message.member.voice.setChannel(channel).catch(er => {})
        channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumViewRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        channel.permissionOverwrites.edit(this.#afkInfo.leaderID, { Connect: true, ViewChannel: true, Speak: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        this.#channel = channel
        return
    }

    async sendButtonChoices() {
        let buttonChoices = this.#newAfkTemplate.getButtonChoice()
        let newButtonChoices = []
        for (let i of buttonChoices) {
            let minStaffRole = null
            if (this.#newAfkTemplate.buttons[i].minStaffRole && this.#botSettings.roles[this.#newAfkTemplate.buttons[i].minStaffRole]) minStaffRole = this.#guild.roles.cache.get(this.#botSettings.roles[this.#newAfkTemplate.buttons[i].minStaffRole])
            if (minStaffRole && this.#guild.members.cache.get(this.#afkInfo.leaderID).roles.highest.position < minStaffRole.position) continue

            let choiceText = this.#newAfkTemplate.buttons[i].emote ? `${this.#bot.storedEmojis[this.#newAfkTemplate.buttons[i].emote].text} **${i}**` : `**${i}**` 
            let confirmEmbed = new Discord.EmbedBuilder()
            switch (this.#newAfkTemplate.buttons[i].choice) {
                case 1:
                    confirmEmbed.setDescription(`Do you want to add ${choiceText} reacts to this run?\nPress ✅ to add this react. Otherwise press ❌ to remove it.\nThis window will close in 10 seconds and use the default ${this.#newAfkTemplate.buttons[i].limit} ${choiceText}.`)
                    const confirmActionRow1 = new Discord.ActionRowBuilder().addComponents([
                        new Discord.ButtonBuilder()
                            .setLabel('✅ Confirm')
                            .setStyle(3)
                            .setCustomId('confirm'),
                        new Discord.ButtonBuilder()
                            .setLabel('❌ Cancel')
                            .setStyle(4)
                            .setCustomId('cancel')
                    ])
                    const confirmMessage1 = await this.#message.channel.send({ content: `${this.#message.member}`, embeds: [confirmEmbed], components: [confirmActionRow1] })
                    const confirmInteractionCollector1 = new Discord.InteractionCollector(this.#bot, { time: 10000, message: confirmMessage1, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
                    await new Promise((resolve) => {
                        let resolved = false
                        confirmInteractionCollector1.on("collect", async subInteraction => {
                            resolved = true
                            if (subInteraction.customId === 'cancel') {
                                newButtonChoices.push(i)
                                delete this.#afkInfo.reactables[i]
                                confirmMessage1.delete()
                                confirmInteractionCollector1.stop()
                                resolve(true)
                            } else if (subInteraction.customId === 'confirm') {
                                confirmMessage1.delete()
                                confirmInteractionCollector1.stop()
                                resolve(true)
                            } else {
                                confirmMessage1.delete()
                                confirmInteractionCollector1.stop()
                                resolve(false)
                            }
                        })
                        confirmInteractionCollector1.on('end', async subInteraction => {
                            if (!resolved) {
                                confirmMessage1.delete()
                                confirmInteractionCollector1.stop()
                                resolve(false)
                            }
                        })
                    })
                    break
                case 2:
                    confirmEmbed.setDescription(`How many ${choiceText} reacts do you want to add to this run?\nChoose or input a number for how many reacts you want.\nThis window will close in 10 seconds and use the default ${this.#newAfkTemplate.buttons[i].limit} ${choiceText}.`)
                    const confirmActionRow2 = new Discord.ActionRowBuilder().addComponents(
                        new Discord.StringSelectMenuBuilder()
                            .setCustomId(`limit`)
                            .setPlaceholder(`Number of ${i}s`)
                            .setMinValues(1)
                            .setMaxValues(1)
                            .setOptions(
                                { label: '0', value: '0' },
                                { label: '1', value: '1' },
                                { label: '2', value: '2' },
                                { label: '3', value: '3' },
                                { label: 'Custom', value: 'custom' },
                            )
                    )
                    const confirmMessage2 = await this.#message.channel.send({ content: `${this.#message.member}`, embeds: [confirmEmbed], ephemeral: true, components: [confirmActionRow2] })
                    const confirmInteractionCollector2 = new Discord.InteractionCollector(this.#bot, { time: 10000, message: confirmMessage2, interactionType: Discord.InteractionType.MessageComponent })
                    await new Promise((resolve) => {
                        let resolved = false
                        confirmInteractionCollector2.on("collect", async subInteraction => {
                            resolved = true
                            if (subInteraction.customId === 'limit') {
                                switch (subInteraction.values[0]) {
                                    case 'custom':
                                        const limitModal = new Discord.ModalBuilder()
                                            .setCustomId(`limit`)
                                            .setTitle(`Afk Info`)
                                        const limitActionRow = new Discord.ActionRowBuilder().addComponents(
                                            new Discord.TextInputBuilder()
                                                .setCustomId(`limitField`)
                                                .setLabel(`How many ${i} would you like for this run?`)
                                                .setPlaceholder(`Number of ${i}s`)
                                                .setStyle(Discord.TextInputStyle.Short)
                                                .setRequired(true)
                                        )
                                        limitModal.addComponents(limitActionRow)
                                        await subInteraction.showModal(limitModal)
                                        const submitted = await subInteraction.awaitModalSubmit({ time: 60000}).catch(error => {console.error(error)})
                                        if (submitted) {
                                            let limit = submitted.fields.getTextInputValue(`limitField`)
                                            await submitted.deferUpdate()
                                            if (!isNaN(parseInt(limit))) {
                                                if (limit === '0') {
                                                    newButtonChoices.push(i)
                                                    delete this.#afkInfo.reactables[i]
                                                } else this.#newAfkTemplate.buttons[i].limit = parseInt(limit)
                                            }
                                        }
                                        confirmMessage2.delete()
                                        break
                                    case '0':
                                        newButtonChoices.push(i)
                                        delete this.#afkInfo.reactables[i]
                                        confirmMessage2.delete()
                                        break
                                    default:
                                        this.#newAfkTemplate.buttons[i].limit = parseInt(subInteraction.values[0])
                                        confirmMessage2.delete()
                                        break
                                }
                                confirmInteractionCollector2.stop()
                                resolve(true)
                            } else {
                                confirmMessage2.delete()
                                confirmInteractionCollector2.stop()
                                resolve(false)
                            }
                        })
                        confirmInteractionCollector2.on('end', async subInteraction => {
                            if (!resolved)  {
                                confirmMessage2.delete()
                                confirmInteractionCollector2.stop()
                                resolve(false)
                            }
                        })
                    })
                    break
                default:
                    break
            }
        }
        this.#newAfkTemplate.updateButtonChoice(newButtonChoices)
        return
    }

    async startTimers() {
        this.moveInTimer = await setInterval(() => this.moveIn(), 10000)
        this.updateStatusTimer = await setInterval(() => this.updateStatus(), 5000)
        return
    }

    async moveInEarlys() {
        for (let i of this.#afkInfo.earlySlot) {
            let member = this.#message.guild.members.cache.get(i)
            if (!member.voice.channel) continue
            if (member.voice.channel.name.includes('lounge') || member.voice.channel.name.includes('Lounge') || member.voice.channel.name.includes('drag')) {
                await member.voice.setChannel(this.channel.id).catch(er => { })
            }
        }
        return
    }

    async updateStatus() {
        if (!this.#afkInfo.timer) this.#afkInfo.timer = this.#newAfkTemplate.body[this.#afkInfo.phase].timeLimit
        this.#afkInfo.timer = this.#afkInfo.timer - 5
        if (this.#afkInfo.timer == 0) return this.processPhaseNext()
        if (!this.#afkInfo.raidStatusMessage) return
        this.#afkInfo.raidStatusEmbed.setFooter({ text: `Time Remaining: ${Math.floor(this.#afkInfo.timer / 60)} minutes and ${this.#afkInfo.timer % 60} seconds` });
        let reactables = this.getReactables()
        let components = reactables.concat(this.getPhaseControls())
        if (this.#afkInfo.raidStatusMessage) this.#afkInfo.raidStatusMessage.edit({ embeds: [this.#afkInfo.raidStatusEmbed], components: components })
        return
    }

    removeFromActiveInteractions(id) {
        let ind = this.#afkInfo.openInteractions.indexOf(id)
        if (ind > -1) this.#afkInfo.openInteractions.splice(ind)
        return
    }

    async sendInitialStatusMessage() {
        this.#newAfkTemplate.populateBody(this.#channel)
        this.#newAfkTemplate.populateButtons(this.#channel)
        let flag = {'us': ':flag_us:', 'eu': ':flag_eu:'}[this.#afkInfo.location.substring(0, 2)]
        let pingText = this.#newAfkTemplate.pingRoles.map(r =>`${r}`).join(' ')
        this.#afkInfo.raidStatusEmbed = new Discord.EmbedBuilder()
            .setColor(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color ? this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color : '#ffffff')
            .setDescription(`\`${this.#newAfkTemplate.name}\`${flag ? ` in (${flag})` : ''} will begin in ${Math.round(this.#newAfkTemplate.startDelay)} seconds. Be prepared to join the raid.`)
        if (this.#newAfkTemplate.body[this.#afkInfo.phase].embed.thumbnail) this.#afkInfo.raidStatusEmbed.setThumbnail(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.thumbnail)
        this.#afkInfo.raidStatusMessage = await this.#newAfkTemplate.raidStatusChannel.send({
            content: `${pingText}, ${this.#newAfkTemplate.name}${flag ? ` (${flag})` : ''}. Reactables will be prioritised. After everything is confirmed, the channel will open up.`,
            embeds: [this.#newAfkTemplate.startDelay > 0 ? this.#afkInfo.raidStatusEmbed : null]
        })
        this.#afkInfo.raidStatusInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.#afkInfo.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.#afkInfo.raidStatusInteractionHandler.on('collect', interaction => this.interactionHandler(interaction))
    }

    async sendStatusMessage() {
        this.#afkInfo.raidStatusEmbed.setAuthor({name: `${this.#newAfkTemplate.name} Has Been Started`})
        this.#afkInfo.raidStatusEmbed.setFooter({text: `Time Remaining: ${Math.floor(this.#newAfkTemplate.body[this.#afkInfo.phase].timeLimit / 60)} minutes and ${this.#newAfkTemplate.body[this.#afkInfo.phase].timeLimit % 60} seconds`})
        this.#afkInfo.raidStatusEmbed.setTimestamp(Date.now())
        if (this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color) this.#afkInfo.raidStatusEmbed.setColor(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color ? this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color : '#ffffff')
        if (this.#newAfkTemplate.body[this.#afkInfo.phase].embed.description) this.#afkInfo.raidStatusEmbed.setDescription(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.description)
        if (this.#message.member.avatarURL()) this.#afkInfo.raidStatusEmbed.data.author.iconURL = this.#message.member.avatarURL()
        if (this.#newAfkTemplate.body[this.#afkInfo.phase].embed.image) this.#afkInfo.raidStatusEmbed.setImage(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.image)
        if (this.#newAfkTemplate.body[this.#afkInfo.phase].embed.thumbnail) this.#afkInfo.raidStatusEmbed.setThumbnail(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.thumbnail)
        let reactables = this.getReactables()
        let components = reactables.concat(this.getPhaseControls())
        this.#afkInfo.raidStatusMessage = await this.#afkInfo.raidStatusMessage.edit({ embeds: [this.#afkInfo.raidStatusEmbed], components: components })
        
        for (let i in this.#newAfkTemplate.reacts) {
            let start = this.#newAfkTemplate.reacts[i].start
            let end = this.#newAfkTemplate.reacts[i].lifetime == "forever" ? this.#newAfkTemplate.phases + 1 : start + this.#newAfkTemplate.reacts[i].lifetime
            if (start > this.#afkInfo.phase) continue
            if (end <= this.#afkInfo.phase) {
                await this.#afkInfo.raidStatusMessage.reactions.cache.get(this.#bot.storedEmojis[this.#newAfkTemplate.reacts[i].emote].id).remove()
                continue
            }
            await this.#afkInfo.raidStatusMessage.react(this.#bot.storedEmojis[this.#newAfkTemplate.reacts[i].emote].id)
        }
        return
    }

    async sendCommandsMessage() {
        if (!this.#afkInfo.raidCommandsEmbed) {
            this.#afkInfo.raidCommandsEmbed = new Discord.EmbedBuilder()
                .setColor(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color ? this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color : '#ffffff')
                .setTitle(`${this.#message.member.nickname}'s ${this.#newAfkTemplate.name}`)
                .setFooter({text: `Click ✅ to move to the next phase, Click ❌ to abort`})
                .setDescription(`**Raid Leader: ${this.#message.member} \`\`${this.#message.member.nickname}\`\`\nVC: ${this.#channel ? this.#channel : "VCLess"}\nLocation:** \`\`${this.#afkInfo.location}\`\``)
            let position = 0
            for (let i in this.#newAfkTemplate.buttons) {
                this.#afkInfo.reactables[i].position = position
                this.#afkInfo.raidCommandsEmbed.addFields({ name: `${this.#newAfkTemplate.buttons[i].emote ? `${this.#bot.storedEmojis[this.#newAfkTemplate.buttons[i].emote].text} ` : ''} ${i}`, value: 'None!', inline: true })
                position++
            }
        }
        let components = this.getPhaseControls()
        
        if (this.#afkInfo.raidCommandsMessage) this.#afkInfo.raidCommandsMessage = await this.#afkInfo.raidCommandsMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed], components: components})
        else this.#afkInfo.raidCommandsMessage = await this.#newAfkTemplate.raidCommandChannel.send({ embeds: [this.#afkInfo.raidCommandsEmbed], components: components})
        if (this.#afkInfo.raidInfoMessage) this.#afkInfo.raidInfoMessage = await this.#afkInfo.raidInfoMessage.edit({embeds: [this.#afkInfo.raidCommandsEmbed]})
        else this.#afkInfo.raidInfoMessage = await this.#newAfkTemplate.raidInfoChannel.send({embeds: [this.#afkInfo.raidCommandsEmbed]})
        
        if (!this.#afkInfo.raidCommandsInteractionHandler) {
            this.#afkInfo.raidCommandsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.#afkInfo.raidCommandsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.#afkInfo.raidCommandsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
        return
    }

    async sendChannelsMessage() {
        if (!this.#afkInfo.raidChannelsEmbed) {
            let raidLeaderDisplayName = this.#message.member.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
            this.#afkInfo.raidChannelsEmbed = new Discord.EmbedBuilder()
                .setDescription(`Whenever the run is over. Click the button to delete the channel. View the timestamp for more information\nLocation: \`${this.#afkInfo.location}\``)
                .setFooter({ text: `${this.#channel ? this.#channel.id : "VCLess"}` })
                .setTimestamp(Date.now())
                .setTitle(`${raidLeaderDisplayName}'s ${this.#newAfkTemplate.name}`)
                .setColor(this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color ? this.#newAfkTemplate.body[this.#afkInfo.phase].embed.color : '#ffffff')
        }
        let components = this.getPhaseControls()

        if (this.#afkInfo.raidChannelsMessage) this.#afkInfo.raidChannelsMessage = await this.#afkInfo.raidChannelsMessage.edit({content: `${this.#message.member}`, embeds: [this.#afkInfo.raidChannelsEmbed], components: components })
        else this.#afkInfo.raidChannelsMessage = await this.#newAfkTemplate.raidActiveChannel.send({content: `${this.#message.member}`, embeds: [this.#afkInfo.raidChannelsEmbed], components: components })
       
        if (!this.#afkInfo.raidChannelsInteractionHandler) {
            this.#afkInfo.raidChannelsInteractionHandler = new Discord.InteractionCollector(this.#bot, { message: this.#afkInfo.raidChannelsMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            this.#afkInfo.raidChannelsInteractionHandler.on('collect', (interaction) => this.interactionHandler(interaction))
        }
        return
    }

    getPhaseControls() {
        const components = []
        const phaseActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel(`✅ ${this.#newAfkTemplate.body[`${this.#afkInfo.phase}`].nextPhaseButton ? `${this.#newAfkTemplate.body[`${this.#afkInfo.phase}`].nextPhaseButton}` : `Phase ${this.#afkInfo.phase}`}`)
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
            let end = this.#newAfkTemplate.buttons[i].lifetime == "forever" ? this.#newAfkTemplate.phases + 1 : start + this.#newAfkTemplate.buttons[i].lifetime
            if (disableStart < start && disableStart > this.#afkInfo.phase) continue
            if (!(disableStart < start) && start > this.#afkInfo.phase) continue
            if (end <= this.#afkInfo.phase) continue
            const reactableButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(`${i}`)
            let label = `${this.#newAfkTemplate.buttons[i].displayName ? `${i} ` : ``}${this.#newAfkTemplate.buttons[i].limit ? ` ${this.#afkInfo.reactables[i].users.length}/${this.#newAfkTemplate.buttons[i].limit}` : ``}`
            reactableButton.setLabel(label)
            if (this.#newAfkTemplate.buttons[i].emote) reactableButton.setEmoji(this.#bot.storedEmojis[this.#newAfkTemplate.buttons[i].emote].id)
            if (this.#afkInfo.reactables[i].users.length == this.#newAfkTemplate.buttons[i].limit) reactableButton.setDisabled(true)
            if (disableStart < start && start > this.#afkInfo.phase) reactableButton.setDisabled(true)
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
        if (this.#newAfkTemplate.buttons[interaction.customId]) {
            if(this.#afkInfo.openInteractions.includes(interaction.member.id)) return
            this.#afkInfo.openInteractions.push(interaction.member.id)
            const buttonType = this.#newAfkTemplate.buttons[interaction.customId].type
            const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
            const position = this.#afkInfo.reactables[interaction.customId].position
            const emote = buttonInfo.emote ? `${this.#bot.storedEmojis[buttonInfo.emote].text} ` : ``
            const embed = new Discord.EmbedBuilder()

            if (buttonInfo.minRole && !interaction.member.roles.cache.has(this.#botSettings.roles[buttonInfo.minRole])) {
                    embed.setDescription(`You do not have the required role ${interaction.guild.roles.cache.get(this.#botSettings.roles[buttonInfo.minRole])} to react to this run.`)
                    await interaction.reply({ embeds: [embed], ephemeral: true })
                    return this.removeFromActiveInteractions(interaction.member.id)
                }
            }
            if (this.#afkInfo.reactables[interaction.customId].users.includes(interaction.member.id)) {
                embed.setDescription(`You have already reacted as ${interaction.customId}. Try another react or try again next run.`)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }

            let buttonStatus = false

            switch (buttonType) {
                case "Log":
                case "Normal":
                    buttonStatus = await this.processReactableNormal(interaction)
                    break
                case "Drag":
                    buttonStatus = await this.processReactableDrag(interaction)
                    break
                case "Supporter":
                    buttonStatus = await this.processReactableSupporter(interaction)
                    break
                case "Points":
                    buttonStatus = await this.processReactablePoints(interaction)
                    break
            }

            if (!buttonStatus) return
            this.#afkInfo.reactables[interaction.customId].users.push(interaction.member.id)
            if (!this.#afkInfo.earlySlot.includes(interaction.member.id)) this.#afkInfo.earlySlot.push(interaction.member.id)
            if (this.#afkInfo.raidCommandsEmbed.data.fields[position].value == `None!`) this.#afkInfo.raidCommandsEmbed.data.fields[position].value = `${emote ? emote : this.#afkInfo.reactables[interaction.customId].users.length}: <@!${interaction.member.id}>`
            else this.#afkInfo.raidCommandsEmbed.data.fields[position].value += `\n${emote ? emote : this.#afkInfo.reactables[interaction.customId].users.length}: <@!${interaction.member.id}>`
            await this.#afkInfo.raidCommandsMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await this.#afkInfo.raidInfoMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            return this.removeFromActiveInteractions(interaction.member.id)
        }
        else if (interaction.customId == 'abort' || interaction.customId == 'phase' || interaction.customId.includes(`Log`) || interaction.customId == 'end') {
            if (interaction.member.roles.highest.position >= interaction.guild.roles.cache.get(this.#botSettings.roles.eventrl).position) return await this.processPhaseControl(interaction)
            else return await interaction.deferUpdate()
        }
        else return
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
        return
    }

    async processPhaseAbort(interaction) {
        let confirmEmbed = new Discord.EmbedBuilder()
                                      .setDescription(`Are you sure you want to abort this run?\nThis window will close in 10 seconds and cancel.`)
        const confirmActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('Abort')
                .setStyle(4)
                .setCustomId('confirm'),
            new Discord.ButtonBuilder()
                .setLabel('❌ Cancel')
                .setStyle(2)
                .setCustomId('cancel')
        ])
        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true, components: [confirmActionRow] })
        const confirmMessage = await interaction.fetchReply()
        const confirmInteractionCollector = new Discord.InteractionCollector(this.#bot, { time: 10000, message: confirmMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        const confirmPromise = await new Promise((resolve) => {
            let resolved = false
            confirmInteractionCollector.on("collect", async subInteraction => {
                resolved = true
                if (subInteraction.customId === 'cancel') {
                    confirmEmbed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(false)
                } else if (subInteraction.customId === 'confirm') {
                    confirmEmbed.setDescription('Channel successfully aborted. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(true)
                } else {
                    confirmEmbed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(false)
                }
            })
            confirmInteractionCollector.on('end', async subInteraction => {
                if (!resolved) {
                    confirmEmbed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(false)
                }
            })
        })
        if (!confirmPromise) return

        this.#afkInfo.raidStatusInteractionHandler.stop()
        this.#afkInfo.raidCommandsInteractionHandler.stop()
        this.#afkInfo.raidChannelsInteractionHandler.stop()

        if (this.moveInTimer) clearInterval(this.moveInTimer)
        if (this.updateStatusTimer) clearInterval(this.updateStatusTimer)
        if (this.#channel) await this.#channel.delete()
        
        this.#afkInfo.raidStatusEmbed.setImage(null)
        this.#afkInfo.raidStatusEmbed.setDescription(`This afk check has been aborted`)
        this.#afkInfo.raidStatusEmbed.setFooter({ text: `The afk check has been aborted by ${this.#message.guild.members.cache.get(interaction.member.id).nickname}` })
        this.#afkInfo.raidStatusMessage.reactions.removeAll()

        await this.#afkInfo.raidStatusMessage.edit({ content: null, embeds: [this.#afkInfo.raidStatusEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#afkInfo.raidCommandsMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed], components: []})
        await this.#afkInfo.raidInfoMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#afkInfo.raidChannelsMessage.delete()

        this.#bot.afkChecks[this.#afkInfo.leaderID] = {
            leaderNick: this.#message.member.displayName.replace(/[^a-z|]/gi, '').split('|')[0],
            guild: this.#guild.id,
            raidleader: this.#afkInfo.leaderID,
            time: Date.now(),
            afkInfo: this.#afkInfo,
            newAfkTemplate: this.#newAfkTemplate
        }
        this.#bot.afkChecks[this.#afkInfo.leaderID].active = false
        fs.writeFileSync('./data/afkChecks.json', JSON.stringify(this.#bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.#bot, this.#guild) })
        this.#afkInfo.active = false
        return
    }

    async processPhaseNext(interaction) {
        this.#afkInfo.phase++
        if (this.#afkInfo.phase > this.#newAfkTemplate.phases) return this.postAfk(interaction)
        let tempRaidStatusMessage = null
        if (this.#newAfkTemplate.body[`${this.#afkInfo.phase}`].message) tempRaidStatusMessage = await this.#newAfkTemplate.raidStatusChannel.send({ content: `${this.#newAfkTemplate.body[`${this.#afkInfo.phase}`].message}` })
        if (interaction) interaction.deferUpdate()
        setTimeout(async () => {
            if (this.#newAfkTemplate.body[`${this.#afkInfo.phase}`].vcState == 'Open' && this.#channel) this.#channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            else if (this.#newAfkTemplate.body[`${this.#afkInfo.phase}`].vcState == 'Locked' && this.#channel) this.#channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            await Promise.all(this.sendStatusMessage(), this.sendCommandsMessage(), this.sendChannelsMessage()])
        }, 5000)
        setTimeout(async () => { if (tempRaidStatusMessage) tempRaidStatusMessage.delete() }, 20000)
        return
    }

    async processPhaseLog(interaction) {
        const button = interaction.customId.substring(4)
        const buttonInfo = this.#newAfkTemplate.buttons[button]

        let member = null
        let number = null
        let choiceText = buttonInfo.emote ? `${this.#bot.storedEmojis[buttonInfo.emote].text} **${button}**` : `**${button}**`
        let confirmEmbed = new Discord.EmbedBuilder()

        confirmEmbed.setDescription(`Which member you want to log ${choiceText} reacts for in this run?\nChoose or input a username or id.\nThis window will cancel and close in 10 seconds.`)
        const confirmMemberMenu = new Discord.StringSelectMenuBuilder()
                .setCustomId(`member`)
                .setPlaceholder(`Name of ${button}s`)
        for (let i of this.#afkInfo.reactables[button].users) {
            confirmMemberMenu.addOptions({ label: this.#guild.members.cache.get(i).nickname, value: i })
        }
        confirmMemberMenu.addOptions({ label: 'Custom', value: 'custom' })
        const confirmMemberActionRow = new Discord.ActionRowBuilder().addComponents(confirmMemberMenu)
        const confirmMemberMessage = await interaction.channel.send({ embeds: [confirmEmbed], ephemeral: true, components: [confirmMemberActionRow] })
        const confirmMemberInteractionCollector = new Discord.InteractionCollector(this.#bot, { time: 10000, message: confirmMemberMessage, interactionType: Discord.InteractionType.MessageComponent })
        const confirmMemberPromise = await new Promise((resolve) => {
            let resolved = false
            confirmMemberInteractionCollector.on("collect", async subInteraction => {
                resolved = true
                if (subInteraction.values[0] == 'custom') {
                    const memberModal = new Discord.ModalBuilder()
                        .setCustomId(`customId`)
                        .setTitle(`Afk Info`)
                    const memberActionRow = new Discord.ActionRowBuilder().addComponents(
                        new Discord.TextInputBuilder()
                            .setCustomId(`customIdField`)
                            .setLabel(`Who do you want to log ${button} reacts for?`)
                            .setPlaceholder(`Name of ${button}s`)
                            .setStyle(Discord.TextInputStyle.Short)
                            .setRequired(true)
                    )
                    memberModal.addComponents(memberActionRow)
                    await subInteraction.showModal(memberModal)
                    const submitted = await subInteraction.awaitModalSubmit({ time: 10000}).catch(error => {console.error(error)})
                    if (submitted) {
                        let memberField = submitted.fields.getTextInputValue(`customIdField`)
                        await submitted.deferUpdate()
                        if (!member) member = this.#guild.members.cache.get(memberField)
                        if (!member) member = this.#guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberField.toLowerCase()))
                    }
                    confirmMemberMessage.delete()
                    confirmMemberInteractionCollector.stop()
                    resolve(true)
                } else {
                    let memberField = subInteraction.values[0]
                    if (!member) member = this.#guild.members.cache.get(memberField)
                    if (!member) member = this.#guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberField.toLowerCase()))
                    confirmMemberMessage.delete()
                    confirmMemberInteractionCollector.stop()
                    resolve(true)
                }
            })
            confirmMemberInteractionCollector.on('end', async subInteraction => {
                if (!resolved)  {
                    confirmMemberMessage.delete()
                    confirmMemberInteractionCollector.stop()
                    resolve(false)
                }
            })
        })
        if (!confirmMemberPromise || !member) return
        confirmEmbed.setDescription(`How many ${choiceText} reacts do you want to log for this member?\nChoose or input a number.\nThis window will cancel and close in 10 seconds.`)
        const confirmNumberActionRow = new Discord.ActionRowBuilder().addComponents(
            new Discord.StringSelectMenuBuilder()
                .setCustomId(`number`)
                .setPlaceholder(`Number of ${button}s`)
                .setMinValues(1)
                .setMaxValues(1)
                .setOptions(
                    { label: '0', value: '0' },
                    { label: '1', value: '1' },
                    { label: '2', value: '2' },
                    { label: '3', value: '3' },
                    { label: 'Custom', value: 'custom' },
                )
        )
        const confirmNumberMessage = await interaction.channel.send({ embeds: [confirmEmbed], ephemeral: true, components: [confirmNumberActionRow] })
        const confirmNumberInteractionCollector = new Discord.InteractionCollector(this.#bot, { time: 10000, message: confirmNumberMessage, interactionType: Discord.InteractionType.MessageComponent })
        const confirmNumberPromise = await new Promise((resolve) => {
            let resolved = false
            confirmNumberInteractionCollector.on("collect", async subInteraction => {
                resolved = true
                if (subInteraction.values[0] == 'custom') {
                    const numberModal = new Discord.ModalBuilder()
                        .setCustomId(`number`)
                        .setTitle(`Afk Info`)
                    const numberActionRow = new Discord.ActionRowBuilder().addComponents(
                        new Discord.TextInputBuilder()
                            .setCustomId(`numberField`)
                            .setLabel(`How many ${button} reacts do you want to log?`)
                            .setPlaceholder(`Number of ${button}s`)
                            .setStyle(Discord.TextInputStyle.Short)
                            .setRequired(true)
                    )
                    numberModal.addComponents(numberActionRow)
                    await subInteraction.showModal(numberModal)
                    const submitted = await subInteraction.awaitModalSubmit({ time: 10000}).catch(error => {console.error(error)})
                    if (submitted) {
                        let numberField = submitted.fields.getTextInputValue(`numberField`)
                        await submitted.deferUpdate()
                        console.log(`Phase1: numberField ${numberField} number ${number}`)
                        if (!isNaN(parseInt(numberField))) {
                            console.log(`Phase2: numberField ${numberField} number ${number}`)
                            number = parseInt(numberField)
                        }
                    }
                    console.log(`Phase3: number ${number}`)
                    confirmNumberMessage.delete()
                    confirmNumberInteractionCollector.stop()
                    resolve(true)
                } else {
                    let numberField = subInteraction.values[0]
                    console.log(`Phase4: numberField ${numberField} number ${number}`)
                    if (!number) number = parseInt(numberField)
                    console.log(`Phase5: numberField ${numberField} number ${number}`)
                    confirmNumberMessage.delete()
                    confirmNumberInteractionCollector.stop()
                    resolve(true)
                }
            })
            confirmNumberInteractionCollector.on('end', async subInteraction => {
                if (!resolved)  {
                    confirmEmbed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmNumberMessage.delete()
                    confirmNumberInteractionCollector.stop()
                    resolve(false)
                }
            })
        })

        if (!confirmNumberPromise || !number) return
        console.log(`Phase6: number ${number}`)
        console.log(confirmNumberPromise, number)
        this.#db.query(`UPDATE users SET ${buttonInfo.logName} = ${buttonInfo.logName} + ${number} WHERE id = '${member.id}'`, async (err, rows) => {
            if (err) return console.log(`${buttonInfo.logName} missing from ${this.#guild.name} ${this.#guild.id}`)
            return
        })
        this.#db.query(`SELECT ${buttonInfo.logName} FROM users WHERE id = '${member.id}'`, async (err, rows) => {
            if (err) return console.log(`${buttonInfo.logName} missing from ${this.#guild.name} ${this.#guild.id}`)
            console.log(`Phase7: ${parseInt(rows[0][buttonInfo.logName])} number ${number}`)
            let embed = new Discord.EmbedBuilder()
                .setColor('#0000ff')
                .setTitle(`Key logged!`)
                .setDescription(`${member} now has \`\`${parseInt(rows[0][buttonInfo.logName]) + parseInt(number)}\`\` ${choiceText} pops`)
            return this.#newAfkTemplate.raidCommandChannel.send({ embeds: [embed] })
        })
        confirmEmbed.setDescription('Sucessfully logged. You can dismiss this message')
        interaction.editReply({ embeds: [confirmEmbed], components: [] })
        return
    }

    async processPhaseEnd(interaction) {
        let confirmEmbed = new Discord.EmbedBuilder()
        confirmEmbed.setDescription(`Are you sure you want to delete this run?\nThis window will close in 10 seconds and cancel.`)
        const confirmActionRow = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('Delete Channel')
                .setStyle(4)
                .setCustomId('confirm'),
            new Discord.ButtonBuilder()
                .setLabel('❌ Cancel')
                .setStyle(2)
                .setCustomId('cancel')
        ])
        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true, components: [confirmActionRow] })
        const confirmMessage = await interaction.fetchReply()
        const confirmInteractionCollector = new Discord.InteractionCollector(this.#bot, { time: 10000, message: confirmMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        const confirmPromise = await new Promise((resolve) => {
            let resolved = false
            confirmInteractionCollector.on("collect", async subInteraction => {
                resolved = true
                if (subInteraction.customId === 'cancel') {
                    confirmEmbed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(false)
                } else if (subInteraction.customId === 'confirm') {
                    confirmEmbed.setDescription('Channel successfully deleted. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(true)
                } else {
                    confirmEmbed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(false)
                }
            })
            confirmInteractionCollector.on('end', async subInteraction => {
                if (!resolved) {
                    confirmEmbed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [confirmEmbed], components: [] })
                    confirmInteractionCollector.stop()
                    resolve(false)
                }
            })
        })
        if (!confirmPromise) return
        this.#afkInfo.raidStatusInteractionHandler.stop()
        this.#afkInfo.raidCommandsInteractionHandler.stop()
        this.#afkInfo.raidChannelsInteractionHandler.stop()

        if (this.#channel) await this.#channel.delete()

        await this.#afkInfo.raidStatusMessage.edit({ content: null, embeds: [this.#afkInfo.raidStatusEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#afkInfo.raidCommandsMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed], components: []})
        await this.#afkInfo.raidInfoMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#afkInfo.raidChannelsMessage.delete()

        this.#bot.afkChecks[this.#afkInfo.leaderID] = {
            leaderNick: this.#message.member.displayName.replace(/[^a-z|]/gi, '').split('|')[0],
            guild: this.#guild.id,
            raidleader: this.#afkInfo.leaderID,
            time: Date.now(),
            afkInfo: this.#afkInfo,
            newAfkTemplate: this.#newAfkTemplate
        }
        this.#bot.afkChecks[this.#afkInfo.leaderID].active = false
        fs.writeFileSync('./data/afkChecks.json', JSON.stringify(this.#bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.#bot, this.#guild) })
        this.#afkInfo.active = false
        return
    } 

    async processReactableNormal(interaction) {
        const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
        const embed = new Discord.EmbedBuilder()
        const emote = buttonInfo.emote ? `${this.#bot.storedEmojis[buttonInfo.emote].text} ` : ``

        if (this.#afkInfo.reactables[interaction.customId].users.length >= buttonInfo.limit) {
            embed.setDescription(`Too many people have already reacted and confirmed for that. Try another react or try again next run.`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            let descriptionMiddle = ``
            if (buttonInfo.confirmationMessage) descriptionMiddle = buttonInfo.confirmationMessage
            embed.setDescription(`${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`)
            if (buttonInfo.confirmationImage) embed.setImage(buttonInfo.confirmationImage)
            const confirmActionRow = new Discord.ActionRowBuilder().addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('✅ Confirm')
                    .setStyle(3)
                    .setCustomId('confirm'),
                new Discord.ButtonBuilder()
                    .setLabel('❌ Cancel')
                    .setStyle(4)
                    .setCustomId('cancel')
            ])
            await interaction.reply({ embeds: [embed], ephemeral: true, components: [confirmActionRow] })
            const confirmMessage = await interaction.fetchReply()
            const confirmInteractionCollector = new Discord.InteractionCollector(this.#bot, { time: 60000, message: confirmMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            const confirmPromise = await new Promise((resolve) => {
                let resolved = false
                confirmInteractionCollector.on("collect", async subInteraction => {
                    resolved = true
                    if (subInteraction.customId === 'cancel') {
                        embed.setDescription('Cancelled. You can dismiss this message')
                        embed.setImage(null)
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    } else if (this.#afkInfo.reactables[interaction.customId].users.length >= buttonInfo.limit) {
                        embed.setDescription('Too many people have already reacted and confirmed for that.')
                        embed.setImage(null)
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    } else if (subInteraction.customId === 'confirm') {
                        confirmInteractionCollector.stop()
                        resolve(true)
                    } else {
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    }
                })
                confirmInteractionCollector.on('end', async subInteraction => {
                    if (!resolved) {
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    }
                });
            })
            if (!confirmPromise) return confirmPromise
        }

        if (buttonInfo.location) embed.setDescription(`The location for this run has been set to \`${this.#afkInfo.location}\`, get there ASAP!${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
        else embed.setDescription(`You do not get location for this reaction.${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
        if (buttonInfo.confirm) await interaction.editReply({ embeds: [embed], components: [] })
        else await interaction.reply({ embeds: [embed], ephemeral: true })
        return true
    }

    async processReactableDrag(interaction) {
        const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
        const embed = new Discord.EmbedBuilder()
        const emote = buttonInfo.emote ? `${this.#bot.storedEmojis[buttonInfo.emote].text} ` : ``

        if (this.#afkInfo.reactables[interaction.customId].users.length >= buttonInfo.limit) {
            embed.setDescription(`Too many people have already reacted and confirmed for that. Try another react or try again next run.`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            let descriptionMiddle = ``
            if (buttonInfo.confirmationMessage) descriptionMiddle = buttonInfo.confirmationMessage
            embed.setDescription(`${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`)
            if (buttonInfo.confirmationImage) embed.setImage(buttonInfo.confirmationImage)
            const confirmActionRow = new Discord.ActionRowBuilder().addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('✅ Confirm')
                    .setStyle(3)
                    .setCustomId('confirm'),
                new Discord.ButtonBuilder()
                    .setLabel('❌ Cancel')
                    .setStyle(4)
                    .setCustomId('cancel')
            ])
            await interaction.reply({ embeds: [embed], ephemeral: true, components: [confirmActionRow] })
            const confirmMessage = await interaction.fetchReply()
            const confirmInteractionCollector = new Discord.InteractionCollector(this.#bot, { time: 60000, message: confirmMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            const confirmPromise = await new Promise((resolve) => {
                let resolved = false
                confirmInteractionCollector.on("collect", async subInteraction => {
                    resolved = true
                    if (subInteraction.customId === 'cancel') {
                        embed.setDescription('Cancelled. You can dismiss this message')
                        embed.setImage(null)
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    } else if (this.#afkInfo.reactables[interaction.customId].users.length >= buttonInfo.limit) {
                        embed.setDescription('Too many people have already reacted and confirmed for that.')
                        embed.setImage(null)
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    } else if (subInteraction.customId === 'confirm') {
                        confirmInteractionCollector.stop()
                        resolve(true)
                    } else {
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    }
                })
                confirmInteractionCollector.on('end', async subInteraction => {
                    if (!resolved) {
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    }
                });
            })
            if (!confirmPromise) return confirmPromise
        }

        if (buttonInfo.location) embed.setDescription(`The location for this run has been set to \`${this.#afkInfo.location}\`, get there ASAP!${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
        else embed.setDescription(`You do not get location for this reaction.${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
        if (buttonInfo.confirm) await interaction.editReply({ embeds: [embed], components: [] })
        else await interaction.reply({ embeds: [embed], ephemeral: true })
        return true
    }

    async processReactableSupporter(interaction) {
        const embed = new Discord.EmbedBuilder()

        if (this.#afkInfo.earlySlot.includes(interaction.member.id)) {
            embed.setDescription(`Supporter Perks in \`${interaction.guild.name}\` only gives a guaranteed slot in the raid and you already have this from another react.\nYour Supporter Perks have not been used.${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        if (interaction.member.roles.highest.position >= interaction.guild.roles.cache.get(this.#botSettings.roles.trialrl).position) {
            embed.setDescription(`The location for this run has been set to \`${this.#afkInfo.location}\``)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        for (let i of this.#botSettings.lists.earlyLocation) { //custom early location roles
            if (interaction.member.roles.cache.has(i)) {
                embed.setDescription(`The location for this run has been set to \`${this.#afkInfo.location}\``)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                this.removeFromActiveInteractions(interaction.member.id)
                return false
            }
        }
        if (!interaction.member.roles.cache.hasAny(...this.#newAfkTemplate.perkRoles.map(role => role.id))) {
            embed.setDescription(`You are not eligible for this reaction as you do not have the required Supporter role`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        let supporterRole = interaction.member.supporterHierarchy(this.#botSettings)
        if (!supporterRole) {
            embed.setDescription(`You are not eligible for this reaction as you do not have the required Supporter role`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        if (this.#afkInfo.reactables[interaction.customId].users.length >= this.#botSettings.numerical.supporterlimit) {
            this.#newAfkTemplate.buttons[interaction.customId].limit = this.#botSettings.numerical.supporterlimit
            embed.setDescription('Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.');
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false 
        }
        if (this.#afkInfo.reactables[interaction.customId].users.length >= this.#botSettings.supporter[`supporterLimit${supporterRole}`]) {
            embed.setDescription(`Too many Supporters have already reacted and received guaranteed slots. Try another react or try again next run.`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        let cooldown = this.#botSettings.supporter[`supporterCooldownSeconds${supporterRole}`]
        let uses = this.#botSettings.supporter[`supporterUses${supporterRole}`]
        let lastUseCheck = Date.now() - (cooldown * 1000)
        this.#db.query(`SELECT * FROM supporterusage WHERE guildid = '${interaction.guild.id}' AND userid = '${interaction.member.id}' AND utime > '${lastUseCheck}'`,
            async (err, rows) => {
            if (err) {
                ErrorLogger.log(err, this.#bot, this.#guild)
                this.removeFromActiveInteractions(interaction.member.id)
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
                this.removeFromActiveInteractions(interaction.member.id)
                return false
            }
            embed.setDescription(`You have received a guaranteed slot.${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            return true
        })
    }

    async processReactablePoints(interaction) {
        const buttonInfo = this.#newAfkTemplate.buttons[interaction.customId]
        const embed = new Discord.EmbedBuilder()
        const emote = buttonInfo.emote ? `${this.#bot.storedEmojis[buttonInfo.emote].text} ` : ``

        if (!this.#botSettings.backend.points) {
            await interaction.deferUpdate()
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        if (this.#afkInfo.reactables[interaction.customId].users.length >= buttonInfo.limit) {
            embed.setDescription(`Too many people have already reacted and confirmed for that. Try another react or try again next run.`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }
        
        let points = 0
        this.#db.query(`SELECT points FROM users WHERE id = '${interaction.member.id}'`,
            async (err, rows) => {
            if (err) {
                ErrorLogger.log(err, this.#bot, this.#guild)
                this.removeFromActiveInteractions(interaction.member.id)
                return false
            }
            if (rows.length == 0) return this.#db.query(`INSERT INTO users (id) VALUES ('${interaction.member.id}')`)
            points = rows[0].points
        })

        if (points < this.#afkInfo.earlyLocationCost) {
            embed.setDescription(`You do not have enough points.\nYou currently have ${emote} \`${rows[0].points}\` points\nEarly location costs ${emote} \`${earlyLocationCost}\``)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.member.id)
            return false
        }

        if (buttonInfo.confirm) {
            let descriptionBeginning = `You reacted with ${emote}${interaction.customId}.\n`
            let descriptionEnd = `Press ✅ to confirm your reaction. Otherwise press ❌`
            if (buttonInfo.confirmationMessage) descriptionMiddle = buttonInfo.confirmationMessage
            else descriptionMiddle = `You currently have ${emote} \`${rows[0].points}\` points\nEarly location costs ${emote} \`${earlyLocationCost}\``
            embed.setDescription(`${descriptionBeginning}${descriptionMiddle}${descriptionEnd}`)
            if (buttonInfo.confirmationImage) embed.setImage(buttonInfo.confirmationImage)
            embed.setAuthor({ name: 'Please Confirm Point Usage', iconURL: interaction.member.avatarURL() ? interaction.member.avatarURL() : null})
            const confirmActionRow = new Discord.ActionRowBuilder().addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('✅ Confirm')
                    .setStyle(3)
                    .setCustomId('confirm'),
                new Discord.ButtonBuilder()
                    .setLabel('❌ Cancel')
                    .setStyle(4)
                    .setCustomId('cancel')
            ])
            await interaction.reply({ embeds: [embed], ephemeral: true, components: [confirmActionRow] })
            const confirmMessage = await interaction.fetchReply()
            const confirmInteractionCollector = new Discord.InteractionCollector(this.#bot, { time: 60000, message: confirmMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            const confirmPromise = await new Promise((resolve) => {
                let resolved = false
                confirmInteractionCollector.on("collect", async subInteraction => {
                    resolved = true
                    if (subInteraction.customId === 'cancel') {
                        embed.setDescription('Cancelled. You can dismiss this message')
                        embed.setImage(null)
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    } else if (this.#afkInfo.reactables[interaction.customId].users.length >= buttonInfo.limit) {
                        embed.setDescription('Too many people have already reacted and confirmed for that.')
                        embed.setImage(null)
                        embed.setAuthor(null)
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    } else if (subInteraction.customId === 'confirm') {
                        confirmInteractionCollector.stop()
                        resolve(true)
                    } else {
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    }
                })
                confirmInteractionCollector.on('end', async subInteraction => {
                    if (!resolved) {
                        this.removeFromActiveInteractions(interaction.member.id)
                        confirmInteractionCollector.stop()
                        resolve(false)
                    }
                })
            })
            if (!confirmPromise) return confirmPromise
        }

        if (buttonInfo.location) embed.setDescription(`The location for this run has been set to \`${this.#afkInfo.location}\`, get there ASAP!${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
        else embed.setDescription(`You do not get location for this reaction.${this.#newAfkTemplate.vcOptions ? ` Join lounge to be moved into the channel.` : ``}`)
        if (buttonInfo.confirm) await interaction.editReply({ embeds: [embed], components: [] })
        else await interaction.reply({ embeds: [embed], ephemeral: true })
        return true
    }

    async postAfk(interaction) {
        if (this.moveInTimer) clearInterval(this.moveInTimer)
        if (this.updateStatusTimer) clearInterval(this.updateStatusTimer)

        if (this.#channel) {
            this.#channel.permissionOverwrites.edit(this.#newAfkTemplate.minimumJoinRaiderRole.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
            this.#channel.setPosition(0)
        }

        this.#afkInfo.raidStatusEmbed.setDescription(`This afk check has been ended.${this.#newAfkTemplate.vcOptions ? ` If you get disconnected during the run, **JOIN LOUNGE** *then* press the huge **RECONNECT** button` : ``}`)
            .setFooter({ text: `The afk check has been ended by ${interaction ? this.#message.guild.members.cache.get(interaction.member.id).nickname : this.#message.guild.members.cache.get(this.#afkInfo.leaderID).nickname}` })

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
            if (this.#newAfkTemplate.buttons[i].type != 'Log') continue
            const phaseButton = new Discord.ButtonBuilder()
            .setStyle(2)
            .setCustomId(`Log ${i}`)
            phaseButton.setLabel(`Log ${i}`)
            if (this.#newAfkTemplate.buttons[i].emote) phaseButton.setEmoji(this.#bot.storedEmojis[this.#newAfkTemplate.buttons[i].emote].id)
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
            .setLabel('❌ Delete Channel')
            .setStyle(4)
            .setCustomId('end')
        phaseActionRow.push(phaseButton)
        const phaseComponent = new Discord.ActionRowBuilder({ components: phaseActionRow })
        phaseComponents.push(phaseComponent)

        if (this.#afkInfo.raidStatusInteractionHandler) this.#afkInfo.raidStatusInteractionHandler.stop()
        this.#afkInfo.raidStatusMessage.reactions.removeAll()

        await this.#afkInfo.raidStatusMessage.edit({ content: null, embeds: [this.#afkInfo.raidStatusEmbed], components: [reconnectActionRow] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#afkInfo.raidCommandsMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed], components: phaseComponents }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#afkInfo.raidChannelsMessage.edit({ embeds: [this.#afkInfo.raidChannelsEmbed], components: phaseComponents }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))

        if (this.#channel) this.#channel.members.forEach(m => this.#afkInfo.members.push(m.id))
        else this.#afkInfo.earlySlot.forEach(id => this.#afkInfo.members.push(id))

        for (let u of this.#afkInfo.members) {
            this.#db.query(`SELECT id FROM users WHERE id = '${u}'`, async (err, rows) => {
                if (err) return
                if (rows.length == 0) return this.#db.query(`INSERT INTO users (id) VALUES('${u}')`)
            })
        }

        let raiders_text = `Raiders`
        let raiders_value = `None!`
        this.#afkInfo.members.forEach(m => {
            if (raiders_value.length >= 1000) {
                this.#afkInfo.raidCommandsEmbed.addFields({ name: raiders_text, value: raiders_value })
                raiders_text = `-`
                raiders_value = `, <@!${m}>`
            } else raiders_value == 'None!' ? raiders_value = `<@!${m}>` : raiders_value += `, <@!${m}>`
        })
        
        if (this.#botSettings.backend.point) {
            let pointsLog = []
            for (let i in this.#afkInfo.reactables) {
                for (let u of this.#afkInfo.reactables[i].users) {
                    switch (this.#newAfkTemplate.buttons[i].type) {
                        case 'Log':
                            break
                        case 'Supporter':
                            this.#db.query(`INSERT INTO supporterusage (guildid, userid, utime) VALUES ('${this.#guild.id}', '${u}', '${Date.now()}')`)
                        default:
                            let points = 0
                            if (this.#newAfkTemplate.buttons[i].points.isInteger()) points = this.#newAfkTemplate.buttons[i].points
                            else if (this.#botSettings.points[this.#newAfkTemplate.buttons[i].points]) points = this.#botSettings.points[this.#newAfkTemplate.buttons[i].points]
                            if (this.#guild.members.cache.get(u).roles.cache.hasAny(...this.#newAfkTemplate.perkRoles.map(role => role.id))) points = points * this.#botSettings.points.supportermultiplier
                            this.#db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`, async (err, rows) => {
                                if (err) return console.log('error logging key points in ', this.#guild.id)
                                pointsLog.push({
                                    uid: u,
                                    points: points,
                                    reason: `${i}`,
                                })
                                return
                            })
                            break
                    }
                }
            }
        let pointlog_mid = await pointLogger.pointLogging(pointsLog, this.#guild, this.#bot, this.#afkInfo.raidCommandsEmbed)
        this.#afkInfo.raidCommandsEmbed.addFields({ name: 'Points Log MID', value: pointlog_mid })
        }
        this.#afkInfo.raidCommandsEmbed.addFields({ name: raiders_text, value: raiders_value })
        await this.#afkInfo.raidInfoMessage.edit({ embeds: [this.#afkInfo.raidCommandsEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.#bot, this.#guild))
        await this.#guild.channels.cache.get(this.#botSettings.channels.history).send({ embeds: [this.#afkInfo.raidCommandsEmbed] })

        // if (restart.restarting) log(this)
        // else setTimeout(log, 60000, this)
        // function log(afkCheck) {
        //     if (afkCheck.channel && afkCheck.channel.members.size != 0) {
        //         let query = `UPDATE users SET ${afkCheck.afkInfo.runLogName} = ${afkCheck.afkInfo.runLogName} + 1 WHERE `
        //         afkCheck.channel.members.each(m => query = query.concat(`id = '${m.id}' OR `))
        //         query = query.substring(0, query.length - 4)
        //         afkCheck.db.query(query, er => { if (er) console.log('error logging run completes in ', afkCheck.guild.id) })
        //         if (afkCheck.settings.backend.points) {
        //             //give points to everyone in run
        //             let regular = []
        //             let supporters = []
        //             afkCheck.channel.members.each(m => {
        //                 if (m.roles.cache.hasAny(...perkRoles.map(role => role.id))) supporters.push(m)
        //                 else regular.push(m)
        //             })
        //             //regular raiders point logging
        //             if (afkCheck.settings.points.perrun != 0 && regular.length != 0) {
        //                 let regularQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun} WHERE `
        //                 regular.forEach(m => { regularQuery = regularQuery.concat(`id = '${m.id}' OR `) })
        //                 regularQuery = regularQuery.substring(0, regularQuery.length - 4)
        //                 afkCheck.db.query(regularQuery, er => { if (er) console.log('error logging points for run completes in ', afkCheck.guild.id) })
        //             }
        //             if (afkCheck.settings.points.perrun != 0 && supporters.length != 0) {
        //                 //supporter raiders point logging
        //                 let supporterQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun * afkCheck.settings.points.supportermultiplier} WHERE `;
        //                 supporters.forEach(m => supporterQuery = supporterQuery.concat(`id = '${m.id}' OR `));
        //                 supporterQuery = supporterQuery.substring(0, supporterQuery.length - 4);
        //                 afkCheck.db.query(supporterQuery, er => { if (er) console.log('error logging points for run (supporter) completes in ', afkCheck.guild.id) })
        //             }
        //         }
        //     }
        // }
        this.active = false;
    }

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
}

function getBannedName(name, guildid) {
    let n = new Set(bannedNames[guildid])
    if (n.has(name.toLowerCase())) return true
    return false
}

function getRunType(char, guildid) {
    for (let i in afkTemplates[guildid]) {
        if (char.toLowerCase() == afkTemplates[guildid][i].symbol) return afkTemplates[guildid][i];
        if (afkTemplates[guildid][i].aliases) {
            if (afkTemplates[guildid][i].aliases.includes(char.toLowerCase())) return afkTemplates[guildid][i];
        }
    }
    return null
}

async function getTemplate(message, afkTemplates, runType) {
    if (afkTemplates[message.author.id] && afkTemplates[message.author.id][runType.toLowerCase()]) return afkTemplates[message.author.id][runType.toLowerCase()]
    else return null
}

async function destroyInactiveRuns() {
    for (let i of runs) {
        if (!i.afk.active) {
            delete i.afk;
        }
    }
    runs = runs.filter((v, i, r) => v.afk)
}

function requestButtonHandler(interaction, channelId, limit) {
    for (let i of runs) {
        if (i.channel == channelId) {
            i.afk.buttonHandler(interaction, limit)
            return
        }
    }
}
