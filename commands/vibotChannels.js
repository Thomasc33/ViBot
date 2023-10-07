const Discord = require('discord.js')
const fs = require('fs')
const botSettings = require('../settings.json')
const ErrorLogger = require('../lib/logError')
const vibotChannel = require('./vibotChannels.js')
const modmail = require('./modmail.js')
const roleassignment = require('./roleAssignment.js')
const watchedMessages = []
const watchedButtons = {} // the keys for this are the id of a VC
// {VC_ID: {hndlr: ACTIVATE_CHANNEL_MESSAGE_HANDLER,
//          confirm_hndlrs: EPHMRL_CONFIRMATION_MESSAGE_HANDLERS}
// }
let afkCheckModule // if a channel is closed while the afk check is active
// we need to abort the run
// since afkCheck.js requires this module already we have
// afkCheck.js register itself here the first time someone
// uses the afk command

module.exports = {
    name: 'vibotchannels',
    description: 'update',
    role: 'developer',
    async execute(message, args, bot, db) {
        if (args[0].toLowerCase() == 'update') this.update(message.guild, bot, db)
    },
    async update(guild, bot, db) {
        const settings = bot.settings[guild.id]
        await updateModmailListeners(guild.channels.cache.get(settings.channels.modmail), settings, bot, db)
        await updateRoleAssignmentListeners(guild.channels.cache.get(settings.channels.roleassignment), settings, bot, db)
        async function updateModmailListeners(modmailChannel, settings, bot, db) {
            if (!modmailChannel) { return } // If there is no modmail channel it will not continue
            const modmailChannelMessages = await modmailChannel.messages.fetch() // This fetches all the messages in the modmail channel
            modmailChannelMessages.each(async modmailMessage => { // This will loop through the modmail channel messages
                if (modmailMessage.author.id !== bot.user.id) return // If the modmail message author is not the same id as ViBot it will not continue with this message
                if (modmailMessage.embeds.length == 0) return // If the message has no embeds it will not continue
                const embed = new Discord.EmbedBuilder() // This creates a empty embed, able to be edited later
                embed.data = modmailMessage.embeds[0].data // This will change the empty embed to have the modmailMessage embed data

                /*  We have a message -> check if it has no components
                    **EXPLANATION** When the modmail is done, its not supposed to have any components.
                    If it has any components at all, we will revert them to the basic "unlock" modmail
                */
                if (modmailMessage.components == 0) { return }
                // Anything below this code inside this function is for open modmails, and we need to reset them
                module.exports.addModmailUnlockButton(modmailMessage, settings, bot, db) // This will add a modmail "unlock" button to the modmailMessage
            })
        }
        async function updateRoleAssignmentListeners(roleassignmentChannel, settings, bot, db) {
            if (!settings.backend.roleassignment) return
            if (!roleassignmentChannel) { return } // If there is no roleassignment channel it will not continue
            const roleassignmentChannelMessages = await roleassignmentChannel.messages.fetch() // This fetches all the messages in the roleassignment channel
            roleassignmentChannelMessages.each(async message => { // This will loop through the roleassignment channel messages
                if (message.author.id !== bot.user.id) return // If the roleassignment message author is not the same id as ViBot it will not continue with this message
                if (message.embeds.length == 0) return // If the message has no embeds it will not continue
                const embed = new Discord.EmbedBuilder() // This creates a empty embed, able to be edited later
                embed.data = message.embeds[0].data // This will change the empty embed to have the message embed data

                /*  We have a message -> check if it has no components
                    **EXPLANATION** roleassignment message is supposed to have components
                */
                if (message.components == 0) { return }
                // Anything below this code inside this function is for roleassignment messages, and we need to reset them
                roleassignment.addInteractionButtons(message, bot) // This will add a roleassignment button listeners to the message
            })
        }
        for (const i in bot.afkChecks) {
            if (!guild.channels.cache.get(i)) delete bot.afkChecks[i]
            if (watchedButtons[i] && bot.afkChecks[i].RSAMessagePacket) {
                const rsa_m = await getAFKChannelMessage(bot, guild, i)
                if (rsa_m) module.exports.addReconnectButton(bot, rsa_m, i)
            }
        }
        // fs.writeFile('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
        //     if (err) ErrorLogger.log(err, bot, guild)
        // })
    },
    async watchMessage(message, bot, settings) {
        let m = message
        const embed = new Discord.EmbedBuilder()
        embed.data = m.embeds[0].data
        if (watchedMessages.includes(embed.data.footer)) return
        watchedMessages.push(embed.data.footer)
        const channel = message.guild.channels.cache.get(embed.data.footer.text)
        if (!channel) return m.delete()
        const channelName = channel.name
        const reactionCollector = new Discord.ReactionCollector(m, { filter: xFilter })
        reactionCollector.on('collect', async (r, u) => {
            reactionCollector.stop()
            if (!m.mentions.members.first()) return remove()
            if (u.id == m.mentions.members.first().id) remove()
            else {
                await m.reactions.removeAll()
                await m.react('✅')
                await m.react('❌')
                embed.data.footer.text = `Opened By ${m.guild.members.cache.get(u.id).nickname || u.tag} • ${embed.data.footer.text}`
                message = m = await m.edit({ embeds: m.embeds })
                embed.data = message.embeds[0].data
                const confirmReactionCollector = new Discord.ReactionCollector(m, { filter: (r, uu) => (r.emoji.name === '✅' || r.emoji.name === '❌') && u.id == uu.id })

                confirmReactionCollector.on('collect', async (r, u) => {
                    if (r.emoji.name == '❌') {
                        await m.reactions.removeAll()
                        confirmReactionCollector.stop()
                        await m.react('❌')
                        m.embeds[0].footer.text = embed.data.footer.text.split(' ').pop()
                        message = m = await m.edit({ embeds: m.embeds })
                        embed.data = message.embeds[0].data
                        await this.update(m.guild, bot)
                    } else remove()
                })
            }
            async function remove() {
                for (const i in bot.afkChecks) {
                    const id = embed.data.footer.text.split(' ').pop()
                    if (i == id) {
                        const key = await message.guild.members.cache.get(bot.afkChecks[i].key)
                        if (key) {
                            const keyRole = await message.guild.roles.cache.get(settings.roles.tempkey)
                            await key.roles.remove(keyRole.id).catch(r => ErrorLogger.log(r, bot, message.guild))
                        }
                        delete bot.afkChecks[i]
                        fs.writeFile('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
                            if (err) ErrorLogger.log(err, bot, message.guild)
                        })
                    }
                }
                message.guild.channels.cache.get(settings.channels.history).send({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setDescription(`${channelName} deleted by <@!${u.id}>`)
                    ]
                })
                if (!channel) return
                await channel.delete().catch(er => { })
                await m.delete()
            }
        })
    },

    async addModmailUnlockButton(message, settings, bot, db) {
        if (message.components[0].components[0]?.customId != 'modmailUnlock') {
            const components = new Discord.ActionRowBuilder()
                .addComponents(new Discord.ButtonBuilder()
                    .setLabel('🔓 Unlock')
                    .setStyle(3)
                    .setCustomId('modmailUnlock'))
            message = await message.edit({ components: [components] })
        }
        modmailInteractionCollector = new Discord.InteractionCollector(bot, { message, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        modmailInteractionCollector.on('collect', (interaction) => modmail.interactionHandler(interaction, settings, bot, db))
    },

    async addCloseChannelButtons(bot, m, rsaMessage) {
        const ar = new Discord.ActionRowBuilder()
            .addComponents(new Discord.ButtonBuilder()
                .setLabel('Delete Channel')
                .setStyle(4)
                .setCustomId('delete'))
        m = await m.edit({ components: [ar] })
        const hndlr = m.createMessageComponentCollector({ componentType: Discord.ComponentType.Button })
        hndlr.on('collect', async (interaction) => closeChannelButtonsHandler(interaction, bot, rsaMessage))
        const button_manager = { hndlr, confirm_hndlrs: [], RSAMessage: undefined, reconnect_hndlr: undefined }
        watchedButtons[m.embeds[0].footer.text] = button_manager
    },
    async registerAFKCheck(afkCheckMod) {
        afkCheckModule = afkCheckMod
    },

    async deleteChannel(bot, vc_channel_id, run_title, who_closed, guild, active_channel_msg, ephemeral_response_interaction, rsaMessage) {
        watchedButtons[vc_channel_id].hndlr.stop()
        for (const i of watchedButtons[vc_channel_id].confirm_hndlrs) {
            i.stop()
        }
        if (watchedButtons[vc_channel_id].reconnect_hndlr) {
            watchedButtons[vc_channel_id].reconnect_hndlr.stop()
        }
        if (watchedButtons[vc_channel_id].RSAMessage) {
            watchedButtons[vc_channel_id].RSAMessage.edit({ components: [] })
        }
        await active_channel_msg.delete().then().catch(console.error)
        if (ephemeral_response_interaction) {
            await ephemeral_response_interaction.update({ content: `${run_title} has been deleted. Have a nice day!`, components: [] })
        }
        if (rsaMessage) { rsaMessage.edit({ content: '', components: [] }) }
        if (afkCheckModule) {
            const active_run = await afkCheckModule.returnRunByID(vc_channel_id)
            if (active_run) {
                await active_run.abortAfk(who_closed)
            }
        }
        delete (bot.afkChecks[vc_channel_id])
        fs.writeFile('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
            if (err) ErrorLogger.log(err, bot, message.guild)
        })
        const channel = guild.channels.cache.get(vc_channel_id)
        if (!channel) return
        await channel.delete().catch(er => { })
        if (bot.settings[guild.id].channels.history) {
            guild.channels.cache.get(bot.settings[guild.id].channels.history).send({
                embeds: [
                    new Discord.EmbedBuilder()
                        .setDescription(`${channel.name} deleted by ${who_closed}`)
                ]
            })
        }
        delete (watchedButtons[vc_channel_id])
    }
}

async function getAFKChannelMessage(bot, guild, vc_channel_id) {
    rsaMessageId = bot.afkChecks[vc_channel_id].RSAMessagePacket.messageId
    rsaChannelId = bot.afkChecks[vc_channel_id].RSAMessagePacket.channelId
    c = guild.channels.cache.get(rsaChannelId)
    if (!c) return undefined
    return await c.messages.fetch(rsaMessageId)
}

async function closeChannelButtonsHandler(interaction, bot, rsaMessage) {
    if (!interaction.isButton()) return
    if (interaction.customId === 'delete') {
        const confirm_buttons = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('Delete Channel')
                .setStyle(4)
                .setCustomId('delete_confirmed'),
            new Discord.ButtonBuilder()
                .setLabel('Cancel')
                .setStyle(2)
                .setCustomId('delete_cancel')
        ])
        if (bot.afkChecks[interaction.message.embeds[0].footer.text]
            && bot.afkChecks[interaction.message.embeds[0].footer.text].runType
            && bot.afkChecks[interaction.message.embeds[0].footer.text].runType.raidLeader === interaction.member.id) {
            interaction.deferUpdate()
            module.exports.deleteChannel(bot, interaction.message.embeds[0].footer.text, interaction.message.embeds[0].title, interaction.member, interaction.guild, interaction.message, rsaMessage)
        } else {
            await interaction.reply({
                content: `Are you sure you want to delete <#${interaction.message.embeds[0].footer.text}>? Only do this if the run is over.`,
                components: [confirm_buttons],
                ephemeral: true
            })
            const confirm_m = await interaction.fetchReply()
            const confirm_hndlr = confirm_m.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 30000 })
            confirm_hndlr.on('collect', async (new_interaction) => watchConfirmButtonsHandler(new_interaction, interaction, bot, confirm_hndlr, rsaMessage))
            watchedButtons[interaction.message.embeds[0].footer.text].confirm_hndlrs.push(confirm_hndlr)
        }
    }
}

async function watchConfirmButtonsHandler(interaction, prev_interaction, bot, this_hndlr, rsaMessage) {
    if (!interaction.isButton()) return
    if (interaction.customId === 'delete_confirmed') {
        module.exports.deleteChannel(bot, prev_interaction.message.embeds[0].footer.text, prev_interaction.message.embeds[0].title, interaction.member, interaction.guild, prev_interaction.message, interaction, rsaMessage)
    } else if (interaction.customId === 'delete_cancel') {
        await interaction.update({ content: 'ඞ', components: [] })
        for (let i = 0; i < watchedButtons[prev_interaction.message.embeds[0].footer.text].confirm_hndlrs.length; i++) {
            if (watchedButtons[prev_interaction.message.embeds[0].footer.text].confirm_hndlrs[i] === this_hndlr) {
                this_hndlr.stop()
                watchedButtons[prev_interaction.message.embeds[0].footer.text].confirm_hndlrs.splice(i, 1)
                return
            }
        }
    }
}

const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot
