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

module.exports = {
    name: 'list',
    description: 'Displays a list of all users with the specified role.',
    role: 'security',
    args: '<role name/ID>',
    requiredArgs: 1,
    alias: ['roleinfo', 'ri'],
    /**
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     */
    async execute(message, args, bot) {
        const exportFile = args[args.length - 1].toLowerCase().trim() == 'export'
        if (exportFile) args = args.slice(0, args.length - 1)
        const roles = args.join(' ').toLowerCase().split('|')
        roles.forEach((role, index, arr) => {
            arr[index] = role.trim()
        })

        if (roles.length == 1) {
            if (exportFile) {
                module.exports.exportFileSingle(message, roles[0])
            } else {
                module.exports.normalList(message, bot, roles[0])
            }
        } else if (exportFile) {
            module.exports.exportFileMulti(message, roles)
        } else module.exports.combinedList(message, bot, roles)
    },

    async exportFileSingle(message, role) {
        const guildRole = message.guild.findRole(role)
        if (!guildRole) return message.channel.send(`No role found for: \`${role}\``)
        const userLists = { highest: message.guild.findUsersWithRoleAsHighest(guildRole.id), higher: message.guild.findUsersWithRoleNotAsHighest(guildRole.id) }
        let highestCSV = ''
        for (const member of userLists.highest) {
            highestCSV = highestCSV + member + ','
        }
        const highestFile = Buffer.from(highestCSV.slice(0, -1), 'utf-8')

        let higherCSV = ''
        for (const member of userLists.higher) {
            higherCSV = higherCSV + member + ','
        }
        const higherFile = Buffer.from(higherCSV.slice(0, -1), 'utf-8')
        const date = '-' + (new Date()).toLocaleString('default', { month: 'short' }) + '-' + (new Date()).getDate()
        const files = []
        if (highestCSV.length > 0) {
            files.push({
                attachment: highestFile,
                name: 'users-with-' + role + '-as-highest-role' + date
            })
        }
        if (higherCSV.length > 0) {
            files.push({
                attachment: higherFile,
                name: 'users-with-a-higher-role-than-' + role + date
            })
        }
        return message.channel.send({ files })
    },

    async exportFileMulti(message, roles) {
        let name = ''
        roles.forEach((role) => {
            name += '-' + role
        })

        const foundRoles = roles.map(role => message.guild.findRole(role))
        const roleObjects = {}
        for (let index = 0; index < roles.length; index++) {
            if (!foundRoles[index]) message.channel.send(`No role found for: \`${roles[index]}\``)
            roleObjects[foundRoles[index]] = message.guild.findUsersWithRole(foundRoles[index].id).map(member => member.id)
        }
        const memberList = Object.values(roleObjects).reduce((acc, array) => acc.filter(id => array.includes(id)))

        let memberListCSV = ''
        for (const member of memberList) {
            memberListCSV = memberListCSV + member + ','
        }
        const memberListFile = Buffer.from(memberListCSV.slice(0, -1), 'utf-8')
        const date = '-' + (new Date()).toLocaleString('default', { month: 'short' }) + '-' + (new Date()).getDate()
        if (memberListCSV.length > 0) {
            return message.channel.send({
                files: [{
                    attachment: memberListFile,
                    name: 'users-with' + name + date
                }]
            })
        }
        return message.channel.send('No users found with all roles')
    },

    async normalList(message, bot, role) {
        // Search for role in guild
        const guildRole = message.guild.findRole(role)
        if (!guildRole) return message.channel.send(`No role found for: \`${role}\``)
        const userLists = { highest: message.guild.findUsersWithRoleAsHighest(guildRole.id), higher: message.guild.findUsersWithRoleNotAsHighest(guildRole.id) }

        // Array with pages of users where given role is highest position
        const highestStringPages = []
        let highestString = ''
        for (const member of userLists.highest) {
            if (highestString.length < 950) {
                highestString += `${member} `
                if (member == userLists.highest[userLists.highest.length - 1]) {
                    highestStringPages.push(highestString)
                }
            } else {
                highestStringPages.push(highestString)
                highestString = ''
            }
        }
        // Array with pages of users with a higher position role
        const higherStringPages = []
        let higherString = ''
        for (const member of userLists.higher) {
            if (higherString.length < 950) {
                higherString += `${member} `
                if (member == userLists.higher[userLists.higher.length - 1]) higherStringPages.push(higherString)
            } else {
                higherStringPages.push(higherString)
                higherString = ''
            }
        }

        // dict to acces page arrays via rank enum
        const pagesDict = {
            0: higherStringPages,
            1: highestStringPages
        }

        // setting starting page + page config
        let pageConfig = PageConfigurations.NEITHER
        if (userLists.highest.length > 0) {
            if (userLists.higher.length > 0) pageConfig = PageConfigurations.BOTH
            else pageConfig = PageConfigurations.HIGHEST_ONLY
        } else if (userLists.higher.length > 0) pageConfig = PageConfigurations.HIGHER_ONLY
        let currentRank = pageConfig == PageConfigurations.HIGHER_ONLY ? ranks.HIGHER : ranks.HIGHEST

        // setting timestamp
        const time = Date.now()

        // info to send to embed creator
        const embedInfo = { pageConfig, higherStringPages, highestStringPages, userLists, guildRole, time }

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
        const rowBuilder = new Discord.ActionRowBuilder()
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

            rowBuilder.addComponents([rankButton])
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
        if (rowBuilder.components.length > 0) rows.push(rowBuilder)
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
        const foundRoles = roles.map(role => message.guild.findRole(role))
        const roleObjects = {}
        for (let index = 0; index < roles.length; index++) {
            if (!foundRoles[index]) return message.channel.send(`No role found for: \`${roles[index]}\``)
            roleObjects[foundRoles[index]] = message.guild.findUsersWithRole(foundRoles[index].id).map(member => member.id)
        }
        const memberList = Object.values(roleObjects).reduce((acc, array) => acc.filter(id => array.includes(id)))

        let memberString = ''
        const memberStringPages = []
        for (const member of memberList) {
            if (memberString.length < 950) {
                memberString += `<@!${member}> `
                if (member == memberList[memberList.length - 1]) {
                    memberStringPages.push(memberString)
                }
            } else {
                memberStringPages.push(memberString)
                memberString = ''
            }
        }
        if (memberStringPages.length < 1) return message.channel.send('No users found with all roles')
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
        embed.setFooter({ text: `There are ${memberList.length} users who have all of the roles combined` })

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
            navigationInteractionHandler.resetTimer()
        })
        navigationInteractionHandler.on('end', async () => {
            await listMessage.edit({ components: [] })
        })
    }
}
