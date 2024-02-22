const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')

module.exports = {
    name: "glape",
    role: "moderator",
    guildSpecific: true,
    description: "If you know, you know.\nIf not, try me :)\nIf you don't know, the bot purges the entire server",
    async execute(message, args, bot, db) {
        const glapeModule = new Glape(message, bot)
        await glapeModule.startProcess()
    }
}

class Glape {
    constructor(message, bot) {
        this.message = message
        this.guild = message.guild
        this.channel = this.message.channel

        this.bot = bot

        this.timeoutMinutes = 5
        this.isGlapeInfected = false
        this.pendingUpdate = false // true or false if an update is in-progress
        this.queuedUpdate = null // null if there are no queued updates, true if there is an update but no interaction, and an Interaction if there is an interaction related update
        this.infectedGlapeBoss = {
            alive: false,
            health: 0,
            maxHealth: 0
        }

        this.discordTimestamp = `<t:${moment().add(this.timeoutMinutes, 'minute').unix()}:R>`
        this.embedColor = "#ac714e"
        this.goldenEmbedGlapeColor = "#e1b641"
        this.infectedEmbedGlapeColor = "#EE1111"
        this.glapeEmoji = this.bot.storedEmojis.glapeEmoji
        this.goldenGlapeEmoji = this.bot.storedEmojis.goldenGlapeEmoji
        this.infectedGlapeEmoji = this.bot.storedEmojis.infectedGlapeEmoji
        this.blackGlapeEmoji = this.bot.storedEmojis.blackGlapeEmoji

        // This is in % so 1 is 1% 0.5 is 0.5%
        this.goldenGlapeChance = 0.5
        this.infectedGlapeChance = 0.1

        // Amount of Glapes you get for clicking the glape
        this.glapeReward = 1
        this.goldenGlapeReward = 25
        this.infectedGlapeReward = -1

        this.glapers = {}
        this.specialGlapers = {}
    }

    sortedGlapers() {
        if (Object.keys(this.glapers).length == 0) { return "JOIN THE GLAPERS" }
        const sortedGlapers = this.sortObject(this.glapers)
        const glapeStrings = []
        for (let i in sortedGlapers) {
            let glaper = sortedGlapers[i]
            let temporaryString = `\`${glaper.toString().padStart(4, ' ')}\` ${this.isGlapeInfected ? this.infectedGlapeEmoji.text : this.glapeEmoji.text} <@!${i}>`
            if (this.specialGlapers.hasOwnProperty(i)) {
                if (!this.isGlapeInfected) {
                    temporaryString += ` ${this.specialGlapers[i].join(' ')}`
                } else {
                    temporaryString += ` ${this.specialGlapers[i].map(glape => `${this.infectedGlapeEmoji.text}`).join(' ')}`
                }
            }
            if (temporaryString.length + glapeStrings.join('\n').length >= 1024) { break }
            glapeStrings.push(temporaryString)
        }
        return glapeStrings.join('\n')
    }

    sortObject(object) {
        return Object.fromEntries(Object.entries(object).sort(
            (a, b) => b[1] - a[1]
        ));
    }

    async startProcess() {
        await this.glapeEmbed()
        this.glapeButton()
        await this.glapeSender()
    }

    async glapeEmbed() {
        this.embed = new Discord.EmbedBuilder()
            .setTitle('Glape Clicker!')
            .setDescription(`You have until ${this.discordTimestamp} to collect as many ${this.glapeEmoji.text} as possible!`)
            .setColor(this.embedColor)
        await this.addGlapeField()
    }

    async addGlapeField() {
        this.embed.addFields({
            name: `${this.glapeEmoji.text} Glapers ${this.glapeEmoji.text}`,
            value: `JOIN THE GLAPERS`,
            inline: false
        })
    }

    glapeBossHealthString() {
        let prettyString = ``
        let health = this.infectedGlapeBoss.health
        let maxHealth = this.infectedGlapeBoss.maxHealth

        let kFactor = 15
        let progress = 1 - (health / maxHealth)
        let filled = Math.floor(progress * kFactor)
        let empty = kFactor - filled

        if (filled < 0) { filled = 0}
        if (empty < 0) { empty = kFactor }

        prettyString += `\`${maxHealth.toString().padStart(4, ' ')}\` `
        prettyString += `${`${this.infectedGlapeEmoji.text}`.repeat(empty)}`
        prettyString += `${`${this.blackGlapeEmoji.text}`.repeat(filled)}`
        prettyString += ` \`${health.toString().padStart(4, ' ')}\``

        return prettyString
    }

    async updateGlapeField(interaction = null) {
        if (!this.isGlapeInfected) {
            this.embed = new Discord.EmbedBuilder()
                .setTitle('Glape Clicker!')
                .setDescription(`You have until ${this.discordTimestamp} to collect as many ${this.glapeEmoji.text} as possible!`)
                .setColor(this.embedColor)
            this.embed.setFields({
                name: `${this.glapeEmoji.text} ${Object.keys(this.glapers).length} Glapers ${this.glapeEmoji.text}`,
                value: this.sortedGlapers(),
                inline: false
            })
            if (Object.keys(this.specialGlapers).length > 0) {
                this.embed.addFields({
                    name: `${this.goldenGlapeEmoji.text} Special Glaper ${this.goldenGlapeEmoji.text}`,
                    value: Object.keys(this.specialGlapers).map(glaper => `<@!${glaper}> ${this.specialGlapers[glaper].join(' ')}`).join('\n'),
                    inline: false
                })
            }
        } else {
            this.embed = new Discord.EmbedBuilder()
                .setTitle('Infected Glape...')
                .setDescription(`You have until ${this.discordTimestamp} to get rid of as many ${this.infectedGlapeEmoji.text} as possible...`)
                .setColor(this.infectedEmbedGlapeColor)
            this.embed.setFields({
                name: `${this.infectedGlapeEmoji.text} ${Object.keys(this.glapers).length} Anti-Glapers ${this.infectedGlapeEmoji.text}`,
                value: this.glapeBossHealthString(),
                inline: false
            })
        }
        this.embed.setFooter({ text: `Total Glapes ${this.totalGlapes()}, Glapes per second ${this.glapesPerSecond()}` })

        if (!this.pendingUpdate) {
            // If there are no updates pending, then immediately try to update the embed
            // Use `update` if it's an embed, otherwise use `edit`
            // Set the `pendingUpdate` flag to indicate that any new updates should be queued to avoid update races
            this.pendingUpdate = true
            const editPromise = interaction ? interaction.update({ embeds: [this.embed] }) : this.glapeMessage.edit({ embeds: [this.embed] })
            editPromise.then(async () => {
                // Once the edit is completed, unset the `pendingUpdate` flag 
                this.pendingUpdate = false
                // If there were updates queued, run the most recent one
                if (this.queuedUpdate) {
                    const queuedInteraction = this.queuedUpdate === true ? null : this.queuedUpdate
                    this.queuedUpdate = null
                    await this.updateGlapeField(queuedInteraction)
                }
            })
        } else {
            // There is already an update in-progress, add this update to the queue
            // If there's a non-interaction queued, prioritize this
            if (this.queuedUpdate === null || this.queuedUpdate === true) {
                this.queuedUpdate = interaction || true
            } else if (interaction) {
                // When we delete an update from the queue we need to respond to it
                this.queuedUpdate.deferUpdate()
                this.queuedUpdate = interaction
            }
            // If `queuedUpdate` is an interaction and `interaction` is null no changes are needed
            // That is why this if statement is not exhaustive
        }
    }

    glapeButton() {
        this.button = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setEmoji(this.glapeEmoji.id)
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(this.glapeEmoji.id)
        ])
    }

    infectedGlapeButton() {
        return new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setEmoji(this.infectedGlapeEmoji.id)
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(this.infectedGlapeEmoji.id)
        ])
    }

    goldenGlapeButton() {
        return new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setEmoji(this.goldenGlapeEmoji.id)
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(this.goldenGlapeEmoji.id)
        ])
    }

    goldenGlapeEmbed() {
        return new Discord.EmbedBuilder()
            .setTitle('GOLDEN GLAPE')
            .setDescription(`Click on the ${this.goldenGlapeEmoji.text} to recieve many glapes`)
            .setColor(this.goldenEmbedGlapeColor)
    }

    calculateGlapeBossHealth() {
        return Math.round(Math.random() * this.totalGlapes() / 2)
    }

    async infectGlape() {
        this.infectedGlapeBoss.maxHealth = this.calculateGlapeBossHealth()
        this.infectedGlapeBoss.health = this.infectedGlapeBoss.maxHealth
        this.infectedGlapeBoss.alive = true
        this.isGlapeInfected = true
        await this.updateGlapeField()
        await this.glapeMessage.edit({ components: [
            this.infectedGlapeButton()
        ]})
    }

    async disinfectGlape() {
        this.infectedGlapeBoss.maxHealth = 0
        this.infectedGlapeBoss.health = 0
        this.infectedGlapeBoss.alive = false
        this.isGlapeInfected = false
        await this.glapeMessage.edit({
            components: [this.button]
        })
        await this.updateGlapeField()
    }

    async glapeChances() {
        if (Math.round(Math.random() * 100) < this.goldenGlapeChance) {
            await this.goldenGlapeSender()
        }
        if (Math.round(Math.random() * 100) < this.infectedGlapeChance && !this.isGlapeInfected) {
            await this.infectGlape()
        }
    }

    async glapeSender() {
        this.glapeMessage = await this.channel.send({
            embeds: [this.embed],
            components: [this.button]
        })
        this.glapeListener = new Discord.InteractionCollector(this.bot, { message: this.glapeMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.glapeListener.on('collect', async interaction => await this.glapeInteractionHandler(interaction))
        this.momentStarted = moment().unix()
        const glapeEmbedUpdaterInterval = setInterval(this.updateGlapeField.bind(this), 2500)
        const glapeChancesInterval = setInterval(this.glapeChances.bind(this), 2500)
        setTimeout(this.goldenGlapeSender.bind(this), Math.floor(this.timeoutMinutes * 60 * 1000 / 6))
        setTimeout(this.goldenGlapeSender.bind(this), Math.floor(this.timeoutMinutes * 60 * 1000 / 3.5))
        setTimeout(this.goldenGlapeSender.bind(this), Math.floor(this.timeoutMinutes * 60 * 1000 / 1.5))
        setTimeout(this.infectGlape.bind(this), Math.floor((this.timeoutMinutes * 60 * 1000) * 0.35))
        setTimeout(async () => {
            clearInterval(glapeChancesInterval)
            clearInterval(glapeEmbedUpdaterInterval)

            this.glapeListener.stop()
            if (!this.isGlapeInfected) {
                await this.updateGlapeField()
                this.embed.data.description = 'Thank you to all the Glapers!'
            } else {
                await this.updateGlapeField()
                this.embed.data.description = '.....You have lost, you were unable to beat the Glape Infection, it has consumed you!'
            }
            this.glapeMessage.edit({ embeds: [this.embed], components: [] })
        }, this.timeoutMinutes * 60 * 1000)
    }

    async goldenGlapeSender() {
        this.goldenEmbed = this.goldenGlapeEmbed()
        this.goldenButton = this.goldenGlapeButton()
        this.goldenGlapeMessage = await this.channel.send({
            embeds: [this.goldenEmbed],
            components: [this.goldenButton]
        })
        let goldenGlapeListener = new Discord.InteractionCollector(this.bot, { message: this.goldenGlapeMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        goldenGlapeListener.on('collect', async interaction => await this.goldenGlapeInteractionHandler(interaction, goldenGlapeListener, false))
    }

    async glapeInteractionHandler(interaction) {
        if (!interaction.isButton()) { return }
        if (![this.glapeEmoji.id, this.infectedGlapeEmoji.id].includes(interaction.customId)) { return interaction.deferUpdate() }
        // Only valid button clicks, and glape clicks should pass through.

        if (!this.glapers.hasOwnProperty(interaction.member.id)) { this.glapers[interaction.member.id] = 0 }
        this.glapers[interaction.member.id] += this.glapeReward
        if (this.isGlapeInfected) {
            this.infectedGlapeBoss.health -= this.glapeReward
            if (this.infectedGlapeBoss.health <= 0) {
                await this.disinfectGlape()
            }
        }
        this.updateGlapeField(interaction)
    }

    async goldenGlapeInteractionHandler(interaction, listener) {
        if (!interaction.isButton()) { return }
        if (!interaction.customId == this.goldenGlapeEmoji.id) { return interaction.deferUpdate() }
        if (this.specialGlapers.hasOwnProperty(interaction.member.id)) {
            this.specialGlapers[interaction.member.id].push(this.goldenGlapeEmoji.text)
        } else {
            this.specialGlapers[interaction.member.id] = [this.goldenGlapeEmoji.text]
        }

        if (!this.glapers.hasOwnProperty(interaction.member.id)) { this.glapers[interaction.member.id] = 0 }
        this.glapers[interaction.member.id] += this.goldenGlapeReward
        listener.stop()
        await interaction.deferUpdate().then((m) => m.delete())
        if (this.isGlapeInfected) {
            this.infectedGlapeBoss.health -= this.goldenGlapeReward
        }
        if (this.infectedGlapeBoss.health <= 0) {
            await this.disinfectGlape()
        }
    }

    totalGlapes() {
        let totalPoints = 0
        for (let i in this.glapers) {
            totalPoints += this.glapers[i]
        }
        return totalPoints
    }

    glapesPerSecond() {
        let totalGlapes = this.totalGlapes()
        return this.roundTo(totalGlapes / (moment().unix() - this.momentStarted), 2)
    }

    roundTo(n, digits) {
        var negative = false;
        if (digits === undefined) {
            digits = 0;
        }
        if (n < 0) {
            negative = true;
            n = n * -1;
        }
        var multiplicator = Math.pow(10, digits);
        n = parseFloat((n * multiplicator).toFixed(11));
        n = (Math.round(n) / multiplicator).toFixed(digits);
        if (negative) {
            n = (n * -1).toFixed(digits);
        }
        return n;
    }
} 
