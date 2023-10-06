/* eslint-disable no-prototype-builtins */
/* eslint-disable no-await-in-loop */
const Discord = require('discord.js')

module.exports = {
    name: 'activitycheck',
    description: 'Goes through ever user with the specified role as their highest. Then lists them with how many runs they have done in the past 3 months.',
    alias: ['ac'],
    role: 'headrl',
    args: '<role>',
    guildSpecific: true,
    async execute(message, args, bot, db) {
        const activityCheckModule = new ActivityCheck(message, args, bot, db)
        await activityCheckModule.startProcess()
    }
}

class ActivityCheck {
    constructor(message, args, bot, db) {
        this.message = message
        this.channel = this.message.channel
        this.guild = message.guild
        this.member = this.message.member

        this.args = args
        this.role = this.guild.findRole(this.args.join(' '))
        this.memberList = this.guild.findUsersWithRoleAsHighest(this.role?.id)

        this.bot = bot
        this.settings = this.bot.settings[this.guild.id]
        this.problems = []
        this.maximumUsers = 500
        this.embedDescriptionMaxLimit = 4096

        this.embeds = []
        this.memberListWithNoRuns = []
        this.memberListOfUsersWithRunsFormatted = []
        this.strings = []

        this.db = db

        this.embedHeader = `## Activity Check for ${this.role}`
        this.embedNoRunsHeader = '## Users with no runs'
        this.embedDescription = `All users with ${this.role} as their highest will show up below.`
        this.embedColor = this.role ? this.role.hexColor : this.member.roles.highest.hexColor

        this.processStartedUnixTimestamp = Date.now()
        this.processStartedDiscordTimestamp = `<t:${Math.floor(this.processStartedUnixTimestamp / 1000)}:R>`
        this.embedDescriptionProcessStarted = `Keep in mind this is only for the last 3 months.\nProcess started ${this.processStartedDiscordTimestamp}`
    }

    async startProcess() {
        await this.checkFilters()
        if (this.problems.length > 0) { return await this.stopProcess() }
        await this.sendStartMessage()
        await this.filterMemberList()
        await this.filterStrings()
        await this.updateMessage()
    }

    async filterMemberList() {
        for (const member of this.memberList) {
            const [rows,] = await this.db.promise().query('SELECT * FROM loggedusage WHERE userid = ? AND guildid = ? AND utime > UNIX_TIMESTAMP(curdate() - interval 3 month)', [member.id, this.guild.id])
            if (rows.length == 0) {
                this.memberListWithNoRuns.push(member)
                continue
            }
            let lastLogTime = 0
            let amountOfRunsLead = 0
            for (const row of rows) {
                if (row.utime > lastLogTime) { lastLogTime = row.utime }
                amountOfRunsLead += row.amount
            }
            const lastLogDiscordTimestampRelative = `<t:${Math.floor(lastLogTime / 1000)}:R>`
            const lastLogDiscordTimestampLongDateWithShortTime = `<t:${Math.floor(lastLogTime / 1000)}:f>`
            const prettyString = `\`${amountOfRunsLead.toString().padStart(4, ' ')}\` ${member} ${lastLogDiscordTimestampRelative} at ${lastLogDiscordTimestampLongDateWithShortTime}`
            this.memberListOfUsersWithRunsFormatted.push(prettyString)
        }
    }

    async filterStrings() {
        this.embeds = []
        this.embed = this.getDefaultEmbed()
        await this.updateEmbed(`${this.embedHeader}\n${this.embedDescription}`)
        this.embeds.push(this.embed)
        this.embed = this.getDefaultEmbed()
        if (this.memberListOfUsersWithRunsFormatted?.length > 0) {
            for (const string of this.memberListOfUsersWithRunsFormatted) {
                await this.updateEmbed(`\n${string}`)
            }
            this.embeds.push(this.embed)
        }
        if (this.memberListWithNoRuns?.length > 0) {
            this.embed = this.getDefaultEmbed()
            await this.updateEmbed(`${this.embedNoRunsHeader}\n`)
            for (const member of this.memberListWithNoRuns) {
                await this.updateEmbed(` ${member}`)
            }
            this.embeds.push(this.embed)
        }
    }

    async updateEmbed(string) {
        if (!this.embed.data.hasOwnProperty('description')) {
            this.embed.setDescription(string)
            return
        }
        if (this.embed.data.description.length + string.length >= this.embedDescriptionMaxLimit) {
            this.embeds.push(this.embed)
            this.embed = this.getDefaultEmbed()
            this.embed.setDescription(string)
            return
        }
        this.embed.setDescription(this.embed.data.description + string)
    }

    async updateMessage() {
        this.embeds[0].setAuthor({ iconURL: this.member.displayAvatarURL(), name: `${this.member.displayName}` })
        this.embeds[this.embeds.length - 1].setFooter({ text: `${this.guild.name} • Activity Check • ${this.memberList?.length} Members`, iconURL: this.guild.iconURL() })
        await this.activityCheckMessage.edit({ embeds: this.embeds })
    }

    async sendStartMessage() {
        this.embed = this.getDefaultEmbed()
            .setDescription(`${this.embedHeader}\n${this.embedDescription}\n${this.embedDescriptionProcessStarted}`)
        this.embeds.push(this.embed)
        this.activityCheckMessage = await this.channel.send({ embeds: this.embeds })
    }

    async stopProcess() {
        this.embed = new Discord.EmbedBuilder()
            .setTitle('Process Failed')
            .setDescription(this.problems.map(problem => `- ${problem}`).join('\n'))
            .setColor('#FF0000')
        this.message.reply({ embeds: [this.embed] })
    }

    async checkFilters() {
        const errorMessages = {
            roleNotFound: `Could not find role \`${this.args.join(' ')}\``,
            disabledChannel: `This command is currently supported in ${this.settings.lists.activityCheckAllowedChannels.length > 0 ? this.settings.lists.activityCheckAllowedChannels.map(channel => this.guild.channels.cache.get(this.settings.channels[channel])).join(', ') : 'no channels. Which is likely due to this command not being set up correctly'}`,
            tooManyUsers: `The activity check process currently only supports roles with fewer than ${this.maximumUsers} members`,
            noUsers: `Found no roles with ${this.role} as their highest`
        }

        if (!this.role) { this.problems.push(errorMessages.roleNotFound) }
        if (!this.settings.lists.activityCheckAllowedChannels.map(channel => this.settings.channels[channel]).includes(this.channel.id)) { this.problems.push(errorMessages.disabledChannel) }
        if (this.memberList > this.maximumUsers) { this.problems.push(errorMessages.tooManyUsers) }
        if (this.memberList?.length == 0) { this.problems.push(errorMessages.noUsers) }
    }

    getDefaultEmbed() {
        return new Discord.EmbedBuilder().setColor(this.role.hexColor)
    }
}
