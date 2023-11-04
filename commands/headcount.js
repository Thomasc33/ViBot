const Discord = require('discord.js')
const AfkTemplate = require('./afkTemplate.js')
const fs = require('fs').promises
const afkCheck = require('./afkCheck.js')

class Headcount {
    /**
     * @typedef {{
     *  templateName: string,
     *  memberId: string,
     *  guildId: string,
     *  time: number,
     *  commandChannelId: string,
     *  statusChannelId: string,
     *  messageId: string,
     *  statusId: string,
     *  panelId: string,
     *  notifiers: string[],
     *  keyName?: string | null,
     *  keyReactors: string[],
     *  notified: boolean
     * }} HeadcountData
     */
    /** @type {Headcount[]} */
    static active = []

    static async save() {
        const serialized = []
        for (const hc of this.active) {
            const data = {
                templateName: hc.templateName,
                memberId: hc.member.id,
                guildId: hc.member.guild.id,
                time: hc.#time.getTime(),
                commandChannelId: hc.message.channel.id,
                statusChannelId: hc.statusMessage.channel.id,
                messageId: hc.message.id,
                statusId: hc.statusMessage.id,
                panelId: hc.panelMessage.id,
                notifiers: hc.#keyNotifiers,
                keyName: hc.#key?.name,
                keyReactors: hc.#keyReactors,
                notified: hc.#performedNotify
            }

            serialized.push(data)
        }

        await fs.writeFile('./data/headcounts.json', JSON.stringify(serialized, null, 4))
    }

    /**
     * @param {Discord.Client} bot
     */
    static async load(bot) {
        Headcount.active = await fs.readFile('./data/headcounts.json')
            .catch(() => '[]')
            .then(data => JSON.parse(data.toString()))
            .then(data => Promise.all(data.map(hc => Headcount.from(bot, hc))))
            .then(hcs => hcs.filter(hc => hc))

        console.log(`Restored ${Headcount.active.length} headcounts`)
    }

    /** @type {import('./afkTemplate.js').AfkTemplate} */
    template

    /** @type {string} */
    templateName

    /** @type {Discord.GuildMember} */
    member

    /** @type {import('../data/guildSettings.708026927721480254.cache.json')} */
    settings

    /** @type {Discord.Client} */
    bot

    /** @type {Discord.Message} */
    message

    /** @type {Discord.Message} */
    statusMessage

    /** @type {Discord.Message} */
    panelMessage

    /** @type {NodeJS.Timeout} */
    #interval

    /** @type {string[]} */
    #keyNotifiers = []

    /** @type {boolean} */
    #performedNotify = false

    /** @type {TemplateEmoji?} */
    #key

    /** @type {string[]} */
    #keyReactors = []

    /** @type {Date?} */
    #time

    /**
     * @param {Discord.Client} bot
     * @param {HeadcountData} hc
     * @returns {Promise<Headcount>}
     */
    static async from(bot, hc) {
        const headcount = new Headcount()
        const guild = bot.guilds.cache.get(hc.guildId)
        const commandChannel = guild.channels.cache.get(hc.commandChannelId)
        const statusChannel = guild.channels.cache.get(hc.statusChannelId)
        headcount.templateName = hc.templateName
        headcount.member = guild.members.cache.get(hc.memberId)
        headcount.message = await commandChannel.messages.fetch(hc.messageId)
        headcount.statusMessage = await statusChannel.messages.fetch(hc.statusId)
        headcount.panelMessage = await commandChannel.messages.fetch(hc.panelId)
        headcount.#keyNotifiers = hc.notifiers
        headcount.template = await AfkTemplate.AfkTemplate.tryCreate(bot, bot.settings[guild.id], headcount.message, hc.templateName)
        headcount.#key = headcount.template.buttons[hc.keyName]
        headcount.#time = new Date(hc.time)
        headcount.settings = bot.settings[guild.id]
        headcount.#keyReactors = [...hc.keyReactors]
        headcount.bot = bot
        headcount.#performedNotify = hc.notified
        await headcount.statusMessage.reactions.cache.get(headcount.#key?.emote.id)?.users.fetch().then(users => users.forEach(user => {
            if (!user.bot && !headcount.#keyReactors.includes(user.id)) headcount.#keyReactors.push(user.id)
        }))
        if (headcount.#keyReactors.length != hc.keyReactors.length) await Headcount.save()
        if (headcount.#keyNotifiers.length && headcount.#keyReactors.length && !headcount.#performedNotify) {
            headcount.#performedNotify = true
            this.panelMessage.reply(`${headcount.#keyNotifiers.map(n => `<@${n}>`).join(' ')} Someone reacted to key for your \`${this.template.name}\` headcount!`)
        }
        headcount.#startUpdateInterval()
        headcount.#startPanelCollector()
        if (headcount.#key) headcount.#startKeyCollector()
        if (headcount.#time.getTime() <= Date.now()) return headcount.#end(null)
        await headcount.panelMessage.edit(headcount.#panelData)
        await headcount.statusMessage.edit({ embeds: [headcount.#statusEmbed] })
        return headcount
    }

    /**
     * @param {AfkTemplate} template
     * @param {Discord.Message} message
     * @param {Discord.GuildMember} member
     * @param {Discord.Client} bot
     * @param {Date} time
     */
    constructor(message, member, bot, templateName, template, time) {
        if (!message) return

        this.templateName = templateName
        this.template = template
        this.member = member
        this.message = message
        this.settings = bot.settings[message.guild.id]
        this.#time = time
        this.bot = bot
        for (const name in this.template.buttons) {
            if (name.toLowerCase() == 'key') {
                this.#key = this.template.buttons[name]
                break
            }
        }

        this.#init()
    }

    async #init() {
        this.statusMessage = await this.template.raidStatusChannel.send({ embeds: [this.#statusEmbed] })

        for (const i in this.template.reacts) {
            if (!Object.hasOwn(this.template.reacts, i)) continue
            const react = this.template.reacts[i]
            // eslint-disable-next-line no-await-in-loop
            if (react.onHeadcount && react.emote) await this.statusMessage.react(react.emote.id)
        }

        for (const i in this.template.buttons) {
            if (!Object.hasOwn(this.template.buttons, i)) continue
            const button = this.template.buttons[i]
            switch (button.type) {
                case AfkTemplate.TemplateButtonType.NORMAL:
                case AfkTemplate.TemplateButtonType.LOG:
                case AfkTemplate.TemplateButtonType.LOG_SINGLE:
                    // eslint-disable-next-line no-await-in-loop
                    if (button.emote && this.bot.storedEmojis[button.emote]) await this.statusMessage.react(this.bot.storedEmojis[button.emote]?.id)
                    break
                default:
            }
        }
        this.panelMessage = await this.message.channel.send(this.#panelData)

        await Headcount.save()

        if (this.#key) this.#startKeyCollector()

        this.#startUpdateInterval()

        this.#startPanelCollector()
    }

    #startUpdateInterval() {
        this.#interval = setInterval(() => {
            if (Date.now() - this.#time.getTime() >= 0) return this.#end(null)
            this.panelMessage.edit(this.#panelData)
            this.statusMessage.edit({ embeds: [this.#statusEmbed] })
        }, 5000)
        this.#interval.unref()
    }

    #startPanelCollector() {
        this.panelMessage.componentCollector = this.panelMessage.createMessageComponentCollector({
            filter: interaction => interaction.member.id == this.member.id || interaction.member.roles.highest.position >= interaction.guild.roles.cache.get(this.settings.roles.headrl)?.position,
            time: this.#time.getTime() - Date.now()
        })

        this.panelMessage.componentCollector.on('collect', interaction => this.#processPanelInteraction(interaction))
    }

    #startKeyCollector() {
        this.statusMessage.reactionCollector = this.statusMessage.createReactionCollector({
            filter: (reaction, user) => !user.bot && reaction.emoji.name == this.#key.emote,
            time: this.#time.getTime() - Date.now()
        })

        this.statusMessage.reactionCollector.on('collect', (react, user) => {
            if (!this.#keyReactors.includes(user.id)) {
                this.#keyReactors.push(user.id)
                Headcount.save()
                this.panelMessage.edit(this.#panelData)
            }
            if (!this.#keyNotifiers.length) return
            if (this.#performedNotify) return
            this.#performedNotify = true
            this.panelMessage.reply(`${this.#keyNotifiers.map(n => `<@${n}>`).join(' ')} Someone reacted to key for your \`${this.template.name}\` headcount!`)
        })
    }

    /**
     * @param {Discord.ButtonInteraction} interaction
     */
    async #processPanelInteraction(interaction) {
        switch (interaction.customId) {
            case 'convert':
                await this.#end(interaction.member, true)
                await this.#processConvert(interaction)
                break
            case 'toggle-notify': this.#toggleNotify(interaction); break
            case 'abort': await this.#end(interaction.member, false); break
            default:
        }
    }

    get #panelData() {
        const time = (this.#time.getTime() - Date.now()) / 1000

        const components = new Discord.ActionRowBuilder()

        components.addComponents(new Discord.ButtonBuilder().setCustomId('convert').setLabel('Convert to Afk').setStyle(Discord.ButtonStyle.Success))
        if (this.#key) components.addComponents(new Discord.ButtonBuilder().setCustomId('toggle-notify').setLabel('Toggle Key Notification').setStyle(Discord.ButtonStyle.Primary))
        components.addComponents(new Discord.ButtonBuilder().setCustomId('abort').setLabel('Abort').setStyle(Discord.ButtonStyle.Danger))

        const embed = new Discord.EmbedBuilder()
            .setAuthor({ name: this.member.displayName, iconURL: this.member.displayAvatarURL() })
            .setTitle(`${this.template.name} Headcount Panel`)
            .setColor(this.template.body[1].embed.color || 'White')
            .setDescription(`[Headcount Status Message](${this.statusMessage.url})`)
            .setFooter({ text: `${this.message.guild.name} • ${Math.floor(time / 60)} Minutes and ${Math.floor(time % 60)} Seconds Remaining` })
            .setTimestamp(this.#time)

        const thumbnail = this.template.getRandomThumbnail()
        if (thumbnail) embed.setThumbnail(thumbnail)

        let idx = 0
        const fields = [{ name: 'Reacts', value: '', inline: true }, { name: '\u200B', value: '', inline: true }, { name: '\u200B', value: '', inline: true }]
        for (const react of this.statusMessage.reactions.cache.values()) {
            fields[idx++ % 3].value += `${react.emoji} \`${String(react.count - 1).padStart(2, '0')}\`\n`
        }
        embed.addFields(...fields)
        if (this.#keyReactors.length) embed.addFields({ name: 'Reacted to Key', value: this.#keyReactors.map(r => `<@${r}>`).join('\n') })
        return { embeds: [embed], components: [components] }
    }

    get #statusEmbed() {
        const time = (this.#time.getTime() - Date.now()) / 1000
        const embed = new Discord.EmbedBuilder()
            .setAuthor({ name: `Headcount for ${this.template.name} by ${this.member.displayName}`, iconURL: this.member.displayAvatarURL() })
            .setDescription(this.template.processBodyHeadcount(null))
            .setTimestamp(this.#time)
            .setColor(this.template.body[1].embed.color || 'White')
            .setImage(this.settings.strings[this.template.body[1].embed.image] || this.template.body[1].embed.image)
            .setFooter({ text: `${this.message.guild.name} • ${Math.floor(time / 60)} Minutes and ${Math.floor(time % 60)} Seconds Remaining` })
            .setTimestamp(this.#time)
        const thumbnail = this.template.getRandomThumbnail()
        if (thumbnail) embed.setThumbnail(thumbnail)
        return embed
    }

    /**
     * @param {Discord.ButtonInteraction} interaction
     */
    #toggleNotify(interaction) {
        const idx = this.#keyNotifiers.indexOf(interaction.member.id)
        if (idx >= 0) this.#keyNotifiers.splice(idx, 1)
        else this.#keyNotifiers.push(interaction.member.id)
        Headcount.save()
        interaction.reply({ content: `You will ${idx >= 0 ? 'no longer' : 'now'} be pinged when keys react`, ephemeral: true })
    }

    /**
     * @param {Discord.GuildMember?} by
     * @param {boolean} aborted
     */
    async #end(by, convert) {
        clearInterval(this.#interval)
        this.statusMessage.reactionCollector?.stop()
        this.panelMessage.componentCollector?.stop()

        const idx = Headcount.active.indexOf(this)
        if (idx >= 0) Headcount.active.splice(idx, 1)
        await Headcount.save()

        const footerText = convert ? `Converting to AFK by ${by.displayName}` : by ? `Aborted by ${by.displayName}` : 'Headcount timed out'

        const embed = this.#statusEmbed
        embed.setDescription(footerText)
            .setFooter({ text: footerText, iconURL: by?.displayAvatarURL() })
            .setTimestamp(new Date())

        const panelEmbeds = this.#panelData.embeds
        panelEmbeds[0].setFooter({ text: footerText, iconURL: by?.displayAvatarURL() })
            .setTimestamp(new Date())

        await this.statusMessage.edit({ embeds: [embed] })
        await this.panelMessage.edit({ embeds: panelEmbeds, components: [] })
    }

    /**
     * @param {Discord.ButtonInteraction} interaction
     */
    async #processConvert(interaction) {
        const locationInput = new Discord.TextInputBuilder()
            .setCustomId('locationText')
            .setLabel('What location do you want to use?')
            .setStyle(Discord.TextInputStyle.Short)
            .setMinLength(0)
            .setMaxLength(512)
            .setPlaceholder('Location of run...')

        const locationModal = new Discord.ModalBuilder()
            .setCustomId('locationModal')
            .setTitle('Location for AFK')
            .addComponents(new Discord.ActionRowBuilder().addComponents(locationInput))

        await interaction.showModal(locationModal)
        const location = await interaction.awaitModalSubmit({
            time: 30_000,
            filter: modal => modal.user.id === interaction.user.id
        }).then(submission => {
            submission.deferUpdate()
            return submission.fields.getTextInputValue('locationText')
        }).catch(() => 'No location given')

        await afkCheck.convertHeadcount(this, location)
        const embed = Discord.EmbedBuilder.from(this.statusMessage.embeds[0])
        embed.setFooter({ text: `Converted to AFK by ${interaction.member.displayName}`, iconURL: interaction.member.displayAvatarURL() })
            .setDescription(`Headcount converted to AFK by ${interaction.member}`)
        this.statusMessage.edit({ embeds: [embed] })
    }
}

/**
 * @param {Discord.Message} message
 * @param {import('./afkTemplate.js').AfkTemplate} afkTemplate
 */
async function confirmNewHeadcount(message, afkTemplate) {
    const activeHcs = Headcount.active.filter(hc => hc.template.raidStatusChannel.id == afkTemplate.raidStatusChannel.id)
    const activeAfks = Object.values(message.client.afkModules).filter(mod => mod.active && mod.raidStatusMessage?.channel.id == afkTemplate.raidStatusChannel.id)
    if (!activeHcs.length && !activeAfks.length) return true

    const items = [
        ...activeHcs.map(headcount => `\`${headcount.template.name}\` HC by \`${headcount.member.displayName}\` => ${headcount.statusMessage.url}`),
        ...activeAfks.map(afk => `\`${afk.templateName}\` AFK by ${afk.leader} => ${afk.raidCommandsMessage.url}`)
    ]

    const embed = new Discord.EmbedBuilder()
        .setAuthor({ name: message.member.displayName, iconURL: message.member.displayAvatarURL() })
        .setTitle('Confirm Send Headcount')
        .setDescription('The following headcounts are still active, are you sure you want to put one up before they end?\n\n'
            + items.join('\n'))

    const confirmationMessage = await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } })
    const result = await confirmationMessage.confirmButton(message.author.id).catch(() => false)

    confirmationMessage.delete()
    return result
}

module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    requiredArgs: 1,
    args: '<run type> (time) (time type s/m)',
    role: 'eventrl',
    /**
     * @param {Discord.Message} message
     */
    async execute(message, args, bot) {
        // settings
        const botSettings = bot.settings[message.guild.id]
        const alias = args.shift().toLowerCase()
        const afkTemplateNames = await AfkTemplate.resolveTemplateAlias(botSettings, message.member, message.guild.id, message.channel.id, alias)
        if (afkTemplateNames.length == 0) return await message.channel.send('This afk template does not exist.')
        const afkTemplateName = afkTemplateNames.length == 1 ? afkTemplateNames[0] : await AfkTemplate.templateNamePrompt(message, afkTemplateNames)

        const afkTemplate = await AfkTemplate.AfkTemplate.tryCreate(bot, bot.settings[message.guild.id], message, afkTemplateName)
        if (afkTemplate instanceof AfkTemplate.AfkTemplateValidationError) {
            await message.channel.send(afkTemplate.message())
            return
        }

        if (await confirmNewHeadcount(message, afkTemplate)) Headcount.active.push(new Headcount(message, message.member, bot, afkTemplateName, afkTemplate, new Date(Date.now() + parseTime(args))))
    },
    Headcount
}

/**
 * @param {string[]} args
 * @returns
 */
function parseTime(args) {
    if (args.length < 2) return 900_000
    const major = parseInt(args.shift())
    if (isNaN(major)) return 900_000
    switch (args.shift()[0].toLowerCase()) {
        case 's': return Math.max(30, major) * 1000
        case 'm': default: return Math.min(major, 60) * 60 * 1000
    }
}
