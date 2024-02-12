const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')
const { init } = require('./vetVerification');
const moment = require('moment')
var watchedModMails = []
const axios = require('axios')
const modmailGPTurl = require('../settings.json').modmailGPTurl

/**
 * @typedef ModmailData
 * @property {Discord.ButtonInteraction} interaction
 * @property {import('../data/guildSettings.701483950559985705.cache.json')} settings
 * @property {Discord.EmbedBuilder} embed
 * @property {Discord.GuildMember} raider
 * @property {import('mysql2').Pool} db
 * @property {Discord.Client} bot
 */
async function performModmailReply(guild, attachments, content, raider, messageId ) {
    const atmtInfo = attachments.map(a => `[${a.name}](${a.proxyURL})`).join('\n');
    const userEmbed = new Discord.EmbedBuilder()
        .setTitle('Modmail Response')
        .setColor(Discord.Colors.Red)
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() });

    if (attachments.size == 1 && attachments.first().contentType?.toLowerCase().startsWith('image')) {
        userEmbed.setImage(attachments.first().proxyURL);
    }
    else if (attachments.size >= 1) {
        userEmbed.addFields({ name: 'Attachments', value: atmtInfo });
        userEmbed.setDescription('See attachments');
    } 
    if (content.trim()) userEmbed.setDescription(content.trim())

    const directMessages = await raider.user.createDM();
    const userModmailMessage = await directMessages.messages.fetch(messageId);

    if (userModmailMessage) await userModmailMessage.reply({ embeds: [userEmbed] })
    else await directMessages?.send({ embeds: [userEmbed] })
}

const Modmail = {
    /** @param {ModmailData} options */
    async unlock({ settings, interaction }) {
        await interaction.update({ components: getOpenModmailComponents(settings) })
    },

    /** @param {ModmailData} options */
    async lock({ interaction }) {
        await interaction.update({ components: getCloseModmailComponents() })
    },

    /** @param {ModmailData} options */
    async send({ settings, interaction, interaction: { guild, channel, message, member }, embed, raider }) {

        const confirmEmbed = new Discord.EmbedBuilder()
            .setDescription(`__How would you like to respond to ${raider}'s [message](${message.url})__\n${embed.data.description}`)
            .setFooter({ text: 'Type \'cancel\' to cancel' })
            .setColor(Discord.Colors.Blue);

        const confirmResponse = await interaction.reply({ embeds: [confirmEmbed], fetchReply: true });
        
        /** @type {Discord.Message} */
        const { attachments, content, error } = await channel.next(null, null, member.id).catch(issue => issue);

        if (error) {
            await confirmResponse.delete();
            return await message.edit({ components: getOpenModmailComponents(settings) });
        }

        delete confirmEmbed.data.footer;

        const atmtInfo = attachments.map(a => `[${a.name}](${a.proxyURL})`).join('\n');
        confirmEmbed.setDescription(`__Are you sure you want to respond with the following?__\n${content.trim()}`)
        
        if (attachments.size == 1 && attachments.first().contentType?.toLowerCase().startsWith('image')) {
            confirmEmbed.setImage(attachments.first().proxyURL);
        }
        else if (attachments.size >= 1) {
            confirmEmbed.addFields({ name: 'Attachments', value: atmtInfo})
        }
        await confirmResponse.edit({ embeds: [confirmEmbed] });

        const performReply = await confirmResponse.confirmButton(member.id);
        confirmResponse.delete();
        if (performReply) {
            await performModmailReply(guild, attachments, content, raider, embed.data.footer.text.split(/ +/g)[5]);
            const respInfo = content.trim() + (attachments.size ? `\n**Attachments:**\n${atmtInfo}` : '' )

            embed.addFields({ name: `Response by ${member.displayName} <t:${moment().unix()}:R>:`, value: respInfo })
            await message.edit({ embeds: [embed], components: [] });
        } else {
            message.edit({ components: getOpenModmailComponents(settings) })
        }
    },

    /** @param {ModmailData} options */
    async forward({ settings, interaction, interaction: { guild, message, member }, embed, raider }) {
        const forwardChannel = guild.channels.cache.get(settings.channels.forwardedModmailMessage);

        const confirmationEmbed = new Discord.EmbedBuilder()
            .setTitle('Modmail Forward')
            .setColor(Discord.Colors.Blue);

        if (forwardChannel) {
            confirmationEmbed.setDescription(`__Are you sure you want to forward ${raider}'s [message](${message.url}) to ${forwardChannel}?__\n${embed.data.description}`);
            const confirmMessage = await interaction.reply({ embeds: [confirmationEmbed], fetchReply: true });
            const result = await confirmMessage.confirmButton(member.id);
            confirmMessage.delete();
            if (result) {
                const forwardEmbed = new Discord.EmbedBuilder()
                    .setColor(Discord.Colors.Red)
                    .setDescription(message.embeds[0].data.description)
                    .setFooter({ text: `Forwarded by ${member.displayName} • Modmail send at` })
                    .setTimestamp(new Date(message.embeds[0].data.timestamp));
                const forwardMessage = await forwardChannel.send({ embeds: [forwardEmbed] });
                if (settings.backend.forwadedMessageThumbsUpAndDownReactions) {
                    await forwardMessage.react('👍')
                    await forwardMessage.react('👎')
                }
                embed.addFields({ name: `${member.displayName} forwarded this modmail <t:${moment().unix()}:R>`, value: `This modmail has been forwarded to ${forwardChannel}` });
                await message.edit({ embeds: [embed], components: [] });
            } else {
                await message.edit({ components: getOpenModmailComponents(settings) });
            }
        } else {
            confirmationEmbed.setDescription('There is no modmail forward channel configured for this server.')
                .setColor(Discord.Colors.Red)
                .setFooter({ text: interaction.customId });
            
            await interaction.reply({ embeds: [confirmationEmbed] });
            await message.edit({ components: getOpenModmailComponents(settings) });
        }
    },

    /** @param {ModmailData} options */
    async close({ interaction, interaction: { message, member }, embed }) {
        const confirmEmbed = new Discord.EmbedBuilder()
            .setTitle('Modmail Close')
            .setDescription(`This will close the modmail permanently.\nIf you wish to send a message after closing, use the \`\`;mmr\`\` command to send a message to this modmail`)
            .setColor(Discord.Colors.Blue); 

        const confirmMessage  = await interaction.reply({ embeds: [confirmEmbed], fetchReply: true });
        const result = await confirmMessage.confirmButton(member.id);
        await confirmMessage.delete();
        if (result) {
            embed.addFields({ name: `${member.displayName} has closed this modmail <t:${moment().unix()}:R>`, value: `This modmail has been closed` });
            await message.edit({ embeds: [embed], components: [] });
        } else {
            message.edit({ components: getOpenModmailComponents(settings) });
        }
    },

    /** @param {ModmailData} options */
    async blacklist({ settings, db, interaction, interaction: { message, member }, raider, embed }) {
        const confirmEmbed = new Discord.EmbedBuilder()
            .setTitle('Modmail Blacklist')
            .setDescription(`This will blacklist ${raider}. They will no longer be able to send any modmails. Are you sure you want to do this?`)
            .setColor(Discord.Colors.Blue);

        const confirmMessage = await interaction.reply({ embeds: [confirmEmbed], fetchReply: true });
        const result = await confirmMessage.confirmButton(member.id);
        await confirmMessage.delete();
        if (result) {
            await db.promise().query(`INSERT INTO modmailblacklist (id) VALUES (?)`, [raider.id]);
            embed.addFields({ name: `${member.displayName} has blacklisted ${raider.nickname} <t:${moment().unix()}:R>`, value: `${raider} has been blacklisted by ${member}` });
            await message.edit({ embeds: [embed], components: [] });
        } else {
            await message.edit({ components: getOpenModmailComponents(settings) });
        }
    },

    /** @param {ModmailData} options */
    async gpt({ settings, interaction, interaction: { guild, message, member }, embed }) {
        const originalModmail = embed.data.description.replace(/<@!\d+?>/g, '').replace(' **sent the bot**\n', '').replace('\t', '');

        const reply = await interaction.deferReply();
        const { response: { data: { response } } } = await axios.post(modmailGPTurl, { modmail: originalModmail });
        
        const confirmEmbed = new Discord.EmbedBuilder()
            .setTitle('Modmail GPT Generated Response')
            .setDescription(`Generated text: ${response}`)
            .setColor(Discord.Colors.Blue);

        const confirmMessage = await reply.edit({ embeds: [confirmEmbed] });
        const result = await confirmMessage.confirmButton(member.id);
        await confirmMessage.delete();

        if (result) {
            await performModmailReply(guild, new Collection(), response, raider, embed.data.footer.text.split(/ +/g)[5]);

            embed.addFields({ name: `Generated Response Approved by ${member.displayName} <t:${moment().unix()}:R>:`, value: response });
            await message.edit({ embeds: [embed], components: [] });
        } else {
            message.edit({ components: getOpenModmailComponents(settings) });
        }
    }
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
    if (!settings.backend.modmail) return interaction.reply(`Modmail is disabled in this server.`);

    const embed = Discord.EmbedBuilder.from(interaction.message.embeds[0]);
    const raider = interaction.guild.members.cache.get(embed.data.footer.text.split(/ +/g)[2])
    
    if (!raider) {
        embed.addFields({ name: `This modmail has been closed automatically <t:${moment().unix()}:R>`, value: `The raider in this modmail is no longer in this server.\nI can no longer proceed with this modmail`, inline: false })
        interaction.update({ embeds: [embed], components: [] })
        return
    }

    /** @type {ModmailData} */
    const modmailData = { interaction, settings, embed, raider, db, bot }

    switch (interaction.customId) {
        case 'modmailUnlock': await Modmail.unlock(modmailData); break;
        case 'modmailLock': await Modmail.lock(modmailData); break;
        case 'modmailSend': await Modmail.send(modmailData); break;
        case 'modmailForward': await Modmail.forward(modmailData); break;
        case 'modmailClose': await Modmail.close(modmailData); break;
        case 'modmailBlacklist': await Modmail.blacklist(modmailData); break;
        case 'modmailGPT': await Modmail.gpt(modmailData); break;
        default:
        const failEmbed = new Discord.EmbedBuilder()
            .setTitle('Modmail Interaction Failure')
            .setDescription(`${interaction.member} Something went wrong when trying to handle your interaction\nPlease try again or contact any Upper Staff to get this sorted out.\nThank you for your patience!`)
            .setColor(Discord.Colors.Red)
            .setFooter({ text: `${interaction.customId}` });
        await interaction.reply({ embeds: [failEmbed] });
    }
}

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
        const [rows] = await db.promise().query('SELECT * FROM modmailblacklist WHERE id = ?', [message.author.id]);
        if (rows.length) return await message.author.send('You have been blacklisted from modmailing.');
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
    Modmail
}