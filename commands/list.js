const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('@discordjs/builders')
const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

// Enum for determining which view to show
const ranks = {
    HIGHER: 0,
    HIGHEST: 1
}

// Enum for page configurations
const PageConfigurations = {
    NEITHER: 0,
    HIGHER_ONLY: 1,
    HIGHEST_ONLY: 2,
    BOTH: 3
}

// Enum for button customIds
const Buttons = {
    SWITCH_RANK: 'SWITCH_RANK',
    DROPDOWN: 'DROPDOWN'
}

// Constant for length of string embed per page
const EMBED_STRING_MAX = 950

module.exports = {
    name: 'list',
    description: 'Displays a list of all users with the specified role. Can input multiple roles separated by "|". Adding "export" after the role(s) will output list(s) of discord IDs of the users that the embed would otherwise display',
    role: 'raider',
    args: '<role name/ID> <export>',
    requiredArgs: 1,
    alias: ['roleinfo', 'ri'],
    /**
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     */
    async execute(message, args, bot) {
        const exportFile = args[args.length - 1].toLowerCase() == 'export'
        if (exportFile) args = args.slice(0, args.length - 1)
        const roles = args.join(' ').toLowerCase().split('|').map(role => role.trim())

        if (roles.length == 1) {
            if (exportFile) {
                module.exports.exportFileSingle(message, roles[0])
            } else {
                module.exports.normalList(message, bot, roles[0])
            }
        } else if (exportFile) {
            module.exports.exportFileMulti(message, roles)
        } else {
            module.exports.combinedList(message, bot, roles)
        }
    },

    async exportFileSingle(message, role) {
        const guildRole = message.guild.findRole(role)
        if (!guildRole) return message.channel.send(`No role found for: \`${role}\``)
        const userIdLists = { highest: message.guild.findUsersWithRoleAsHighest(guildRole.id).map(member => member.id), higher: message.guild.findUsersWithRoleNotAsHighest(guildRole.id).map(member => member.id) }
        const files = []
        if (userIdLists.highest.length > 0) {
            files.push({
                attachment: Buffer.from(userIdLists.highest.join(','), 'utf-8'),
                name: `users-with-${role}-as-highest-role${this.getDateString()}.csv`
            })
        }
        if (userIdLists.higher.length > 0) {
            files.push({
                attachment: Buffer.from(userIdLists.higher.join(','), 'utf-8'),
                name: `users-with-a-higher-role-than-${role}${this.getDateString()}.csv`
            })
        }
        return message.channel.send({ files })
    },

    async exportFileMulti(message, roles) {
        const name = roles.map(role => `-${role}`).join('')
        const foundRoles = []
        const unknownRoles = []
        let roleCheck = null
        roles.forEach((role) => {
            roleCheck = message.guild.findRole(role)
            if (roleCheck === null) unknownRoles.push(role)
            else foundRoles.push(roleCheck)
        })
        if (unknownRoles.length > 0) return message.channel.send(`No roles found for: ${unknownRoles.join(', ')}`)
        const memberList = message.guild.members.cache
            .filter(member => foundRoles.every(role => member.roles.cache.has(role.id)))
            .map(member => member.id)
        if (memberList.length > 0) {
            return message.channel.send({
                files: [{
                    attachment: Buffer.from(memberList.join(','), 'utf-8'),
                    name: `users-with${name}${this.getDateString()}.csv`
                }]
            })
        }
        return message.channel.send('No users found with all roles')
    },

    async normalList(message, bot, role) {
        // Search for role in guild
        const guildRole = message.guild.findRole(role)
        if (!guildRole) return message.channel.send(`No role found for: \`${role}\``)
        const userIdLists = { highest: message.guild.findUsersWithRoleAsHighest(guildRole.id).map(member => member.id), higher: message.guild.findUsersWithRoleNotAsHighest(guildRole.id).map(member => member.id) }

        // Array with pages of users where given role is highest position
        const highestStringPages = this.getMemberPageArray(userIdLists.highest)

        // Array with pages of users with a higher position role
        const higherStringPages = this.getMemberPageArray(userIdLists.higher)

        // dict to acces page arrays via rank enum
        const pagesDict = {
            0: higherStringPages,
            1: highestStringPages
        }

        // setting starting page + page config
        let pageConfig = PageConfigurations.NEITHER
        if (userIdLists.highest.length > 0) {
            if (userIdLists.higher.length > 0) pageConfig = PageConfigurations.BOTH
            else pageConfig = PageConfigurations.HIGHEST_ONLY
        } else if (userIdLists.higher.length > 0) pageConfig = PageConfigurations.HIGHER_ONLY
        let currentRank = pageConfig == PageConfigurations.HIGHER_ONLY ? ranks.HIGHER : ranks.HIGHEST

        // setting timestamp
        const time = Date.now()

        // info to send to embed creator
        const embedInfo = { pageConfig, higherStringPages, highestStringPages, userLists: userIdLists, guildRole, time }

        let currentPage = 0
        const row = this.createComponents(0, pagesDict[currentRank].length, pageConfig, 1 - currentRank)
        const sendData = { embeds: [this.createEmbed(embedInfo, 0, currentRank)], components: row }
        const listMessage = await message.channel.send(sendData).catch(err => ErrorLogger.log(err, bot, message.guild))
        const navigationInteractionHandler = new Discord.InteractionCollector(bot, { time: 300000, message: listMessage })
        navigationInteractionHandler.on('collect', async interaction => {
            if (interaction.user.id != message.author.id) return
            if (interaction.customId == Buttons.SWITCH_RANK) {
                currentPage = 0
                currentRank = 1 - currentRank
                await interaction.update({ embeds: [this.createEmbed(embedInfo, currentPage, currentRank)], components: this.createComponents(currentPage, pagesDict[currentRank].length, pageConfig, 1 - currentRank) })
            } else if (interaction.customId == Buttons.DROPDOWN) {
                currentPage = parseInt(interaction.values[0])
                await interaction.update({ embeds: [this.createEmbed(embedInfo, currentPage, currentRank)], components: this.createComponents(currentPage, pagesDict[currentRank].length, pageConfig, 1 - currentRank) })
            }
            navigationInteractionHandler.resetTimer()
        })
        navigationInteractionHandler.on('end', async () => {
            await listMessage.edit({ embeds: [], components: [] })
        })
    },

    createComponents(pageNumber, pages, pageConfig = PageConfigurations.NEITHER, rank = ranks.HIGHEST) {
        const buttonRow = new Discord.ActionRowBuilder()
        const dropdownRow = new Discord.ActionRowBuilder()

        // higher vs highest button
        if (pageConfig == PageConfigurations.BOTH) {
            const rankButton = new Discord.ButtonBuilder()
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(Buttons.SWITCH_RANK)
            if (rank == ranks.HIGHER) {
                rankButton.setLabel('Users with a higher role')
                rankButton.setEmoji('⬆️')
            } else {
                rankButton.setLabel('Users with no higher role')
                rankButton.setEmoji('➖')
            }

            buttonRow.addComponents([rankButton])
        }

        // dropdown
        if (pages > 1) {
            const dropdown = new StringSelectMenuBuilder({
                custom_id: Buttons.DROPDOWN,
                placeholder: 'Page: ' + (pageNumber + 1)
            })

            // first page
            dropdown.addOptions(new StringSelectMenuOptionBuilder()
                .setLabel('First Page (1)')
                .setValue(String(0)))

            // pages before currentPage
            for (let i = Math.max(1, pageNumber - 10); i < pageNumber; i++) {
                dropdown.addOptions(new StringSelectMenuOptionBuilder()
                    .setLabel(String(i + 1))
                    .setValue(String(i)))
            }

            // pages after currentPage
            for (let i = pageNumber; i < Math.min(pageNumber + 11, pages - 1); i++) {
                const option = new StringSelectMenuOptionBuilder()
                    .setLabel(String(i + 1))
                    .setValue(String(i))
                if (i == pageNumber) option.setDefault(true)
                if (i != 0) dropdown.addOptions(option)
            }

            // last page
            dropdown.addOptions(new StringSelectMenuOptionBuilder()
                .setLabel('Last Page (' + pages + ')')
                .setValue(String(pages - 1)))

            dropdownRow.addComponents(dropdown)
        }
        const rows = []
        if (dropdownRow.components.length > 0) rows.push(dropdownRow)
        if (buttonRow.components.length > 0) rows.push(buttonRow)
        return rows
    },

    createEmbed(embedInfo, pageNumber, rank) {
        const pages = rank == ranks.HIGHER ? embedInfo.higherStringPages.length : embedInfo.highestStringPages.length
        const totalMemberCount = embedInfo.userLists.higher.length + embedInfo.userLists.highest.length
        const embed = new Discord.EmbedBuilder()
            .setColor(embedInfo.guildRole.hexColor)
            .setTitle(`Role Info for ${embedInfo.guildRole.name}`)
            .setDescription(`**Role:** ${embedInfo.guildRole} | **Role Color:** \`${embedInfo.guildRole.hexColor}\` | Page ${pageNumber + 1} of ${pages}`)
            .setFooter({ text: `There are ${totalMemberCount} members in the ${embedInfo.guildRole.name} role` })
            .setTimestamp(embedInfo.time)
        if (rank == ranks.HIGHEST) {
            embed.addFields(
                { name: `${embedInfo.userLists.highest.length} members with \`${embedInfo.guildRole.name}\` as their highest role`, value: embedInfo.userLists.highest.length > 0 ? embedInfo.highestStringPages[pageNumber] : 'None' })
        } else {
            embed.addFields(
                { name: `${embedInfo.userLists.higher.length} members with a higher role than \`${embedInfo.guildRole.name}\``, value: embedInfo.userLists.higher.length > 0 ? embedInfo.higherStringPages[pageNumber] : 'None' })
        }
        return embed
    },

    async combinedList(message, bot, roles) {
        const foundRoles = []
        const unknownRoles = []
        let roleCheck = null
        roles.forEach((role) => {
            roleCheck = message.guild.findRole(role)
            if (roleCheck === null) unknownRoles.push(role)
            else foundRoles.push(roleCheck)
        })
        if (unknownRoles.length > 0) return message.channel.send(`No roles found for: ${unknownRoles.join(', ')}`)

        // filters all members to those who have every role in foundRoles and returns their ids
        const memberIdList = message.guild.members.cache
            .filter(member => foundRoles.every(role => member.roles.cache.has(role.id)))
            .map(member => member.id)

        const memberStringPages = this.getMemberPageArray(memberIdList)
        if (memberIdList.length < 1) return message.channel.send('No users found with all roles')

        const time = Date.now()
        let currentPage = 0
        let embed = new Discord.EmbedBuilder()
            .setTitle('Combined List')
            .setDescription(`**Roles: ${foundRoles.map(role => role).join(' | ')}** | Page ${currentPage + 1} of ${memberStringPages.length}`)
            .setColor(foundRoles[0].hexColor)
            .setTimestamp(time)
        embed.addFields({
            name: 'These users have all of the roles combined',
            value: memberStringPages[currentPage]
        })
        embed.setFooter({ text: `There are ${memberIdList.length} users who have all of the roles combined` })

        const row = this.createComponents(0, memberStringPages.length)
        const listMessage = await message.channel.send({ embeds: [embed], components: row })
        const navigationInteractionHandler = new Discord.InteractionCollector(bot, { time: 300000, message: listMessage })
        navigationInteractionHandler.on('collect', async interaction => {
            if (interaction.user.id != message.author.id) return
            if (interaction.customId == Buttons.DROPDOWN) {
                currentPage = parseInt(interaction.values[0])
            }
            embed = new Discord.EmbedBuilder()
                .setTitle('Combined List')
                .setDescription(`**Roles: ${foundRoles.map(role => role).join(' | ')}** | Page ${currentPage + 1} of ${memberStringPages.length}`)
                .setColor(foundRoles[0].hexColor)
                .setTimestamp(time)

            embed.addFields({
                name: 'These users have all of the roles combined',
                value: memberStringPages[currentPage]
            })
            await interaction.update({ embeds: [embed], components: this.createComponents(currentPage, memberStringPages.length) })
            navigationInteractionHandler.resetTimer()
        })
        navigationInteractionHandler.on('end', async () => {
            await listMessage.edit({ components: [] })
        })
    },

    // takes a list of IDs and returns an array of pages
    getMemberPageArray(memberList) {
        let memberString = ''
        const memberStringPages = []
        for (const member of memberList) {
            if (memberString.length < EMBED_STRING_MAX) {
                memberString += `<@!${member}> `
                if (member == memberList[memberList.length - 1]) {
                    memberStringPages.push(memberString)
                }
            } else {
                memberStringPages.push(memberString)
                memberString = ''
            }
        }
        return memberStringPages
    },

    getDateString() {
        const date = new Date()
        return '-' + date.toLocaleString('default', { month: 'short' }) + '-' + date.getDate() + '-' + date.getFullYear()
    }
}
