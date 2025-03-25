const Discord = require('discord.js');
const voteConfig = require('../data/voteConfig.json');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

/**
* @typedef FeedbackType
* @property {string[]} flags
* @property {string} emoji
* @property {string[]} roles
*/
/**
 * @typedef FeedbackData
 * @property {string} messageID
 * @property {FeedbackType} tier
 * @property {FeedbackType} dungeon
 * @property {string[]} mentionedIDs
 * @property {string} feedbackURL
 * @property {number} timeStamp
 * @property {FeedbackState} feedbackState
 */
/**
 * @typedef VoteSetup
 * @property {Discord.TextChannel} channel
 * @property {FeedbackData[]} feedbacks
 * @property {Discord.Role} role
 * @property {Object} storedEmojis
 * @property {string} settingsRoleName
 * @property {Object} embedStyling
 * @property {Discord.Member[]} members
 * @property {number} currentMemberIndex
 */

const FeedbackState = { Included: 0, Unidentified: 1, Other: 2 };
// notes:
// the filtering goes based of the first line of the message, so if someone is giving feedback to multiple people in the same message (feedback on feedback for fullskips), it may get mistagged
// fullskip feedbacks are a little bit difficult to identify correctly, since they are not always tagged with the role
module.exports = {
    name: 'vote',
    role: 'headrl',
    requiredArgs: 2,
    description: 'Puts up a vote for the person based on your role input',
    args: [
        slashArg(SlashArgType.Role, 'role', {
            description: 'The role that the vote is for',
            required: true
        }),
        slashArg(SlashArgType.User, 'user', {
            description: 'User to put up for vote',
            required: true
        }),
        ...Array(14).fill(0).map((_, index) => slashArg(SlashArgType.User, `user${index + 2}`, {
            description: 'User to put up for vote',
            required: false
        })),
    ],
    varargs: true,
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    async execute(message, args, bot) {
        const { guild, channel } = message;
        const role = message.options.getRole('role');
        const settingsRoleName = Object.keys(bot.settings[guild.id].roles).find(roleName => bot.settings[guild.id].roles[roleName] == role.id);
        const embedStyling = voteConfig.templates.find(template => template.settingRole === settingsRoleName);

        const voteSetup = {
            channel,
            feedbacks: [],
            role,
            storedEmojis: bot.storedEmojis,
            settingsRoleName,
            embedStyling,
            members: [message.options.getMember('user'), ...Array(14).fill(0).map((_, index) => message.options.getMember(`user${index + 2}`))].filter(m => m),
            currentMemberIndex: 0
        };

        if (voteSetup.members.length == 0) { return await message.reply('No members found.'); }
        voteSetup.feedbacks = await getFeedbacks(guild, bot.settings[guild.id], voteSetup.members, settingsRoleName);

        const embed = getSetupEmbed(voteSetup);
        const voteSetupButtons = generateVoteSetupButtons(bot);
        const voteSetupMessage = await message.channel.send({ embeds: [embed], components: [voteSetupButtons], fetchReply: true, ephemeral: true });
        if (!message.isInteraction) await message.delete();
        else { message.deferReply(); message.deleteReply(); }

        const interactionHandler = new Discord.InteractionCollector(
            bot,
            {
                message: voteSetupMessage,
                interactionType: Discord.InteractionType.MessageComponent,
                componentType: Discord.ComponentType.Button,
                filter: i => i.user.id == message.member.id
            });
        interactionHandler.on('collect', interaction => this.interactionHandler(bot, interaction, voteSetup));
    },
    /**
     * Handles interactions for the vote setup buttons
     * @param {Discord.Client} bot client with additions
     * @param {Discord.ButtonInteraction} interaction Receieved interaction, guaranteed to be from the command author
     * @param {VoteSetup} voteSetup vote setup data
     */
    async interactionHandler(bot, interaction, voteSetup) {
        switch (interaction.customId) {
            case 'voteSend':
                interaction.deferUpdate();
                await sendVote(voteSetup);
                voteSetup.currentMemberIndex++;
                if (voteSetup.currentMemberIndex >= voteSetup.members.length) {
                    await interaction.message.delete();
                } else {
                    await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [generateVoteSetupButtons(bot)] });
                }
                break;
            case 'voteSkip':
                voteSetup.currentMemberIndex++;
                if (voteSetup.currentMemberIndex >= voteSetup.members.length) {
                    await interaction.message.delete();
                } else {
                    await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [generateVoteSetupButtons(bot)] });
                }
                break;
            case 'voteAbort':
                await interaction.message.delete();
                break;
            case 'voteAddFeedbacks': {
                // idaa: add custom value with modal response
                // add function to grab custom feedback by message ID and process it
                // also make sure first 24 feedbacks show up in the select panel, since last is custom
                const { includedFeedbacks, unidentifiedFeedbacks, otherFeedbacks } = sortMemberFeedbacks(voteSetup);
                const addableFeedbacks = unidentifiedFeedbacks.concat(otherFeedbacks).slice(0, 25);
                interaction.deferUpdate();
                if (addableFeedbacks.length == 0) {
                    break;
                }
                let index = includedFeedbacks.length + 1;
                const selectRow = new Discord.ActionRowBuilder().addComponents(
                    new Discord.StringSelectMenuBuilder()
                        .setCustomId('voteAddFeedbacks')
                        .setPlaceholder('Feedbacks to add')
                        .setMinValues(1)
                        .setMaxValues(addableFeedbacks.length)
                        .addOptions(addableFeedbacks.map(feedback => ({
                            label: `${index++}. ${feedback.dungeon?.tag || '??'} ${feedback.tier?.tag || '??'}`,
                            value: feedback.messageID
                        }))));
                const buttonRow = new Discord.ActionRowBuilder().addComponents(
                    new Discord.ButtonBuilder()
                        .setLabel('Back')
                        .setStyle(4)
                        .setCustomId('goBack'));
                await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [buttonRow, selectRow] });
                try {
                    const selectMenuResponse = await interaction.message.awaitMessageComponent({ time: 120000, filter: i => i.user.id == interaction.member.id });
                    await selectMenuResponse.deferUpdate();
                    if (selectMenuResponse.customId == 'voteAddFeedbacks') {
                        selectMenuResponse.values.forEach(messageID => {
                            const feedback = voteSetup.feedbacks.find(feedback => feedback.messageID == messageID);
                            feedback.feedbackState = FeedbackState.Included;
                        });
                    }
                } catch (error) { }
                await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [generateVoteSetupButtons(bot)] });
                break;
            }
            case 'voteRemoveFeedbacks': {
                const { includedFeedbacks } = sortMemberFeedbacks(voteSetup);
                interaction.deferUpdate();
                if (includedFeedbacks.length == 0) {
                    break;
                }
                let index = 1;
                const selectRow = new Discord.ActionRowBuilder().addComponents(
                    new Discord.StringSelectMenuBuilder()
                        .setCustomId('voteRemoveFeedbacks')
                        .setPlaceholder('Feedbacks to remove')
                        .setMinValues(1)
                        .setMaxValues(includedFeedbacks.length)
                        .addOptions(includedFeedbacks.map(feedback => ({
                            label: `${index++}. ${feedback.dungeon?.tag || '??'} ${feedback.tier?.tag || '??'}`,
                            value: feedback.messageID
                        }))));
                const buttonRow = new Discord.ActionRowBuilder().addComponents(
                    new Discord.ButtonBuilder()
                        .setLabel('Back')
                        .setStyle(4)
                        .setCustomId('goBack'));
                await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [buttonRow, selectRow] });
                try {
                    const selectMenuResponse = await interaction.message.awaitMessageComponent({ time: 120000, filter: i => i.user.id == interaction.member.id });
                    await selectMenuResponse.deferUpdate();
                    if (selectMenuResponse.customId == 'voteRemoveFeedbacks') {
                        selectMenuResponse.values.forEach(messageID => {
                            const feedback = voteSetup.feedbacks.find(feedback => feedback.messageID == messageID);
                            feedback.feedbackState = FeedbackState.Other;
                        });
                    }
                } catch (error) { }
                await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [generateVoteSetupButtons(bot)] });
                break;
            }
            default:
                break;
        }
    }
};

/**
 * Generates the embed for the vote setup
 * @param {VoteSetup} voteSetup The vote setup data
 * @returns {Discord.EmbedBuilder} The embed for the vote setup
 */
function getSetupEmbed(voteSetup) {
    const member = voteSetup.members[voteSetup.currentMemberIndex];
    const embed = new Discord.EmbedBuilder()
        .setColor(voteSetup.embedStyling?.embedColor || voteSetup.role.hexColor)
        .setAuthor({
            name: `Vote Configuration ${voteSetup.currentMemberIndex + 1}/${voteSetup.members.length}`,
            iconURL: member.user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`
            Remaining members: ${voteSetup.members.slice(voteSetup.currentMemberIndex + 1).map(member => `<@${member.id}>`).join(' ') || 'None'}

            This vote will be for to <@${member.id}> to ${voteSetup.role}
        `);
    const { includedFeedbacks, unidentifiedFeedbacks, otherFeedbacks } = sortMemberFeedbacks(voteSetup);
    const feedbackFields = [
        ...generateDisplayFields(includedFeedbacks, 1, 'Included Feedback:', voteSetup.storedEmojis),
        ...generateDisplayFields(unidentifiedFeedbacks, 1 + includedFeedbacks.length, 'Unidentified Feedback:', voteSetup.storedEmojis),
        ...generateDisplayFields(otherFeedbacks, 1 + includedFeedbacks.length + unidentifiedFeedbacks.length, 'Other Feedback:', voteSetup.storedEmojis)
    ];
    embed.addFields(feedbackFields);
    return embed;
}

/**
 * Sorts the feedbacks for the current member, and returns the arrays in descending order
 * @param {VoteSetup} voteSetup The vote setup data
 * @returns {{includedFeedbacks: FeedbackData[], unidentifiedFeedbacks: FeedbackData[], otherFeedbacks: FeedbackData[]}} The sorted feedbacks
 */
function sortMemberFeedbacks(voteSetup) {
    const member = voteSetup.members[voteSetup.currentMemberIndex];
    const includedFeedbacks = [];
    const unidentifiedFeedbacks = [];
    const otherFeedbacks = [];
    // sort by timestamp desc (after push the newest feedback is at the highest index)
    voteSetup.feedbacks.filter(feedback => feedback.mentionedIDs.includes(member.id)).sort((a, b) => b.timeStamp - a.timeStamp).forEach(feedback => {
        if (feedback.feedbackState == FeedbackState.Included) {
            includedFeedbacks.push(feedback);
        } else if (feedback.feedbackState == FeedbackState.Unidentified) {
            unidentifiedFeedbacks.push(feedback);
        } else {
            otherFeedbacks.push(feedback);
        }
    });
    return { includedFeedbacks, unidentifiedFeedbacks, otherFeedbacks };
}

/**
 * Creates a string in the following format: `index. emoji tag feedbackURL timestamp`
 * @param {number} index starting index
 * @param {FeedbackData} feedback data for the feedback
 * @param {*} storedEmojis emoji
 * @returns {string}
 */
function getDisplayString(index, feedback, storedEmojis) {
    const emojiString = storedEmojis[feedback.dungeon?.emoji]?.text || storedEmojis.blunder.text;
    const tagString = `${feedback.tier?.tag || '??'}`.padStart(6);
    return `\`${index}.\` ${emojiString} \`${tagString}\` ${feedback.feedbackURL} <t:${feedback.timeStamp}:d>`;
}

/**
 * Creates the fields for a type of feedback, respecting field size limits
 * @param {FeedbackData[]} feedbacks filtered feedbacks to display
 * @param {number} startIndex the starting index to list feedbacks by
 * @param {string} fieldTitle title of the field
 * @param {*} storedEmojis emoji cache
 * @returns {Discord.EmbedField[]} The fields for the feedbacks
 */
function generateDisplayFields(feedbacks, startIndex, fieldTitle, storedEmojis) {
    const feedbackFields = [];
    let currentField = {
        name: fieldTitle,
        value: ''
    };

    feedbacks.forEach(feedback => {
        const feedbackString = getDisplayString(startIndex++, feedback, storedEmojis);
        if (currentField.value.length + feedbackString.length + 1 > 1024) {
            feedbackFields.push(currentField);
            currentField = {
                name: fieldTitle,
                value: feedbackString
            };
        } else {
            currentField.value += feedbackString + '\n';
        }
    });

    if (currentField.value !== '') feedbackFields.push(currentField);
    else feedbackFields.push({ name: fieldTitle, value: 'None' });
    return feedbackFields;
}

/**
 * send's the current member's vote
 * @param {VoteSetup} voteSetup the feedback data
 */
async function sendVote(voteSetup) {
    const member = voteSetup.members[voteSetup.currentMemberIndex];
    const embed = new Discord.EmbedBuilder()
        .setColor(voteSetup.embedStyling?.embedColor || voteSetup.role.hexColor)
        .setAuthor({ name: `${member.displayName} to ${voteSetup.role.name}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setDescription(`${member} \`${member.displayName}\``);
    if (voteSetup.embedStyling) { embed.setThumbnail(voteSetup.embedStyling.image); }
    const { includedFeedbacks } = sortMemberFeedbacks(voteSetup);
    embed.addFields(generateDisplayFields(includedFeedbacks, 1, 'Feedback:', voteSetup.storedEmojis));
    const voteMessage = await voteSetup.channel.send({ embeds: [embed] });
    for (const emoji of ['✅', '❌', '👀']) { voteMessage.react(emoji); }
}

/**
 * generates the buttons with ids for the vote setup
 * @param {Discord.Client} bot client with additions
 * @returns {Discord.ActionRowBuilder}
 */
function generateVoteSetupButtons(bot) {
    return new Discord.ActionRowBuilder()
        .addComponents([
            new Discord.ButtonBuilder()
                .setLabel('✅ Send')
                .setStyle(3)
                .setCustomId('voteSend'),
            new Discord.ButtonBuilder()
                .setLabel('❌ Skip')
                .setStyle(1)
                .setCustomId('voteSkip'),
            new Discord.ButtonBuilder()
                .setLabel('Add')
                .setStyle(2)
                .setEmoji(bot.storedEmojis.feedback.id)
                .setCustomId('voteAddFeedbacks'),
            new Discord.ButtonBuilder()
                .setLabel('Remove')
                .setStyle(2)
                .setEmoji(bot.storedEmojis.feedback.id)
                .setCustomId('voteRemoveFeedbacks'),
            new Discord.ButtonBuilder()
                .setLabel('❌ Abort')
                .setStyle(4)
                .setCustomId('voteAbort')
        ]);
}

/**
 * returns categorized feedbacks for the members
 * @param {Discord.Member[]} members Members to find feedbacks for
 * @param {Discord.Guild} guild Guild to find feedbacks in
 * @param {*} bot
 * @returns {Promise<FeedbackData[]>} The feedbacks for the members.
 */
async function getFeedbacks(guild, settings, members, settingsRoleName) {
    async function fetchMessages(limit) {
        const sumMessages = [];
        const feedbackChannel = guild.channels.cache.get(settings.channels.rlfeedback);
        for (let i = 0; i <= limit; i += 100) {
            const options = { limit: 100, before: i > 0 ? sumMessages[sumMessages.length - 1].id : null };
            // eslint-disable-next-line no-await-in-loop
            const fetchedMessages = await feedbackChannel.messages.fetch(options);
            sumMessages.push(...fetchedMessages.map(m => m));
            if (fetchedMessages.size != 100) break;
        }
        return sumMessages;
    }
    const messages = await fetchMessages(500);

    const filteredMessages = messages.filter(message => members.some(member => message.mentions.users.has(member.id)));
    //* @type {Feedback[]} */
    return filteredMessages.map(message => {
        const mentionedIDs = message.mentions.users.map(user => user.id);
        const firstLine = message.content.split('\n')[0].toLowerCase(); // Convert to lowercase for searching
        const dungeon = voteConfig.feedbackTypes.dungeon.find(dungeon => dungeon.flags.some(flag => firstLine.includes(flag)));
        const tier = voteConfig.feedbackTypes.tier.find(tier => tier.flags.some(flag => firstLine.includes(flag)));
        let feedbackState = FeedbackState.Other;
        if (!tier || !dungeon) {
            feedbackState = FeedbackState.Unidentified;
        } else if (tier.roles.includes(settingsRoleName) && dungeon.roles.includes(settingsRoleName)) {
            feedbackState = FeedbackState.Included;
        }
        return {
            messageID: message.id,
            tier,
            dungeon,
            mentionedIDs,
            feedbackURL: message.url,
            timeStamp: (message.createdTimestamp / 1000).toFixed(0),
            feedbackState
        };
    });
}
