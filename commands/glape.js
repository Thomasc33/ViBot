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
        this.settings = this.bot.settings[this.guild.id]

        this.timeoutMinutes = 5
        this.isGoldenGlapeClicked = false // If the golden glape has already been clicked or not

        this.embedColor = "#ac714e"
        this.goldenEmbedGlapeColor = "#e1b641"
        this.glapeEmoji = this.bot.storedEmojis.glapeEmoji
        this.goldenGlapeEmoji = this.bot.storedEmojis.goldenGlapeEmoji
        this.glapers = {}
        this.goldenGlaper = null
    }

    sortedGlapers() {
        if (Object.keys(this.glapers).length == 0) { return "JOIN THE GLAPERS" }
        const sortedGlapers = this.sortObject(this.glapers)
        const glapeStrings = []
        for (let i in sortedGlapers) {
            let glaper = sortedGlapers[i]
            let temporaryString = `\`${glaper.toString().padStart(4, ' ')}\` ${this.glapeEmoji.text} <@!${i}>`
            if (i == this.goldenGlaper) { temporaryString += ` ${this.goldenGlapeEmoji.text}` }
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
        await this.glapeButton()
        await this.glapeSender()
    }

    async glapeEmbed() {
        this.embed = new Discord.EmbedBuilder()
            .setTitle('Glape Clicker!')
            .setDescription(`You have until <t:${moment().add(this.timeoutMinutes, 'minute').unix()}:R> to collect as many ${this.glapeEmoji.text} as possible!`)
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

    async updateGlapeField() {
        this.embed.setFields({
            name: `${this.glapeEmoji.text} ${Object.keys(this.glapers).length} Glapers ${this.glapeEmoji.text}`,
            value: this.sortedGlapers(),
            inline: false
        })
        if (this.goldenGlaper) {
            this.embed.addFields({
                name: `${this.goldenGlapeEmoji.text} Golden Glaper ${this.goldenGlapeEmoji.text}`,
                value: `<@!${this.goldenGlaper}>`,
                inline: false
            })
        }
        this.embed.setFooter({ text: `Total Glapes ${this.totalGlapes()}, Glapes per second ${this.glapesPerSecond()}` })
        await this.glapeMessage.edit({ embeds: [this.embed] })
    }

    async glapeButton() {
        this.button = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setEmoji(this.glapeEmoji.id)
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(this.glapeEmoji.id)
        ])
    }

    async goldenGlapeButton() {
        this.goldenButton = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setEmoji(this.goldenGlapeEmoji.id)
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(this.goldenGlapeEmoji.id)
        ])
    }

    async goldenGlapeEmbed() {
        this.goldenEmbed = new Discord.EmbedBuilder()
            .setTitle('GOLDEN GLAPE')
            .setDescription(`Click on the ${this.goldenGlapeEmoji.text} to recieve many glapes`)
            .setColor(this.goldenEmbedGlapeColor)
    }

    async glapeSender() {
        this.glapeMessage = await this.channel.send({
            embeds: [this.embed],
            components: [this.button]
        })
        this.glapeListener = new Discord.InteractionCollector(this.bot, { message: this.glapeMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.glapeListener.on('collect', async interaction => await this.glapeInteractionHandler(interaction))
        this.momentStarted = moment().unix()
        const glapeEmbedUpdaterInterval = setInterval(this.updateGlapeField.bind(this), 2000)
        setTimeout(this.goldenGlapeSender.bind(this), Math.floor(this.timeoutMinutes * 60 * 1000 / 2))
        setTimeout(async () => {
            this.glapeListener.stop()
            this.embed.data.description = 'Thank you to all the Glapers!'
            this.glapeMessage.edit({ embeds: [this.embed], components: [] })
            await this.updateGlapeField()
            clearInterval(glapeEmbedUpdaterInterval)
        }, this.timeoutMinutes * 60 * 1000)
    }

    async goldenGlapeSender() {
        await this.goldenGlapeEmbed()
        await this.goldenGlapeButton()
        this.goldenGlapeMessage = await this.channel.send({
            embeds: [this.goldenEmbed],
            components: [this.goldenButton]
        })
        this.goldenGlapeListener = new Discord.InteractionCollector(this.bot, { message: this.goldenGlapeMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.goldenGlapeListener.on('collect', async interaction => await this.goldenGlapeInteractionHandler(interaction))
    }

    async glapeInteractionHandler(interaction) {
        if (!interaction.isButton()) { return }
        if (!interaction.customId == this.glapeEmoji.id) { return interaction.deferUpdate() }
        // Only valid button clicks, and glape clicks should pass through.

        if (!this.glapers.hasOwnProperty(interaction.member.id)) { this.glapers[interaction.member.id] = 0 }
        this.glapers[interaction.member.id] += 1
        interaction.deferUpdate()
    }

    async goldenGlapeInteractionHandler(interaction) {
        if (!interaction.isButton()) { return }
        if (!interaction.customId == this.goldenGlapeEmoji.id) { return interaction.deferUpdate() }
        if (this.isGoldenGlapeClicked) { return interaction.deferUpdate() }
        this.isGoldenGlapeClicked = true
        this.goldenGlaper = interaction.member.id
        // Only valid button clicks, and golden glape clicks should pass through.

        if (!this.glapers.hasOwnProperty(interaction.member.id)) { this.glapers[interaction.member.id] = 0 }
        this.glapers[interaction.member.id] += 25
        this.goldenGlapeListener.stop()
        interaction.message.edit({ components: [] })
        interaction.reply({ content: `Woo you got the golden glape! ${this.goldenGlapeEmoji.text}`, ephemeral: true })
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
        return Math.floor(totalGlapes / (moment().unix() - this.momentStarted))
    }
} 