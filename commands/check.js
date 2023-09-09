/* eslint-disable no-await-in-loop */
/* eslint-disable guard-for-in */
const Discord = require('discord.js')

module.exports = {
    name: 'check',
    role: 'security',
    description: 'Performs several checks on stuff in the server\nThe command is interactive with two buttons.',
    async execute(message, args, bot, db) {
        const checkModule = new Check(message, args, bot, db)
        await checkModule.sendProcessMessage()
        await message.guild.members.fetch()
        await checkModule.startProcess()
    }
}

class Check {
    /**
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     */

    constructor(message, args, bot, db) {
        this.message = message
        this.guild = message.guild
        this.member = message.member

        this.args = args

        this.bot = bot
        this.roleCache = this.guild.roles.cache

        this.settings = this.bot.settings[this.guild.id]

        this.db = db

        this.embedColor = '#7fb0ff'
        this.defaultArrayJoiner = ' '
        this.hasListenerEnded = false

        this.problems = []
        this.autoFixers = []

        this.processStartedUnixTimestamp = Date.now()
        this.processStartedDiscordTimestamp = `<t:${Math.floor(this.processStartedUnixTimestamp / 1000)}:R>`
    }

    async sendProcessMessage() {
        this.embed = new Discord.EmbedBuilder()
            .setAuthor({ name: `${this.member.displayName}`, iconURL: this.member.user.avatarURL() })
            .setFooter({ text: `${this.guild.name}`, iconURL: this.guild.iconURL() })
            .setColor(this.embedColor)
            .setDescription(`Hello! Please be patient while I go through this server.\nI started this ${this.processStartedDiscordTimestamp}`)
        this.checkMessage = await this.message.reply({ embeds: [this.embed] })
    }

    async startProcess() {
        await this.getPanels()
        await this.updateMessage()
    }

    async getPanels() {
        await this.panelDuplicateNickname()
        await this.panelVerifiedWithoutNickname()
        await this.panelUnverifiedWithNickname()
        await this.panelRemoveRolesFromRoleUsers()
        await this.panelAddRolesFromRoleUsers()
        await this.panelCheckOpenModmails()
        await this.panelCheckOpenVerifications()
        await this.panelCheckOpenVeteranVerifications()
        await this.panelFalseSuspensions()
    }

    // Panels revolving nickname stuff
    async panelDuplicateNickname() {
        const panelName = 'duplicateNicknames'
        if (!this.settings.checkPanels[panelName]) { return }
        const nicknames = {}
        await Promise.allSettled(this.guild.members.cache.map(async member => {
            if (await this.isPanelRestricted(member, panelName) || !member.roles.cache.hasAny(...this.getCachedRolesFromArray(this.settings.checkRoles.rolesVerified).map(role => role.id))) { return }
            const memberNicknames = member.nickname?.toLowerCase().replace(/[^a-z|]/gi, '').split('|') || []
            // eslint-disable-next-line no-return-assign
            memberNicknames.forEach(nickname => (nicknames[nickname] = nicknames[nickname] || []).push(member.id))
        }))
        const duplicateNicknames = Object.keys(nicknames).filter(nickname => nicknames[nickname].length > 1)
        duplicateNicknames.forEach(nickname => {
            const memberIDs = nicknames[nickname].map(memberID => `<@!${memberID}>`).join(', ')
            const problemCategory = 'Duplicate Nicknames'
            const problem = {
                text: `${memberIDs} All share \`${nickname}\``
            }
            this.addProblemToCategory(problemCategory, problem, ' ', this.settings.checkStrings.duplicateNicknames)
        })
    }

    async panelVerifiedWithoutNickname() {
        const panelName = 'verifiedWithoutNickname'
        if (!this.settings.checkPanels[panelName]) { return }
        this.guild.members.cache.forEach(async member => {
            if (await this.isPanelRestricted(member, panelName)) { return }

            if (!member.roles.cache.hasAny(...this.getCachedRolesFromArray(this.settings.checkRoles.rolesVerified).map(role => role.id))) { return }
            if (member.nickname !== null && member.nickname !== '') { return }
            const problemCategory = 'Verified members without nickname'
            const problem = {
                text: `<@!${member.id}>`
            }
            this.addProblemToCategory(problemCategory, problem, ' ', this.settings.checkStrings.verifiedWithoutNickname)
        })
    }

    async panelUnverifiedWithNickname() {
        const panelName = 'unverifiedWithNickname'
        if (!this.settings.checkPanels[panelName]) { return }
        this.guild.members.cache.forEach(async member => {
            if (await this.isPanelRestricted(member, panelName)) { return }

            if (!member.roles.cache.hasAny(...this.getCachedRolesFromArray(this.settings.checkRoles.rolesUnverified).map(role => role.id))) { return }
            if (member.nickname !== null && member.nickname !== '') {
                const problemCategory = 'Unverified members with nickname'
                const problem = {
                    text: `<@!${member.id}>`
                }
                this.addProblemToCategory(problemCategory, problem, ' ', this.settings.checkStrings.unverifiedWithNickname)
            }
        })
    }

    // -----        Panels involving role shenanigans       -----
    // This panel will remove X role from person with Y role. Can be used for many roles
    async panelRemoveRolesFromRoleUsers() {
        const panelName = 'removeRolesFromUserWithRole'
        if (!this.settings.checkPanels[panelName]) { return }
        const rolesToRemoveFrom = this.settings.removeRoleFromUserWithRoles
        const rolesToRemoveFromFiltered = Object.keys(rolesToRemoveFrom).filter(role => rolesToRemoveFrom[role].length > 0)
        if (rolesToRemoveFromFiltered.length == 0) { return }

        for (const index in rolesToRemoveFromFiltered) {
            const roleName = rolesToRemoveFromFiltered[index]
            const role = this.roleCache.get(this.settings.roles[roleName])
            this.guild.members.cache.forEach(async member => {
                if (!member.roles.cache.has(role.id)) { return }
                if (await this.isPanelRestricted(member, panelName)) { return }
                for (const i in rolesToRemoveFrom[roleName]) {
                    const problemRoleID = this.settings.roles[rolesToRemoveFrom[roleName][i]]
                    if (!member.roles.cache.has(problemRoleID)) { continue }
                    const problemRole = this.roleCache.get(problemRoleID)
                    const problemRoleName = problemRole.name
                    const problem = {
                        text: member.toString()
                    }
                    const variables = {
                        roleName: role.name,
                        problemRoleName
                    }
                    const replacedString = this.replacePlaceholders(this.settings.checkStrings.removeRolesFromUserWithRole, variables)
                    this.addProblemToCategory(`Members with ${role.name} should not have ${problemRoleName}`, problem, ', ', replacedString)
                    const autoFixProblem = {
                        userID: member.id,
                        roleToRemove: problemRole.id
                    }
                    this.addAutoFixProblem(autoFixProblem)
                }
            })
        }
    }

    // This panel will add X role to person with Y role. Can be used for many roles
    async panelAddRolesFromRoleUsers() {
        const panelName = 'addRolesToUsersWithRoles'
        if (!this.settings.checkPanels[panelName]) { return }
        const rolesToAdd = this.settings.addRolesToUsersWithRoles
        const rolesToAddFiltered = Object.keys(rolesToAdd).filter(role => rolesToAdd[role].length > 0)
        if (rolesToAddFiltered.length == 0) { return }

        for (const index in rolesToAddFiltered) {
            const roleName = rolesToAddFiltered[index]
            const role = this.roleCache.get(this.settings.roles[roleName])
            this.guild.members.cache.forEach(async member => {
                if (!member.roles.cache.has(role.id)) { return }
                if (await this.isPanelRestricted(member, panelName)) { return }
                for (const i in rolesToAdd[roleName]) {
                    const problemRoleID = this.settings.roles[rolesToAdd[roleName][i]]
                    if (member.roles.cache.has(problemRoleID)) { continue }
                    const problemRole = this.roleCache.get(problemRoleID)
                    const problemRoleName = problemRole.name
                    const problem = {
                        text: member.toString()
                    }
                    this.addProblemToCategory(`Members with ${role.name} should have ${problemRoleName}`, problem, ', ', this.settings.checkStrings.addRolesToUsersWithRoles)
                    const autoFixProblem = {
                        userID: member.id,
                        roleToAdd: problemRole.id
                    }
                    this.addAutoFixProblem(autoFixProblem)
                }
            })
        }
    }

    // -----        Panels involving Verifications and Modmails     -----
    // Modmails
    async panelCheckOpenModmails() {
        const panelName = 'openModmails'
        if (!this.settings.checkPanels[panelName]) { return }
        const modmailChannel = this.guild.channels.cache.get(this.settings.channels.modmail)
        if (!modmailChannel) { return }
        const modmailChannelMessages = await modmailChannel.messages.fetch({ limit: 100 })

        await modmailChannelMessages.each(async modmailMessage => {
            if (!modmailMessage.author.bot) { return }
            if (modmailMessage.components.length == 0) { return }
            const problem = {
                text: `<t:${Math.floor(modmailMessage.createdTimestamp / 1000)}:R> ${modmailMessage.url}`
            }
            this.addProblemToCategory('Unopened Modmails', problem, '\n', this.settings.checkStrings.openModmails)
        })
    }

    // Verifications
    async panelCheckOpenVerifications() {
        const panelName = 'openVerifications'
        if (!this.settings.checkPanels[panelName]) { return }
        const manualVerificationChannel = this.guild.channels.cache.get(this.settings.channels.manualverification)
        if (!manualVerificationChannel) { return }
        const manualVerificationChannelMessages = await manualVerificationChannel.messages.fetch({ limit: 100 })

        await manualVerificationChannelMessages.each(async verificationMessage => {
            if (!verificationMessage.author.bot) { return }
            if (!verificationMessage.reactions.cache.has('🔑')) { return }
            const problem = {
                text: `<t:${Math.floor(verificationMessage.createdTimestamp / 1000)}:R> ${verificationMessage.url}`
            }
            this.addProblemToCategory('Unopened Verifications', problem, '\n', this.settings.checkStrings.openVerifications)
        })
    }

    // Veteran Verifications
    async panelCheckOpenVeteranVerifications() {
        const panelName = 'openVeteranVerifications'
        if (!this.settings.checkPanels[panelName]) { return }
        const manualVeteranVerificationChannel = this.guild.channels.cache.get(this.settings.channels.manualvetverification)
        if (!manualVeteranVerificationChannel) { return }
        const manualVeteranVerificationChannelMessages = await manualVeteranVerificationChannel.messages.fetch({ limit: 100 })

        await manualVeteranVerificationChannelMessages.each(async veteranVerificationMessage => {
            if (!veteranVerificationMessage.author.bot) { return }
            if (!veteranVerificationMessage.reactions.cache.has('🔑')) { return }
            const problem = {
                text: `<t:${Math.floor(veteranVerificationMessage.createdTimestamp / 1000)}:R> ${veteranVerificationMessage.url}`
            }
            this.addProblemToCategory('Unopened Veteran Verifications', problem, '\n', this.settings.checkStrings.openVeteranVerifications)
        })
    }

    async panelFalseSuspensions() {
        const panelName = 'falseSuspensions'
        if (!this.settings.checkPanels[panelName]) { return }
        const allSuspensions = await this.getSuspends()

        const suspensionRoleNames = this.settings.checkRoles.falseSuspenionRoles
        for (const index in suspensionRoleNames) {
            const roleName = suspensionRoleNames[index]
            const roleSuspension = this.roleCache.get(this.settings.roles[roleName])
            roleSuspension.members.cache.forEach(async member => {
                if (await this.isPanelRestricted(member, panelName)) { return }
                if (!allSuspensions.includes(member.id)) { return }
                const problemCategory = 'False Suspensions'
                const problem = {
                    text: `<@!${member.id}>`
                }
                this.addProblemToCategory(problemCategory, problem, ' ', this.settings.checkStrings.falseSuspenions)
            })
        }
    }

    async isPanelRestricted(member, panel) {
        if (this.settings.checkUserExceptions[panel].includes(member.id)) { return true }
        if (this.settings.checkUserExceptions.allPanelExceptions.includes(member.id)) { return true }
        if (member.roles.cache.hasAny(...this.settings.checkRoleExceptions[panel].map(role => this.settings.roles[role]))) { return true }
        if (member.roles.cache.hasAny(...this.settings.checkRoleExceptions.allPanelExceptions.map(role => this.settings.roles[role]))) { return true }
        return false
    }

    async transformPanelsIntoFields() {}
    embedBuilder() {
        const embed = new Discord.EmbedBuilder()
        embed.setColor(this.embedColor)
        return embed
    }

    async updateMessage() {
        this.embeds = []
        let embed = this.embedBuilder()
        if (this.problems.length == 0) {
            embed.setDescription('No problems found')
            this.embeds.push(embed)
            this.embeds[0].setAuthor({ name: `${this.member.displayName}`, iconURL: this.member.user.avatarURL() })
            this.embeds[this.embeds.length - 1].setFooter({ text: `${this.guild.name} • Check Report • ${this.problemLength()} problem${this.problemLength().length == 1 ? '' : 's'}`, iconURL: this.guild.iconURL() })
            await this.checkMessage.edit({ embeds: this.embeds, components: [] })
            return
        }
        let prettyStringsArray = []
        let prettyString = ''
        for (const problemCategory of this.problems) {
            // eslint-disable-next-line no-prototype-builtins
            if (!problemCategory.hasOwnProperty('problems')) { continue }
            for (const problem of problemCategory.problems) {
                prettyString = problem.text
                if ((prettyString.length + prettyStringsArray.join(problemCategory.arrayJoiner ?? this.defaultArrayJoiner).length) >= 1024) {
                    if (embed.data.fields?.length >= 3) {
                        this.embeds.push(embed)
                        embed = this.embedBuilder()
                    }
                    embed.addFields({
                        name: problemCategory.category,
                        value: prettyStringsArray.join(problemCategory.arrayJoiner ?? this.defaultArrayJoiner),
                        inline: false
                    })
                    prettyStringsArray = []
                }
                prettyStringsArray.push(prettyString)
            }
            if (prettyStringsArray.length > 0) {
                if (embed.data.fields?.length >= 3) {
                    this.embeds.push(embed)
                    embed = this.embedBuilder()
                }
                embed.addFields({
                    name: problemCategory.category,
                    value: prettyStringsArray.join(problemCategory.arrayJoiner ?? this.defaultArrayJoiner),
                    inline: false
                })
                prettyStringsArray = []
            }
        }
        this.embeds.push(embed)

        this.embeds[0].setAuthor({ name: `${this.member.displayName}`, iconURL: this.member.user.avatarURL() })
        this.embeds[this.embeds.length - 1].setFooter({ text: `${this.guild.name} • Check Report • ${this.problemLength()} problem${this.problemLength().length == 1 ? '' : 's'}`, iconURL: this.guild.iconURL() })
        await this.checkMessage.edit({ embeds: this.embeds, components: [] })
        if (this.problems.length > 0) { await this.interactionHandler() }
    }

    // autofixer - 🐕‍🦺 | guide - 🔍
    async interactionHandler() {
        await this.updateComponents()
        if (this.actionRowBuilder.components.length == 0) { return }
        this.checkInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.checkMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.checkInteractionCollector.on('collect', async (interaction) => await this.processInteractions(interaction))
        setTimeout(() => this.interactionHandlerEnd(), Math.floor(10 * 60 * 1000))
    }

    async updateComponents() {
        if (this.hasListenerEnded) { return }
        this.actionRowBuilder = new Discord.ActionRowBuilder()
        if (this.settings.checkPanels.buttonGuide && this.doesAnyProblemHaveGuide()) {
            this.actionRowBuilder.addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('🔍 Guide')
                    .setStyle(1)
                    .setCustomId('checkGuide')
            ])
        }
        if (this.settings.checkPanels.buttonAutoFix && this.doesAnyProblemHave()) {
            this.actionRowBuilder.addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('🐕‍🦺 Auto Fixer')
                    .setStyle(2)
                    .setCustomId('checkAutoFixer')
            ])
        }
        if (this.actionRowBuilder.components.length == 0) { return }
        await this.checkMessage.edit({ components: [this.actionRowBuilder] })
    }

    async processInteractions(interaction) {
        if (!interaction || !interaction.isButton() || this.hasListenerEnded) { return }
        if (interaction.member.id != this.member.id) { return interaction.deferUpdate() }
        switch (interaction.customId) {
            case 'checkGuide': await this.processInteractionGuide(interaction); break
            case 'checkAutoFixer': await this.processInteractionAutofix(interaction); break
            default: await this.processInteractionUnknown(interaction); break
        }
    }

    async checkGuideEmbed() {
        return new Discord.EmbedBuilder()
            .setTitle('Check Guide 🔍')
            .setColor(this.embedColor)
    }

    async processInteractionGuide(interaction) {
        const embeds = []
        let interactionEmbed = await this.checkGuideEmbed()
        interactionEmbed.setDescription('This guide was curated by the Officer team\nIf you have any questions, feel free to ask!')
        for (const index in this.problems) {
            const problemCategory = this.problems[index]
            // eslint-disable-next-line no-prototype-builtins
            if (!problemCategory.hasOwnProperty('guide')) { continue }
            const prettyString = `\n### ${problemCategory.category}\n\`\`\`${problemCategory.guide}\`\`\``
            if (interactionEmbed.data.description.length + prettyString.length >= 3500) {
                embeds.push(interactionEmbed)
                interactionEmbed = await this.checkGuideEmbed()
                interactionEmbed.data.description = ''
            }
            interactionEmbed.data.description += prettyString
        }
        embeds.push(interactionEmbed)
        embeds[embeds.length - 1].setFooter({ text: `${this.guild.name} • Check Guide`, iconURL: this.guild.iconURL() })
        await interaction.reply({ embeds: [interactionEmbed], ephemeral: true })
    }

    async processInteractionAutofix(interaction) {
        const autoFixProblems = parseInt(this.autoFixers.length)
        const interactionEmbed = new Discord.EmbedBuilder()
            .setTitle('Auto Fixer 🐕‍🦺')
            .setColor(this.embedColor)
            .setFooter({ text: `${this.guild.name} • Check Auto Fixer`, iconURL: this.guild.iconURL() })
            .setTimestamp()
        const channelModLogs = this.guild.channels.cache.get(this.settings.channels.modlogs)
        if (!channelModLogs) {
            const modRole = this.roleCache.get(this.settings.roles.moderator)
            interactionEmbed.setDescription(`Error the mod logs channel is not defined${modRole ? `\nPlease contact ${modRole} to fix this` : ''}`)
            await interaction.reply({ embeds: [interactionEmbed], ephemeral: true })
            return
        }
        await interaction.reply({ embeds: [interactionEmbed], ephemeral: true, fetchReply: true })
        if (this.autoFixers.length >= 5) {
            interactionEmbed.setDescription(`I encountered \`${autoFixProblems}\` problems to automatically fix\nThe auto fixer goes through the problems step by step\n\n**__Are you sure you want to go through with this?__**`)
            interaction.editReply({ embeds: [interactionEmbed] })
            const didConfirm = await interaction.confirmButton(interaction.member.id)
            if (!didConfirm) { return interaction.deleteReply() }
        }

        delete interactionEmbed.data.title

        for (const index in this.autoFixers) {
            const autoFixProblem = this.autoFixers[index]
            const position = parseInt(autoFixProblems) - parseInt(index)

            const member = this.guild.members.cache.get(autoFixProblem.userID)
            const roleToRemove = this.roleCache.get(autoFixProblem.roleToRemove)
            const roleToAdd = this.roleCache.get(autoFixProblem.roleToAdd)

            interactionEmbed.spliceFields(0, 5)

            if (member) {
                interactionEmbed.setAuthor({ iconURL: member.displayAvatarURL(), name: `${member.displayName}` })
                interactionEmbed.setThumbnail(member.displayAvatarURL())
                interactionEmbed.setDescription(`There are \`${position}\` Autofixes left\n${member} \`${member.displayName}\``)
                interactionEmbed.addFields({
                    name: 'Current Roles',
                    value: [...member.roles.cache.values()].sort((a, b) => b.comparePositionTo(a)).join(' '),
                    inline: false })
                if (roleToAdd) { interactionEmbed.addFields({ name: 'Action', value: `${roleToAdd} will be added to ${member}`, inline: true }) }
                if (roleToRemove) { interactionEmbed.addFields({ name: 'Action', value: `${roleToRemove} will be removed from ${member}`, inline: true }) }
            }
            await interaction.editReply({ embeds: [interactionEmbed] })
            const didConfirm = await interaction.confirmButton(interaction.member.id)
            if (!didConfirm) { continue }
            if (roleToAdd && member.roles.cache.has(roleToAdd.id)) { continue }
            if (roleToRemove && !member.roles.cache.has(roleToRemove.id)) { continue }
            interactionEmbed.setDescription(`${member} \`${member.displayName}\``)
            if (roleToAdd) {
                member.roles.add(roleToAdd.id)
                interactionEmbed.data.fields[interactionEmbed.data.fields.length - 1] = { name: 'Action', value: `${roleToAdd} Has been added to ${member}`, inline: true }
            }
            if (roleToRemove) {
                member.roles.remove(roleToRemove.id)
                interactionEmbed.data.fields[interactionEmbed.data.fields.length - 1] = { name: 'Action', value: `${roleToRemove} Has been removed from ${member}`, inline: true }
            }
            interactionEmbed.addFields({ name: 'Moderator', value: `${interaction.member} \`${interaction.member.displayName}\``, inline: false })
            await channelModLogs.send({ embeds: [interactionEmbed] })
        }
        this.autoFixers = []
        await this.updateComponents()
        delete interactionEmbed.data.author
        delete interactionEmbed.data.fields
        delete interactionEmbed.data.thumbnail
        interactionEmbed.setTitle('Auto Fixer 🐕‍🦺')
        interactionEmbed.setDescription('The auto-fixer has completed its task.')
        await interaction.editReply({ embeds: [interactionEmbed], components: [] })
    }

    async processInteractionUnknown(interaction) {
        const interactionEmbed = new Discord.EmbedBuilder()
            .setTitle('Action Failed')
            .setDescription('Hey. You really should not have recieved this error...\nPlease report this to the developers')
            .setColor('#FF0000')
            .setFooter({ text: `${this.guild.name} • Check Interaction Failed • ${interaction.customId}`, iconURL: this.guild.iconURL() })
        await interaction.reply({ embeds: [interactionEmbed] })
    }

    async interactionHandlerEnd() {
        this.hasListenerEnded = true
        await this.checkMessage.edit({ components: [] })
        this.checkInteractionCollector.stop()
    }

    addProblemToCategory(categoryName, problem, arrayJoiner, categoryGuide) {
        let problemWasAdded = false
        for (const index in this.problems) {
            const existingProblem = this.problems[index]
            if (categoryName == existingProblem.category) {
                this.problems[index].problems.push(problem)
                problemWasAdded = true
            }
        }
        if (!problemWasAdded) {
            const categoryProblem = {
                category: categoryName ?? 'Unknown',
                arrayJoiner: arrayJoiner ?? ' ',
                problems: [problem]
            }
            if (categoryGuide) { categoryProblem.guide = categoryGuide }
            this.problems.push(categoryProblem)
        }
    }

    addAutoFixProblem(problem) {
        this.autoFixers.push(problem)
    }

    getCachedRolesFromArray(array) {
        return array.filter((role) => this.guild.roles.cache.get(this.settings.roles[role])).map(role => this.guild.roles.cache.get(this.settings.roles[role]))
    }

    problemLength() {
        let sizeOfProblems = 0
        // eslint-disable-next-line array-callback-return
        this.problems.map(problemCategory => {
            // eslint-disable-next-line no-unused-vars, array-callback-return
            problemCategory.problems.map(problem => {
                sizeOfProblems++
            })
        })
        return sizeOfProblems
    }

    getAllProblems() {
        const problems = []
        // eslint-disable-next-line array-callback-return
        this.problems.map(problemCategory => {
            // eslint-disable-next-line array-callback-return
            problemCategory.problems.map(problem => {
                problems.push(problem)
            })
        })
        return problems
    }

    doesAnyProblemHave() {
        return this.autoFixers.length > 0
    }

    doesAnyProblemHaveGuide() {
        for (const index in this.problems) {
            const problem = this.problems[index]
            // eslint-disable-next-line no-prototype-builtins
            if (problem.hasOwnProperty('guide')) { return true }
        }
        return false
    }

    replacePlaceholders(stringInput, variables) {
        return stringInput.replace(/\{([^}]+)\}/g, (match, key) => variables[key] || match)
    }

    async getSuspends() {
        const [rows,] = await this.db.promise().query('SELECT * FROM suspensions WHERE suspended = true AND guildid = ?', [this.guild.id])
        return rows.map(row => row.id)
    }
}
