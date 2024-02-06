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

        let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        let embedMessage = await modMailChannel.send({ embeds: [embed], components: getCloseModmailComponents() }).catch(er => ErrorLogger.log(er, bot, message.guild))

        modmailInteractionCollector = new Discord.InteractionCollector(bot, { message: embedMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        modmailInteractionCollector.on('collect', (interaction) => interactionHandler(interaction, settings, bot, db))
        if (message.attachments.first()) modMailChannel.send(message.attachments.first().proxyURL)
    },
    async init(guild, bot, db) {
        guild.channels.cache.get(bot.settings[guild.id].channels.modmail).messages.fetch({ limit: 100 })
    },
}

function getCloseModmailComponents() {
    return [new Discord.ActionRowBuilder().addComponents(new Discord.ButtonBuilder().setLabel('🔓 Unlock').setStyle(3).setCustomId('modmailUnlock'))]
}
function getOpenModmailComponents(settings) {
    const components = []
    if (settings.modmail.lockModmail) {
        components.push(new Discord.ButtonBuilder().setLabel('🔒 Lock').setStyle(1).setCustomId('modmailLock'))
    }
    if (settings.modmail.sendMessage) {
        components.push(new Discord.ButtonBuilder().setLabel('✉️ Send Message').setStyle(3).setCustomId('modmailSend'))
    }
    if (settings.modmail.modmailGPT) {
        components.push(new Discord.ButtonBuilder().setLabel('🤖 Generate Response').setStyle(2).setCustomId('modmailGPT'))
    }
    if (settings.modmail.forwardMessage) {
        components.push(new Discord.ButtonBuilder().setLabel('↪️ Forward ModMail').setStyle(2).setCustomId('modmailForward'))
    }
    if (settings.modmail.blacklistUser) {
        components.push(new Discord.ButtonBuilder().setLabel('🔨 Blacklist User').setStyle(2).setCustomId('modmailBlacklist'))
    }
    if (settings.modmail.closeModmail) {
        components.push(new Discord.ButtonBuilder().setLabel('❌ Close ModMail').setStyle(4).setCustomId('modmailClose'))
    }

    return components.reduce((rows, btn, idx) => {
        if (idx % 5 == 0) rows.push(new Discord.ActionRowBuilder());
        rows[rows.length - 1].addComponents(btn);
        return rows;
    }, [])
}

/**
 * 
 * @param {Discord.ButtonInteraction} interaction 
 * @param {*} settings 
 * @param {*} bot 
 * @param {*} db 
 * @returns 
 */
async function interactionHandler(interaction, settings, bot, db) {
    if (!interaction.isButton()) return;
    if (!settings.backend.modmail) {
        interaction.reply(`Modmail is disabled in this server.`)
        return
    }

    const failedEmbed = new Discord.EmbedBuilder()
        .setFooter({ text: `Status: ${interaction.customId} MSG ID: ${interaction.message.id}` })
        .setDescription(`Could not figure out what went wrong`)
        .setColor('#FF0000')

    const confirmationEmbed = new Discord.EmbedBuilder()
        .setTitle(`Confirm Action`)
        .setDescription(`Are you sure you wanna perform this action?\n`)
        .setFooter({ text: `${interaction.customId}` })
        .setColor('#FF0000')

    const modmailOpenComponents = getModmailComponents(settings);

    const embed = Discord.EmbedBuilder.from(interaction.message.embeds[0].data);

    const { message: modmailMessage, guild, member } = interaction;
    const modmailChannel = guild.channels.cache.get(settings.channels.modmail);
    const modmailMessageID = embed.data.footer.text.split(/ +/g)[5];

    const raider = guild.members.cache.get(embed.data.footer.text.split(/ +/g)[2])
    
    if (!raider) {
        embed.addFields({ name: `This modmail has been closed automatically <t:${moment().unix()}:R>`, value: `The raider in this modmail is no longer in this server.\nI can no longer proceed with this modmail`, inline: false })
        interaction.update({ embeds: [embed], components: [] })
        return
    }
    // TODO: REWRITE THE REST
    const directMessages = await raider.user.createDM()

    function checkInServer() {
        const result = guild.members.cache.get(directMessages.recipient.id);
        if (!result) { 
            failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`); 
            interaction.reply({ embeds: [failedEmbed] }); 
            interaction.update({ components: [] });
        }
        return result;
    }

    const userModmailMessage = await directMessages.messages.fetch(modmailMessageID)

    /**
     * @typedef {{
     *  interaction: Discord.ButtonInteraction,
     *  modmailMessage: Discord.Message,
     *  guild: Discord.Guild,
     *  member: Discord.GuildMember,
     *  modmailChannel: Discord.GuildTextBasedChannel,
     *  userModmailMessage: Discord.Message?,
     *  directMessages: Discord.DMChannel,
     *  settings: import('../data/guildSettings.701483950559985705.cache.json'),
     *  embed: Discord.EmbedBuilder,
     *  raider: Discord.GuildMember
     * }} ModmailData
     */

    /** @type {ModmailData} */
    const modmailData = { interaction, modmailMessage, guild, member, modmailChannel, userModmailMessage, directMessages, settings, embed, raider }
    const Modmail = {
        /** @param {ModmailData} options */
        async modmailUnlock({ embed, settings, interaction }) {
            await interaction.update({ embeds: [embed], components: getModmailComponents(settings) })
        },

        /** @param {ModmailData} options */
        async modmailLock({ interaction, embed }) {
            await interaction.update({ embeds: [embed], components: getCloseModmailComponents() })
        },

        /** @param {ModmailData} options */
        async modmailSend({ interaction, embed, raider, modmailMessage }) {
            const originalMessage = embed.data.description;
            const confirmEmbed = new Discord.EmbedBuilder()
                .setDescription(`__How would you like to respond to ${raider}'s [message](${modmailMessage.url})__\n${originalMessage}`)
                .setColor(Discord.Colors.Blue);
            await interaction.reply({ embeds: [confirmEmbed] });

            const result = 
        }
    }
    switch (interaction.customId) {
        case 'modmailUnlock':
            await interaction.update({ embed: [embed], components: getModmailComponents(settings) });
            break;
        case 'modmailLock':
            await interaction.update({ embed: [embed], components: getCloseModmailComponents() });
            break;
        case 'modmailSend': {

            }
            break;
    }
        
    } else if (interaction.customId === "modmailSend") {
        let originalModmail = embed.data.description;
        let embedResponse = new Discord.EmbedBuilder()
            .setDescription(`__How would you like to respond to ${raider}'s [message](${modmailMessage.url})__\n${originalModmail}`)
        let tempResponseMessage = await interaction.reply({ embeds: [embedResponse] });

        let responseMessageCollector = new Discord.MessageCollector(modmailChannel, { filter: messageToBeSent => messageToBeSent.author.id === interaction.member.id })
        responseMessageCollector.on('collect', async function (message) {
            let responseMessage = message.content.trim()
            if (responseMessage == '') return await interaction.editReply({ content: 'Invalid response. Please provide text. If you attached an image, please copy the URL and send that', ephemeral: true })
            responseMessageCollector.stop()
            await message.delete()
            if (!checkInServer) {
                await tempResponseMessage.delete()
                failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`)
                await interaction.editReply({ embeds: [failedEmbed] });
                await modmailMessage.edit({ components: [] })
                return
            }
            embedResponse.setDescription(`__Are you sure you want to respond with the following?__\n${responseMessage}`)
            await tempResponseMessage.edit({ embeds: [embedResponse] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(interaction.member.id)) {
                    if (!checkInServer) {
                        await tempResponseMessage.delete()
                        failedEmbed.setDescription(`${raider} Has left this server and I can no longer continue with this modmail`)
                        await interaction.editReply({ embeds: [failedEmbed] });
                        await modmailMessage.edit({ components: [] })
                        return
                    }
                    await directMessages.send(responseMessage)
                    await tempResponseMessage.delete()
                    embed.addFields([{ name: `Response by ${interaction.member.nickname} <t:${moment().unix()}:R>:`, value: responseMessage }])
                    await modmailMessage.edit({ embeds: [embed], components: [] })
                } else {
                    await tempResponseMessage.delete()
                    await modmailMessage.edit({ components: [...modmailOpenComponents] })
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

                    await interaction.update({ embeds: [embed], components: [] })
                } else if (forwardedMessageChannel == undefined) {
                    embed = new Discord.EmbedBuilder()
                        .setDescription(`${interaction.member} This feature has not been set up.\nIf you would like for this to be set up, then do the following\nContact any Mod+\nHave them do \`\`;setup\`\`\nAnd enable \`\`forwardedModmailMessage\`\` under \`\`channels\`\``)
                        .setColor('#FF0000')
                        .setFooter({ text: `${interaction.customId}` })
                    await interaction.reply({ embeds: [embed] })
                }
            } else { await interaction.update({ components: [...modmailOpenComponents] }); await confirmMessage.delete(); }
        })
    } else if (interaction.customId === "modmailClose") {
        confirmationEmbed.setDescription(`This will close the modmail permanently.\nIf you wish to send a message after closing, use the \`\`;mmr\`\` command to send a message to this modmail`)
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                embed.addFields([{ name: `${interaction.member.nickname} has closed this modmail <t:${moment().unix()}:R>`, value: `This modmail has been closed` }])
                await interaction.update({ embeds: [embed], components: [] })
            } else { await interaction.update({ components: [...modmailOpenComponents] }); await confirmMessage.delete(); }
        })
    } else if (interaction.customId === "modmailBlacklist") {
        confirmationEmbed.setDescription(`This will blacklist ${raider} and they can no longer send in any future modmails`)
        await modmailChannel.send({ embeds: [confirmationEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(interaction.member.id)) {
                await confirmMessage.delete()
                db.query(`INSERT INTO modmailblacklist (id) VALUES ('${raider.id}')`)
                embed.addFields([{ name: `${interaction.member.nickname} has blacklisted ${raider.nickname} <t:${moment().unix()}:R>`, value: `${raider} has been blacklisted by ${interaction.member}` }])
                await modmailMessag({ embeds: [embed], components: [] })
            } else { await modmailMessage.edit({ components: [...modmailOpenComponents] }); await confirmMessage.delete(); }
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
                        await interaction.update({ components: [] });
                        return;
                    }

                    await directMessages.send(generatedText);
                    await tempResponseMessage.delete();

                    embed.addFields([{ name: `Generated Response Approved by ${interaction.member.nickname} <t:${moment().unix()}:R>:`, value: generatedText }]);
                    await interaction.update({ embeds: [embed], components: [] });

                } else {
                    // User rejected the generated response
                    await tempResponseMessage.delete();
                    await interaction.update({ components: [...modmailOpenComponents] });
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