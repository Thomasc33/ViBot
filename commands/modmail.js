const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')

module.exports = {
    name: 'modmail',
    description: 'Mod Mail Handler',
    role: 'moderator',
    args: '<update>',
    interactionHandler,
    async execute(message, args, bot, db) {
        if (args.length > 0) {
            switch (args[0].toLowerCase()) {
                case 'update':
                    this.update(message.guild, bot, db)
                    break
                case 'sendinfo':
                    this.sendInfo(message)
                    break
                default:
            }
        }
    },
    async sendModMail(message, guild, bot, db) {
        const settings = bot.settings[guild.id]
        if (await checkBlacklist(message.author, db)) return await message.author.send('You have been blacklisted from modmailing.')
        if (!settings.backend.modmail) return
        message.react('📧')
        message.channel.send('Message has been sent to mod-mail. If this was a mistake, don\'t worry')
        const embed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL() })
            .setDescription(`<@!${message.author.id}> **sent the bot**\n${message.content}`)
            .setFooter({ text: `User ID: ${message.author.id} MSG ID: ${message.id}` })
            .setTimestamp()
        const modmailCloseComponents = new Discord.ActionRowBuilder()
            .addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('🔓 Unlock')
                    .setStyle(3)
                    .setCustomId('modmailUnlock')
            ])
        const modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        const embedMessage = await modMailChannel.send({ embeds: [embed], components: [modmailCloseComponents] }).catch(er => ErrorLogger.log(er, bot, message.guild))

        const modmailInteractionCollector = new Discord.InteractionCollector(bot, { message: embedMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        modmailInteractionCollector.on('collect', (interaction) => interactionHandler(interaction, settings, bot, db))
        if (message.attachments.first()) modMailChannel.send(message.attachments.first().proxyURL)
    },
    async init(guild, bot) {
        guild.channels.cache.get(bot.settings[guild.id].channels.modmail).messages.fetch({ limit: 100 })
    }
}

async function interactionHandler(interaction, settings, bot, db) {
    if (!interaction.isButton()) return
    if (!settings.backend.modmail) {
        interaction.reply('Modmail is disabled in this server.')
        return
    }

    const failedEmbed = new Discord.EmbedBuilder()
        .setFooter({ text: `Status: ${interaction.customId} MSG ID: ${interaction.message.id}` })
        .setDescription('Could not figure out what went wrong')
        .setColor('#FF0000')

    const confirmationEmbed = new Discord.EmbedBuilder()
        .setTitle('Confirm Action')
        .setDescription('Are you sure you wanna perform this action?\n')
        .setFooter({ text: `${interaction.customId}` })
        .setColor('#FF0000')

    const modmailOpenComponents = new Discord.ActionRowBuilder()
    if (settings.modmail.lockModmail) {
        modmailOpenComponents.addComponents([
            new Discord.ButtonBuilder()
                .setLabel('🔒 Lock')
                .setStyle(1)
                .setCustomId('modmailLock')
        ])
    }
    if (settings.modmail.sendMessage) {
        modmailOpenComponents.addComponents([
            new Discord.ButtonBuilder()
                .setLabel('✉️ Send Message')
                .setStyle(3)
                .setCustomId('modmailSend')
        ])
    }
    if (settings.modmail.forwardMessage) {
        modmailOpenComponents.addComponents([
            new Discord.ButtonBuilder()
                .setLabel('↪️ Forward ModMail')
                .setStyle(2)
                .setCustomId('modmailForward')
        ])
    }
    if (settings.modmail.blacklistUser) {
        modmailOpenComponents.addComponents([
            new Discord.ButtonBuilder()
                .setLabel('🔨 Blacklist User')
                .setStyle(2)
                .setCustomId('modmailBlacklist')
        ])
    }
    if (settings.modmail.closeModmail) {
        modmailOpenComponents.addComponents([
            new Discord.ButtonBuilder()
                .setLabel('❌ Close ModMail')
                .setStyle(4)
                .setCustomId('modmailClose')
        ])
    }

    let embed = new Discord.EmbedBuilder()
    embed.data = interaction.message.embeds[0].data

    const modmailMessage = interaction.message
    const { guild } = interaction
    const modmailChannel = guild.channels.cache.get(settings.channels.modmail)
    const raider = guild.members.cache.get(modmailMessage.embeds[0].data.footer.text.split(/ +/g)[2])
    if (!raider) {
        embed.addFields({ name: `This modmail has been closed automatically <t:${moment().unix()}:R>`, value: 'The raider in this modmail is no longer in this server.\nI can no longer proceed with this modmail', inline: false })
        interaction.message.edit({ embeds: [embed], components: [] })
        return await interaction.deferUpdate()
    }
    const directMessages = await raider.user.createDM()

    function checkInServer() {
        const result = guild.members.cache.get(directMessages.recipient.id)
        if (!result) { failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`); interaction.reply({ embeds: [failedEmbed] }); interaction.message.edit({ components: [] }) }
        return result
    }

    if (interaction.customId === 'modmailUnlock') {
        await interaction.message.edit({ embed: [interaction.message.embed], components: [modmailOpenComponents] })
        await interaction.deferUpdate()
    } else if (interaction.customId === 'modmailLock') {
        const modmailCloseComponents = new Discord.ActionRowBuilder()
            .addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('🔓 Unlock')
                    .setStyle(3)
                    .setCustomId('modmailUnlock')
            ])
        await interaction.message.edit({ embed: [interaction.message.embed], components: [modmailCloseComponents] })
        await interaction.deferUpdate()
    } else if (interaction.customId === 'modmailSend') {
        const originalModmail = embed.data.description
        // originalModmail = originalModmail.substring(originalModmail.indexOf(':') + 3, originalModmail.length - 1)

        const embedResponse = new Discord.EmbedBuilder()
            .setDescription(`__How would you like to respond to ${raider}'s [message](${modmailMessage.url})__\n${originalModmail}`)
        const tempResponseMessage = await modmailChannel.send({ embeds: [embedResponse] })

        const responseMessageCollector = new Discord.MessageCollector(modmailChannel, { filter: messageToBeSent => messageToBeSent.author.id === interaction.member.id })
        responseMessageCollector.on('collect', async (message) => {
            const responseMessage = message.content.trim()
            if (responseMessage == '') return await interaction.reply({ content: 'Invalid response. Please provide text. If you attached an image, please copy the URL and send that', ephemeral: true })
            responseMessageCollector.stop()
            await message.delete()
            if (!checkInServer) {
                await tempResponseMessage.delete()
                failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`)
                await interaction.reply({ embeds: [failedEmbed] }); interaction.message.edit({ components: [] })
                await interaction.message.edit({ components: [] })
                return
            }
            embedResponse.setDescription(`__Are you sure you want to respond with the following?__\n${responseMessage}`)
            await tempResponseMessage.edit({ embeds: [embedResponse] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(interaction.member.id)) {
                    if (!checkInServer) {
                        await tempResponseMessage.delete()
                        failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`)
                        await interaction.reply({ embeds: [failedEmbed] }); interaction.message.edit({ components: [] })
                        await interaction.message.edit({ components: [] })
                        return
                    }
                    await directMessages.send(responseMessage)
                    await tempResponseMessage.delete()
                    embed.addFields([{ name: `Response by ${interaction.member.nickname} <t:${moment().unix()}:R>:`, value: responseMessage }])
                    await interaction.message.edit({ embeds: [embed], components: [] })
                } else {
                    await tempResponseMessage.delete()
                    await interaction.message.edit({ components: [modmailOpenComponents] })
                }
            })
        })
    } else if (interaction.customId === 'modmailForward') {
        const forwardedMessageChannel = interaction.guild.channels.cache.get(settings.channels.forwardedModmailMessage)
        confirmationEmbed.setDescription(`This will forward this modmail over to ${forwardedMessageChannel}`)
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                if (forwardedMessageChannel) {
                    const forwardedMessageEmbed = new Discord.EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription(interaction.message.embeds[0].data.description)
                    const forwardedMessage = await forwardedMessageChannel.send({ embeds: [forwardedMessageEmbed] })
                    if (settings.backend.forwadedMessageThumbsUpAndDownReactions) {
                        await forwardedMessage.react('👍')
                        await forwardedMessage.react('👎')
                    }
                    embed.addFields([{ name: `${interaction.member.nickname} has forwarded this modmail <t:${moment().unix()}:R>`, value: `This modmail has been forwarded to ${forwardedMessageChannel}` }])

                    await interaction.message.edit({ embeds: [embed], components: [] })
                    await interaction.deferUpdate()
                } else if (forwardedMessageChannel == undefined) {
                    embed = new Discord.EmbedBuilder()
                        .setDescription(`${interaction.member} This feature has not been set up.\nIf you would like for this to be set up, then do the following\nContact any Mod+\nHave them do \`\`;setup\`\`\nAnd enable \`\`forwardedModmailMessage\`\` under \`\`channels\`\``)
                        .setColor('#FF0000')
                        .setFooter({ text: `${interaction.customId}` })
                    await interaction.reply({ embeds: [embed] })
                }
            } else { await interaction.message.edit({ components: [modmailOpenComponents] }); await confirmMessage.delete(); await interaction.deferUpdate() }
        })
    } else if (interaction.customId === 'modmailClose') {
        confirmationEmbed.setDescription('This will close the modmail permenantly.\nIf you wish to send a message after closing, use the ``;mmr`` command to send a message to this modmail')
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                embed.addFields([{ name: `${interaction.member.nickname} has closed this modmail <t:${moment().unix()}:R>`, value: 'This modmail has been closed' }])
                await interaction.message.edit({ embeds: [embed], components: [] })
                await interaction.deferUpdate()
            } else { await interaction.message.edit({ components: [modmailOpenComponents] }); await confirmMessage.delete(); await interaction.deferUpdate() }
        })
    } else if (interaction.customId === 'modmailBlacklist') {
        confirmationEmbed.setDescription(`This will blacklist ${raider} and they can no longer send in any future modmails`)
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                db.query(`INSERT INTO modmailblacklist (id) VALUES ('${raider.id}')`)
                embed.addFields([{ name: `${interaction.member.nickname} has blacklisted ${raider.nickname} <t:${moment().unix()}:R>`, value: `${raider} has been blacklisted by ${interaction.member}` }])
                await interaction.message.edit({ embeds: [embed], components: [] })
                await interaction.deferUpdate()
            } else { await interaction.message.edit({ components: [modmailOpenComponents] }); await confirmMessage.delete(); await interaction.deferUpdate() }
        })
    } else {
        embed = new Discord.EmbedBuilder()
            .setDescription(`${interaction.member} Something went wrong when trying to handle your interaction\nPlease try again or contact any Upper Staff to get this sorted out.\nThank you for your patience!`)
            .setColor('#FF0000')
            .setFooter({ text: `${interaction.customId}` })
        await interaction.reply({ embeds: [embed] })
    }
}

async function checkBlacklist(member, db) {
    const [rows] = db.promise().query(`SELECT * FROM modmailblacklist WHERE id = '${member.id}'`)
    return rows.length == 0
}
