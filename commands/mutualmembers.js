const Discord = require('discord.js')

module.exports = {
    name: 'mutualmembers',
    description: 'Tells you which raiders appear at least twice in the raids corresponding to the input message IDs from #raidbot-info.',
    alias: ['mm'],
    guildspecific: true,
    role: 'security',
    args: '[<Message ID 1>, <Message ID 2>, (Message ID 3), ...]',
    requiredArgs: 2,
    async execute(message, args) {
        const targetChannel = message.guild.channels.cache.find(channel => channel.name === 'raidbot-info')

        // Appends Promises to fetch each message to a list and attempts to resolve.
        const notFoundMessageIDs = []
        const allMessages = await Promise.all(
            args.map(
                arg => targetChannel.messages.fetch(arg).catch(
                    error => {
                        if (error.code === 10008) {
                            notFoundMessageIDs.push(arg)
                        }
                        return null
                    }
                )
            )
        )
        const fetchedMessages = allMessages.filter(i => i !== null)
        if (notFoundMessageIDs.length > 0) {
            return message.reply(`Could not find message(s) with message ID(s) \`${notFoundMessageIDs.join(', ')}\` in <#${targetChannel.id}>.`)
        }

        // Obtains all relevant information from the #raidbot-info embeds for each raid, storing them in lists
        const guildID = message.guild.id
        const allRaidsRaiders = []
        const allRaidsInfo = fetchedMessages.map(
            fetchedMessage => {
                const afkEmbedFields = fetchedMessage.embeds[0].fields
                const raidersField = afkEmbedFields.find(item => item.name === 'Raiders')
                const raiders = raidersField.value
                const raidersList = raiders.split(' ')
                for (let j = 0; j < raidersList.length; j++) {
                    if (raidersList[j].includes(',')) {
                        const commaIndex = raidersList[j].indexOf(',')
                        allRaidsRaiders.push(raidersList[j].slice(0, commaIndex))
                    } else {
                        allRaidsRaiders.push(raidersList[j])
                    }
                }
                const raidRLandType = fetchedMessage.embeds[0].author.name
                const raidTime = fetchedMessage.createdTimestamp
                const raidLink = `https://discord.com/channels/${guildID}/${targetChannel.id}/${fetchedMessage.id}`
                return [raidTime, raidRLandType, raidLink]
            }
        )

        // Creates strings containing the times and linked raid descriptions (RL and Type), ordered chronologically.
        allRaidsInfo.sort((a, b) => a[0] - b[0])
        let allRaidsDescriptionsEmbed = ''
        let allRaidsTimesEmbed = ''
        for (let i = 0; i < allRaidsInfo.length; i++) {
            allRaidsTimesEmbed += `<t:${(parseInt(allRaidsInfo[i][0]) / 1000).toFixed(0)}:f>\n`
            allRaidsDescriptionsEmbed += `[${allRaidsInfo[i][1]}](${allRaidsInfo[i][2]})\n`
        }

        // Finds all unique raiders and how many times they appear. Note that uniqueRaiders and countRaiders have the same length.
        const uniqueRaiders = allRaidsRaiders.filter((value, index, array) => array.indexOf(value) === index)
        const countRaiders = uniqueRaiders.map(raider => allRaidsRaiders.filter(r => r === raider).length)

        // Creates a string that contains raiders who have appeared at least twice: "suspicious" members. Ordered by descending observed frequency.
        const allSuspiciousMembers = []
        for (let i = 0; i < uniqueRaiders.length; i++) {
            if (countRaiders[i] >= 2) {
                allSuspiciousMembers.push([uniqueRaiders[i], countRaiders[i]])
            }
        }
        allSuspiciousMembers.sort((a, b) => b[1] - a[1])
        let allSuspiciousMembersEmbed = ''
        for (let i = 0; i < allSuspiciousMembers.length; i++) {
            allSuspiciousMembersEmbed += `${allSuspiciousMembers[i][0]} appears ${allSuspiciousMembers[i][1]} times.\n`
        }

        // Makes and outputs an embed containing all relevant information.
        const exampleEmbed = new Discord.EmbedBuilder()
            .setColor('#63C5DA')
            .setAuthor({ name: `${message.member.displayName}`, iconURL: message.member.user.avatarURL() })
            .setTitle('Mutual Member Analysis')
            .setDescription(`**Runs Analysed**: ${args.length}`)
            .addFields(
                { name: '\u00A0', value: '\u00A0' },
                { name: 'Raids', value: allRaidsTimesEmbed, inline: true },
                { name: '\u200B', value: allRaidsDescriptionsEmbed, inline: true },
                { name: '\u00A0', value: '\u00A0' },
                { name: 'Suspicious Raiders', value: allSuspiciousMembersEmbed }
            )
            .setTimestamp()
            .setFooter({ text: `${message.guild.name} • Mutual Member Analysis`, iconURL: message.guild.iconURL() })

        message.reply({ embeds: [exampleEmbed] })
    }
}
