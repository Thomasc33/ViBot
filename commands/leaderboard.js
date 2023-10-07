const Discord = require('discord.js')
const leaderBoardTypes = require('../data/leaderBoardInfo.json')

module.exports = {
    name: 'leaderboard',
    description: 'Displays leaderboards for different stats on the server',
    alias: ['lb'],
    dms: true,
    dmNeedsGuild: true,
    role: 'raider',
    async execute(message, args, bot, db) {
        const leaderboardModule = new Leaderboard(message, args, bot, db, message.guild)
        await leaderboardModule.startProcess()
    },
    async dmExecution(message, args, bot, db, guild) {
        const leaderboardModule = new Leaderboard(message, args, bot, db, guild)
        await leaderboardModule.startProcess()
    }
}

class Leaderboard {
    /**
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     */

    constructor(message, args, bot, db, guild) {
        this.message = message
        this.guild = guild
        this.member = this.message.member
        this.channel = this.message.channel

        this.args = args
        this.bot = bot
        this.settings = this.bot.settings[this.guild.id]

        this.leaderboardLimit = this.settings.numerical.leaderboardLimit
        if (!this.leaderboardLimit) { this.leaderboardLimit = 25 } // Defaults leaderboard limit to the standard 25

        // What these Lerp v values define (might be a bit confusing, I don't really know what to call them)
        // Is if the user is not in the top 25 or so, then it adds a second embed which shows your ranking, and then LerpAbove people who are above
        // And LerpBelow who are below.
        // Lerp because if you're rank 27, we don't need it to show 1-25, then 20-30 again inside of the second embed showing your ranking
        this.leaderboardLerpAbove = 5
        this.leaderboardLerpBelow = 4

        this.db = db
        this.embedColor = '#7289da'

        this.leaderboardJson = leaderBoardTypes
        this.guildHasValidTemplate = true
        if (!Object.hasOwn(this.leaderboardJson, this.guild.id)) this.guildHasValidTemplate = false
        this.leaderboardTemplates = this.leaderboardJson[this.guild.id]
        if (typeof this.leaderboardTemplates != Array && Object.hasOwn(this.leaderboardTemplates, '__REDIRECT')) { this.leaderboardTemplates = this.leaderboardJson[this.leaderboardJson[this.guild.id].__REDIRECT] }
    }

    async startProcess() {
        if (!this.guildHasValidTemplate) { return this.stopProcess() }
        const didCategoryStop = await this.embedGetCategory()
        if (didCategoryStop) { return }
        const didTemplateStop = await this.embedGetCategoryTemplate()
        if (didTemplateStop) { return }
        await this.updateEmbed()
    }

    async stopProcess() {
        await this.leaderboardMessage.delete()
        await this.message.react('✅')
        return true
    }

    async embedGetGuild() {}
    async embedGetCategory() {
        this.embed = new Discord.EmbedBuilder()
            .setAuthor({ url: this.member.avatarURL(), name: 'Choose category' })
            .setDescription(`${this.leaderboardTemplates.map(category => `${this.bot.storedEmojis[category.emoji].text} **${category.prettyName}**`).join('\n')}`)
            .setColor(this.embedColor)
        this.leaderboardMessage = await this.message.reply({ embeds: [this.embed] })
        this.categoryPick = await this.leaderboardMessage.confirmListEmojis(
            this.leaderboardTemplates.map(category => this.bot.storedEmojis[category.emoji].id),
            this.member.id
        )
        if (!this.categoryPick || this.categoryPick == 'Cancelled') { return this.stopProcess() }
    }

    async embedGetCategoryTemplate() {
        for (const category of this.leaderboardTemplates) {
            if (this.categoryPick == this.bot.storedEmojis[category.emoji].id) {
                this.embedColor = category.embedColor
                this.leaderboardTemplates = category.templates
            }
        }
        this.embed = new Discord.EmbedBuilder()
            .setAuthor({ url: this.member.avatarURL(), name: 'Choose category' })
            .setDescription(`${this.leaderboardTemplates.map(category => `${this.bot.storedEmojis[category.emoji].text} **${category.prettyName}**`).join('\n')}`)
            .setColor(this.embedColor)
        this.leaderboardMessage = await this.leaderboardMessage.edit({ embeds: [this.embed] })
        this.templatePick = await this.leaderboardMessage.confirmListEmojis(
            this.leaderboardTemplates.map(template => this.bot.storedEmojis[template.emoji].id),
            this.member.id
        )
        if (!this.templatePick || this.templatePick == 'Cancelled') { return this.stopProcess() }
        this.leaderboardMessage.edit({ components: [] })

        for (const category of this.leaderboardTemplates) {
            if (this.templatePick == this.bot.storedEmojis[category.emoji].id) {
                this.template = category
                this.embedColor = this.template.embedColor
            }
        }
    }

    async updateEmbed() {
        const SQLQueryString = `SELECT * FROM users WHERE ${this.template.dbRows.map(n => `cast(${n} as unsigned)`).join(' + ')} > 0 ORDER BY ${this.template.dbRows.map(n => `cast(${n} as unsigned)`).join(' + ')} DESC`
        const [leaderboardRows,] = await this.db.promise().query(SQLQueryString)
        const prettyStrings = []
        const yourPositionPrettyStrings = []
        this.totalPoints = 0
        this.yourPosition = undefined
        for (const i in leaderboardRows) {
            if (!Object.hasOwn(leaderboardRows, i)) continue
            for (const dbRow of this.template.dbRows) this.totalPoints += parseInt(leaderboardRows[i][dbRow])
            if (leaderboardRows[i].id == this.member.id) this.yourPosition = i
        }
        let prettyString
        for (let i = 0; i < this.leaderboardLimit; i++) {
            const position = i + 1
            prettyString = `\`${position.toString().padStart(5, ' ')}.\``
            if (leaderboardRows.length >= position) {
                let points = 0
                for (const dbRow of this.template.dbRows) { points += parseInt(leaderboardRows[i][dbRow]) }
                prettyString += ` \`${points.toString().padStart(6, ' ')}\``
                prettyString += ` \`${`${Math.round((points / this.totalPoints) * 100)}`.padStart(3, ' ')}%\``
                prettyString += ` <@!${leaderboardRows[i].id}>`
            } else {
                prettyString += ` \`${'0'.padStart(6, ' ')}\``
                prettyString += ` \`${'0'.padStart(3, ' ')}%\``
            }
            prettyStrings.push(prettyString)
        }
        if (this.yourPosition != undefined) {
            this.yourPosition = parseInt(this.yourPosition) + 1
            for (const i in leaderboardRows) {
                if (!Object.hasOwn(leaderboardRows, i)) continue
                const position = parseInt(i) + 1
                if (this.leaderboardLimit >= this.yourPosition) { break }
                if (this.leaderboardLimit >= position) { continue }
                if (position > (this.yourPosition + this.leaderboardLerpAbove)) { break }
                if (position < (this.yourPosition - this.leaderboardLerpBelow)) { continue }

                prettyString = `\`${position.toString().padStart(5, ' ')}.\``
                if (leaderboardRows.length >= position) {
                    let points = 0
                    for (const dbRow of this.template.dbRows) { points += parseInt(leaderboardRows[i][dbRow]) }
                    prettyString += ` \`${points.toString().padStart(6, ' ')}\``
                    prettyString += ` \`${`${Math.round((points / this.totalPoints) * 100)}`.padStart(3, ' ')}%\``
                    prettyString += ` <@!${leaderboardRows[i].id}>`
                } else {
                    prettyString += ` \`${'0'.padStart(6, ' ')}\``
                    prettyString += ` \`${'0'.padStart(3, ' ')}%\``
                }
                yourPositionPrettyStrings.push(prettyString)
            }
        }
        const emoji = this.bot.storedEmojis[this.template.emoji].text
        const { prettyName } = this.template
        this.embeds = []
        this.embed = new Discord.EmbedBuilder()
            .setDescription(` = ${emoji} **${prettyName}** ${emoji} =\n${prettyStrings.join('\n')}`)
            .setColor(this.embedColor)
            .setFooter({ text: `Total ${prettyName} ${this.totalPoints}` })
        this.embeds.push(this.embed)
        if (yourPositionPrettyStrings.length > 0) {
            this.yourPositionEmbed = new Discord.EmbedBuilder()
                .setDescription(`${yourPositionPrettyStrings.join('\n')}`)
                .setColor(this.embedColor)
                .setFooter({ text: `Total ${prettyName} ${this.totalPoints}` })
            this.embeds.push(this.yourPositionEmbed)
        }
        await this.leaderboardMessage.edit({ embeds: this.embeds })
    }
}
