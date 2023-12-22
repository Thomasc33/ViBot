const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')
const { init } = require('./vetVerification');
const moment = require('moment')
var watchedModMails = []
const axios = require('axios')
const modmailGPTurl = require('../settings.json').modmailGPTurl

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
                    break;
                case 'sendinfo':
                    this.sendInfo(message)
                    break;
            }
        }
    },
    async sendModMail(message, guild, bot, db) {
        let settings = bot.settings[guild.id]
        if (await checkBlacklist(message.author, db)) return await message.author.send('You have been blacklisted from modmailing.')
        if (!settings.backend.modmail) return
        message.react('📧')
        message.channel.send('Message has been sent to mod-mail. If this was a mistake, don\'t worry')
        let embed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL() })
            .setDescription(`<@!${message.author.id}> **sent the bot**\n${message.content}`)
            .setFooter({ text: `User ID: ${message.author.id} MSG ID: ${message.id}` })
            .setTimestamp()
        modmailCloseComponents = new Discord.ActionRowBuilder()
            .addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('🔓 Unlock')
                    .setStyle(3)
                    .setCustomId('modmailUnlock')
            ])
        let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        let embedMessage = await modMailChannel.send({ embeds: [embed], components: [modmailCloseComponents] }).catch(er => ErrorLogger.log(er, bot, message.guild))

        modmailInteractionCollector = new Discord.InteractionCollector(bot, { message: embedMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        modmailInteractionCollector.on('collect', (interaction) => interactionHandler(interaction, settings, bot, db))
        if (message.attachments.first()) modMailChannel.send(message.attachments.first().proxyURL)
    },
    async init(guild, bot, db) {
        guild.channels.cache.get(bot.settings[guild.id].channels.modmail).messages.fetch({ limit: 100 })
    },
}

async function interactionHandler(interaction, settings, bot, db) {
    if (!interaction.isButton()) return;
    if (!settings.backend.modmail) {
        interaction.reply(`Modmail is disabled in this server.`)
        return
    }

    failedEmbed = new Discord.EmbedBuilder()
        .setFooter({ text: `Status: ${interaction.customId} MSG ID: ${interaction.message.id}` })
        .setDescription(`Could not figure out what went wrong`)
        .setColor('#FF0000')

    confirmationEmbed = new Discord.EmbedBuilder()
        .setTitle(`Confirm Action`)
        .setDescription(`Are you sure you wanna perform this action?\n`)
        .setFooter({ text: `${interaction.customId}` })
        .setColor('#FF0000')

    modmailOpenComponents = new Discord.ActionRowBuilder()
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
    if (settings.modmail.modmailGPT || true) { // remove the true thing
        modmailOpenComponents.addComponents([
            new Discord.ButtonBuilder()
                .setLabel('🤖 Generate Response')
                .setStyle(2)
                .setCustomId('modmailGPT')
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

    // Split row if open components is > 5
    if (modmailOpenComponents.components.length > 5) {
        // Split the components into two rows
        const splitComponents = modmailOpenComponents.components.reduce((acc, component, index) => {
            if (index < 5) {
                acc[0].push(component);
            } else {
                acc[1].push(component);
            }
            return acc;
        }, [[], []]);

        // Create the two rows
        modmailOpenComponents = [
            new Discord.ActionRowBuilder().addComponents(splitComponents[0]),
            new Discord.ActionRowBuilder().addComponents(splitComponents[1])
        ];
    } else modmailOpenComponents = [modmailOpenComponents]

    let embed = new Discord.EmbedBuilder()
    embed.data = interaction.message.embeds[0].data

    let modmailMessage = interaction.message
    let guild = interaction.guild
    let modmailChannel = guild.channels.cache.get(settings.channels.modmail)
    let modmailMessageID = modmailMessage.embeds[0].data.footer.text.split(/ +/g)[5]
    let raider = guild.members.cache.get(modmailMessage.embeds[0].data.footer.text.split(/ +/g)[2])
    if (!raider) {
        embed.addFields({ name: `This modmail has been closed automatically <t:${moment().unix()}:R>`, value: `The raider in this modmail is no longer in this server.\nI can no longer proceed with this modmail`, inline: false })
        interaction.message.edit({ embeds: [embed], components: [] })
        return await interaction.deferUpdate()
    }
    let directMessages = await raider.user.createDM()

    function checkInServer() {
        const result = guild.members.cache.get(directMessages.recipient.id);
        if (!result) { failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`); interaction.reply({ embeds: [failedEmbed] }); interaction.message.edit({ components: [] }) }
        return result;
    }
    let userModMailMessage = await directMessages.messages.fetch(modmailMessageID)
    let security = interaction.member

    if (interaction.customId === "modmailUnlock") {
        await interaction.message.edit({ embed: [interaction.message.embed], components: [...modmailOpenComponents] })
        await interaction.deferUpdate()
    } else if (interaction.customId === "modmailLock") {
        modmailCloseComponents = new Discord.ActionRowBuilder()
            .addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('🔓 Unlock')
                    .setStyle(3)
                    .setCustomId('modmailUnlock')
            ])
        await interaction.message.edit({ embed: [interaction.message.embed], components: [modmailCloseComponents] })
        await interaction.deferUpdate()
    } else if (interaction.customId === "modmailSend") {
        await interaction.update({ content: " ", components: [] })
        let originalModmail = embed.data.description;
        let embedResponse = new Discord.EmbedBuilder()
            .setDescription(`__How would you like to respond to ${raider}'s [message](${modmailMessage.url})__\n${originalModmail}`)
        let tempResponseMessage = await modmailChannel.send({ embeds: [embedResponse] })

        let responseMessageCollector = new Discord.MessageCollector(modmailChannel, { filter: messageToBeSent => messageToBeSent.author.id === interaction.member.id })
        responseMessageCollector.on('collect', async function (message) {
            let responseMessage = message.content.trim()
            if (responseMessage == '') return await interaction.editReply({ content: 'Invalid response. Please provide text. If you attached an image, please copy the URL and send that', ephemeral: true })
            responseMessageCollector.stop()
            await message.delete()
            if (!checkInServer) {
                await tempResponseMessage.delete()
                failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`)
                await interaction.reply({ embeds: [failedEmbed] });
                await interaction.message.edit({ components: [] })
                return
            }
            embedResponse.setDescription(`__Are you sure you want to respond with the following?__\n${responseMessage}`)
            await tempResponseMessage.edit({ embeds: [embedResponse] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(interaction.member.id)) {
                    if (!checkInServer) {
                        await tempResponseMessage.delete()
                        failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`)
                        await interaction.editReply({ embeds: [failedEmbed] });
                        await interaction.message.edit({ components: [] })
                        return
                    }
                    await directMessages.send(responseMessage)
                    await tempResponseMessage.delete()
                    embed.addFields([{ name: `Response by ${interaction.member.nickname} <t:${moment().unix()}:R>:`, value: responseMessage }])
                    await interaction.message.edit({ embeds: [embed], components: [] })
                } else {
                    await tempResponseMessage.delete()
                    await interaction.message.edit({ components: [...modmailOpenComponents] })
                }
            })
        })
    } else if (interaction.customId === "modmailForward") {
        let forwardedMessageChannel = interaction.guild.channels.cache.get(settings.channels.forwardedModmailMessage)
        confirmationEmbed.setDescription(`This will forward this modmail over to ${forwardedMessageChannel}`)
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                if (forwardedMessageChannel) {
                    let forwardedMessageEmbed = new Discord.EmbedBuilder()
                        .setColor('#ff0000')
                        .setDescription(interaction.message.embeds[0].data.description)
                    let forwardedMessage = await forwardedMessageChannel.send({ embeds: [forwardedMessageEmbed] })
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
            } else { await interaction.message.edit({ components: [...modmailOpenComponents] }); await confirmMessage.delete(); await interaction.deferUpdate() }
        })
    } else if (interaction.customId === "modmailClose") {
        confirmationEmbed.setDescription(`This will close the modmail permenantly.\nIf you wish to send a message after closing, use the \`\`;mmr\`\` command to send a message to this modmail`)
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                embed.addFields([{ name: `${interaction.member.nickname} has closed this modmail <t:${moment().unix()}:R>`, value: `This modmail has been closed` }])
                await interaction.message.edit({ embeds: [embed], components: [] })
                await interaction.deferUpdate()
            } else { await interaction.message.edit({ components: [...modmailOpenComponents] }); await confirmMessage.delete(); await interaction.deferUpdate() }
        })
    } else if (interaction.customId === "modmailBlacklist") {
        confirmationEmbed.setDescription(`This will blacklist ${raider} and they can no longer send in any future modmails`)
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                db.query(`INSERT INTO modmailblacklist (id) VALUES ('${raider.id}')`)
                embed.addFields([{ name: `${interaction.member.nickname} has blacklisted ${raider.nickname} <t:${moment().unix()}:R>`, value: `${raider} has been blacklisted by ${interaction.member}` }])
                await interaction.message.edit({ embeds: [embed], components: [] })
                await interaction.deferUpdate()
            } else { await interaction.message.edit({ components: [...modmailOpenComponents] }); await confirmMessage.delete(); await interaction.deferUpdate() }
        })
    } else if (interaction.customId === "modmailGPT") {
        // Get the original modmail
        let originalModmail = embed.data.description.replace(/<@!\d+?>/g, '').replace(' **sent the bot**\n', '').replace('\t', '');

        // Respond to interaction
        let resp = await interaction.deferReply()

        // Send modmail to flask API
        axios.post(modmailGPTurl, { modmail: originalModmail })
            .then(async function (response) {
                // Get the generated text from the Flask API
                let generatedText = response.data.response; // Assuming Flask responds with a key named "response"

                // Ask for User Confirmation
                let approvalEmbed = new Discord.EmbedBuilder()
                    .setTitle("Generated Response")
                    .setDescription(`Generated text: ${generatedText}`);


                let tempResponseMessage = await resp.edit({ embeds: [approvalEmbed] });

                if (await tempResponseMessage.confirmButton(interaction.member.id)) {
                    // Check if the user is still in the server
                    if (!checkInServer) {
                        await tempResponseMessage.delete();
                        failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`);
                        await interaction.reply({ embeds: [failedEmbed] });
                        await interaction.message.edit({ components: [] });
                        return;
                    }

                    await directMessages.send(generatedText);
                    await tempResponseMessage.delete();

                    embed.addFields([{ name: `Generated Response Approved by ${interaction.member.nickname} <t:${moment().unix()}:R>:`, value: generatedText }]);
                    await interaction.message.edit({ embeds: [embed], components: [] });

                } else {
                    // User rejected the generated response
                    await tempResponseMessage.delete();
                    await interaction.message.edit({ components: [...modmailOpenComponents] });
                }
            })
            .catch(function (error) {
                // Handle any errors from the Flask API
                console.log("Error from Flask API: ", error);
            });
    }
    else {
        embed = new Discord.EmbedBuilder()
            .setDescription(`${interaction.member} Something went wrong when trying to handle your interaction\nPlease try again or contact any Upper Staff to get this sorted out.\nThank you for your patience!`)
            .setColor('#FF0000')
            .setFooter({ text: `${interaction.customId}` })
        await interaction.reply({ embeds: [embed] })
    }
}

async function checkBlacklist(member, db) {
    return new Promise(async (res, rej) => {
        db.query(`SELECT * FROM modmailblacklist WHERE id = '${member.id}'`, (err, rows) => {
            if (err) return rej(err)
            if (rows.length == 0) {
                res(false)
            } else {
                res(true)
            }
        })
    })
}

const keyFilter = (r, u) => !u.bot && r.emoji.name === '🔑'
const choiceFilter = (r, u) => !u.bot && (r.emoji.name === '📧' || r.emoji.name === '👀' || r.emoji.name === '🗑️' || r.emoji.name === '❌' || r.emoji.name === '🔨' || r.emoji.name === '🔒' /*temp, remove later*/ || r.emoji.id === '752368122551337061')