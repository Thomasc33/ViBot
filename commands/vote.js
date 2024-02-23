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
            description: 'The role that the vote is for'
        }),
        slashArg(SlashArgType.String, 'users', {
            description: 'The users (space seperated) that will be up for a vote'
        }),
    ],
    varargs: true,
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    async execute(message, args, bot) {
        const { guild, channel } = message;
        const role = message.options.getRole('role');
        const settingsRoleName = Object.keys(bot.settings[guild.id].roles).find(roleName => bot.settings[guild.id].roles[roleName] == role.id) || null;
        const embedStyling = voteConfig.templates.find(template => template.settingRole === settingsRoleName) || null;

        const voteSetup = new VoteSetup({
            channel,
            feedbacks: [],
            role,
            settingsRoleName,
            embedStyling,
            members: message.options.getString('users').split(' ').concat(message.options.getVarargs() || []).map(member => guild.findMember(member)).filter(member => member != undefined)
        });

        if (voteSetup.members.length == 0) { return await message.reply('No members found.'); }
        await getFeedbacks(guild, bot.settings[guild.id], voteSetup);

        const embed = getSetupEmbed(voteSetup);
        const voteSetupButtons = generateVoteSetupButtons(bot);
        const voteSetupMessage = await message.channel.send({ embeds: [embed], components: [voteSetupButtons] });
        if (!message.isInteraction) await message.delete();
        else { await message.deferReply(); await message.deleteReply(); }

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
                let index = includedFeedbacks.length + 1;
                const addSelectionMenu = new Discord.StringSelectMenuBuilder()
                    .setCustomId('voteAddFeedbacks')
                    .setPlaceholder('Feedbacks to add')
                    .setMinValues(1)
                    .setMaxValues(addableFeedbacks.length)
                    .addOptions(addableFeedbacks.map(feedback => ({
                        label: `${index++}. ${feedback.dungeon?.tag || '??'} ${feedback.tier?.tag || '??'}`,
                        value: feedback.messageID
                    })));

                const actionRow = new Discord.ActionRowBuilder()
                    .addComponents(addSelectionMenu);

                const reply = await interaction.reply({ content: 'Select the feedbacks to add, times out after 2 minutes.', components: [actionRow], ephemeral: true, fetchReply: true });
                try { // what is CollectorOptions.dispose? https://discord.js.org/docs/packages/discord.js/14.14.1/CollectorOptions:Interface#dispose
                    const replyResponse = await reply.awaitMessageComponent({ componentType: Discord.ComponentType.StringSelect, time: 120000, filter: i => i.user.id == interaction.member.id });
                    await replyResponse.deferUpdate();
                    // array of message IDs
                    replyResponse.values.forEach(messageID => {
                        const feedback = voteSetup.feedbacks.find(feedback => feedback.messageID == messageID);
                        feedback.feedbackState = FeedbackState.Included;
                    });
                    await interaction.deleteReply(reply.id);
                } catch (error) {
                    interaction.editReply({ content: 'Timed out', components: [] });
                    break;
                }
                await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [generateVoteSetupButtons(bot)] });
                break;
            }
            case 'voteRemoveFeedbacks': {
                const { includedFeedbacks } = sortMemberFeedbacks(voteSetup);
                if (includedFeedbacks.length == 0) {
                    interaction.deferUpdate();
                    break;
                }
                let index = 1;
                const addSelectionMenu = new Discord.StringSelectMenuBuilder()
                    .setCustomId('voteRemoveFeedbacks')
                    .setPlaceholder('Feedbacks to remove')
                    .setMinValues(1)
                    .setMaxValues(includedFeedbacks.length)
                    .addOptions(includedFeedbacks.map(feedback => ({
                        label: `${index++}. ${feedback.dungeon?.tag || '??'} ${feedback.tier?.tag || '??'}`,
                        value: feedback.messageID
                    })));

                const actionRow = new Discord.ActionRowBuilder()
                    .addComponents(addSelectionMenu);

                const reply = await interaction.reply({ content: 'Select the feedbacks to remove, times out after 2 minutes.', components: [actionRow], ephemeral: true, fetchReply: true });
                try {
                    const replyResponse = await reply.awaitMessageComponent({ componentType: Discord.ComponentType.StringSelect, time: 120000, filter: i => i.user.id == interaction.member.id });
                    await replyResponse.deferUpdate();
                    // array of message IDs
                    replyResponse.values.forEach(messageID => {
                        const feedback = voteSetup.feedbacks.find(feedback => feedback.messageID == messageID);
                        feedback.feedbackState = FeedbackState.Other;
                    });
                    await interaction.deleteReply(reply.id);
                } catch (error) {
                    interaction.editReply({ content: 'Timed out', components: [] });
                    break;
                }
                await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [generateVoteSetupButtons(bot)] });
                break;
            }
            default:
                console.log('Invalid choice');
                break;
        }
    }
};

/**
 * Represents vote data to be stored in case of restarts
 * @class
 */
class VoteSetup {
    /**
     * Constructs a new VoteSetup object.
     * @constructor
     * @param {Object} options - The vote configuration options.
     * @param {Channel} options.channel - The channel for the vote.
     * @param {FeedbackData[]} options.feedbacks - the feedbacks for the vote.
     * @param {Array<Discord.Member>} options.members - The members to be voted on.
     * @param {Role} options.role - The role associated with the vote.
     * @param {string} options.settingsRoleName - The role name associated with the vote.
     * @param {Object} options.embedStyling - The embed styling for the vote.
     */
    constructor({ channel, feedbacks, members, role, settingsRoleName, embedStyling }) {
        this.channel = channel;
        this.feedbacks = feedbacks;
        this.members = members;
        this.role = role;
        this.settingsRoleName = settingsRoleName;
        this.embedStyling = embedStyling;
        this.currentMemberIndex = 0;
    }
}

/**
 * Generates the confirmation message for the vote configuration.
 * @param {Discord.Member} member - The member generating the confirmation message.
 * @param {Object} emojiDatabase - The emoji database.
 * @returns {string} The confirmation message for the vote configuration.
 */
function getSetupEmbed(voteSetup) {
    const member = voteSetup.members[voteSetup.currentMemberIndex];
    const embed = new Discord.EmbedBuilder()
        .setColor(voteSetup.embedStyling ? voteSetup.embedStyling.embedColor : voteSetup.role.hexColor)
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
        ...generateDisplayFields(includedFeedbacks, 1, 'Included Feedback:', getSetupDisplayString),
        ...generateDisplayFields(unidentifiedFeedbacks, 1 + includedFeedbacks.length, 'Unidentified Feedback:', getSetupDisplayString),
        ...generateDisplayFields(otherFeedbacks, 1 + includedFeedbacks.length + unidentifiedFeedbacks.length, 'Other Feedback:', getSetupDisplayString)
    ];
    embed.addFields(feedbackFields);
    return embed;
}

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

function getSetupDisplayString(index, feedback) {
    const tags = (`${feedback.dungeon?.tag || '??'} ${feedback.tier?.tag || '??'}`).padStart(11);
    return `\`${index}.\` \`${tags}\` ${feedback.feedbackURL} <t:${feedback.timeStamp}:f>`;
}

function getVoteDisplayString(index, feedback) {
    const tags = (`${feedback.dungeon?.tag || '??'} ${feedback.tier?.tag || '??'}`).padStart(11);
    return `\`${index}.\` \`${tags}\` ${feedback.feedbackURL} <t:${feedback.timeStamp}:d>`;
}

function generateDisplayFields(feedbacks, startIndex, name, getDisplayString) {
    const feedbackFields = [];
    let currentField = {
        name,
        value: ''
    };

    feedbacks.forEach(feedback => {
        const feedbackString = getDisplayString(startIndex++, feedback);
        if (currentField.value.length + feedbackString.length > 1024) {
            feedbackFields.push(currentField);
            currentField = {
                name,
                value: feedbackString
            };
        } else {
            currentField.value += feedbackString + '\n';
        }
    });

    if (currentField.value !== '') feedbackFields.push(currentField);
    else feedbackFields.push({ name, value: 'None' });
    return feedbackFields;
}

async function sendVote(voteSetup) {
    const member = voteSetup.members[voteSetup.currentMemberIndex];
    const embed = new Discord.EmbedBuilder()
        .setColor(voteSetup.embedStyling ? voteSetup.embedStyling.embedColor : voteSetup.role.hexColor)
        .setAuthor({ name: `${member.displayName} to ${voteSetup.role.name}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setDescription(`${member} \`${member.displayName}\``);
    if (voteSetup.embedStyling) { embed.setThumbnail(voteSetup.embedStyling.image); }
    const { includedFeedbacks } = sortMemberFeedbacks(voteSetup);
    embed.addFields(generateDisplayFields(includedFeedbacks, 1, 'Feedback:', getVoteDisplayString));
    const voteMessage = await voteSetup.channel.send({ embeds: [embed] });
    for (const emoji of ['✅', '❌', '👀']) { voteMessage.react(emoji); }
}

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
async function getFeedbacks(guild, settings, voteSetup) {
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

    const filteredMessages = messages.filter(message => voteSetup.members.some(member => message.mentions.users.has(member.id)));
    //* @type {Feedback[]} */
    voteSetup.feedbacks = filteredMessages.map(message => {
        const mentionedIDs = message.mentions.users.map(user => user.id);
        const firstLine = message.content.split('\n')[0].toLowerCase(); // Convert to lowercase for searching
        const dungeon = voteConfig.feedbackTypes.dungeon.find(dungeon => dungeon.flags.some(flag => firstLine.includes(flag)));
        const tier = voteConfig.feedbackTypes.tier.find(tier => tier.flags.some(flag => firstLine.includes(flag)));
        let feedbackState = FeedbackState.Other;
        if (!tier || !dungeon) {
            feedbackState = FeedbackState.Unidentified;
        } else if (tier.roles.includes(voteSetup.settingsRoleName) && dungeon.roles.includes(voteSetup.settingsRoleName)) {
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
