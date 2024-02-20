const Discord = require('discord.js');
const voteConfig = require('../data/voteConfig.json');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');
const { createReactionRow } = require('../redis.js');
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

        const voteSetup = new VoteSetup({
            channel,
            feedbacks: [],
            role: message.options.getRole('role'),
            members: message.options.getString('users').split(' ').concat(message.options.getVarargs() || []).map(member => guild.findMember(member)).filter(member => member != undefined)
        });

        if (voteSetup.members.length == 0) { return await message.reply('No members found.'); }
        await getFeedbacks(guild, bot, voteSetup);

        const embed = getSetupEmbed(voteSetup);
        const voteSetupButtons = generateVoteSetupButtons(bot);
        const voteSetupMessage = await message.reply({ embeds: [embed], components: [voteSetupButtons] });
        createReactionRow(voteSetupMessage, module.exports.name, 'interactionHandler', voteSetupButtons, message.author, voteSetup.toJSON());
    },
    async interactionHandler(bot, message, db, choice, voteSetupJSON, updateState) {
        const interaction = message.interaction; // eslint-disable-line prefer-destructuring
        const member = interaction.member; // eslint-disable-line prefer-destructuring
        const voteSetup = VoteSetup.fromJSON(interaction.guild, voteSetupJSON);
        switch (choice) {
            case 'voteSend':
                await startVote(bot.settings[interaction.guild.id], voteSetup, member);
                // move index to next member
                // if last member in array, delete the message
                break;
            case 'voteSkip':
                // move index to next member
                // if last member in array, delete the message
                break;
            case 'voteAbort':
                await message.delete();
                break;
            case 'voteAddFeedbacks': {
                const { includedFeedbacks, unidentifiedFeedbacks, otherFeedbacks } = sortMemberFeedbacks(voteSetup.feedbacks, member);
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

                const reply = await interaction.reply({ content: 'Test string', components: [actionRow], ephemeral: true, fetchReply: true });
                const replyResponse = await reply.awaitMessageComponent({ componentType: Discord.ComponentType.StringSelect, time: 120000, filter: i => i.user.id == member.id }); // TODO add a timeout
                await replyResponse.deferUpdate();
                // array of message IDs
                console.log(replyResponse.values);
                console.log(reply.id);
                // delete the ephemeral message
                await interaction.deleteReply(reply.id);
                // TODO finish collecting feedbacks and altering the displayState on voteSetup
                // TODO add custom value with modal response
                // add function to grab custom feedback by message ID and process it

                // example from previous code
                // voteSetup.maximumFeedbacks = choice;
                // await updateState('maximumFeedbacks', choice);
                await interaction.message.edit({ embeds: [getSetupEmbed(voteSetup)], components: [generateVoteSetupButtons(bot)] });
                console.log('updated Interaction');
                break;
            }
            case 'voteRemoveFeedbacks': {
                // copy above code and change the filter to show only included feedbacks, no custom option on selectPanel
                break;
            }
            default:
                console.log('Invalid choice', choice);
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
     */
    constructor({ channel, feedbacks, members, role }) {
        this.channel = channel;
        this.feedbacks = feedbacks;
        this.members = members;
        this.role = role;
    }

    static fromJSON(guild, json) {
        return new this({
            ...json,
            channel: guild.channels.cache.get(json.channel),
            members: json.members.map(memberId => guild.members.cache.get(memberId)),
            role: guild.roles.cache.get(json.role)
        });
    }

    toJSON() {
        return {
            channel: this.channel.id,
            feedbacks: this.feedbacks,
            members: this.members.map(m => m.id),
            role: this.role.id
        };
    }
}

/**
 * Generates the confirmation message for the vote configuration.
 * @param {Discord.Member} member - The member generating the confirmation message.
 * @param {Object} emojiDatabase - The emoji database.
 * @returns {string} The confirmation message for the vote configuration.
 */
function getSetupEmbed(voteSetup) {
    const member = voteSetup.members[0];
    const embed = new Discord.EmbedBuilder()
        .setColor(member.roles.highest.hexColor)
        .setAuthor({
            name: 'Vote Configuration',
            iconURL: member.user.displayAvatarURL({ dynamic: true })
        })
        .setDescription(`
            This vote will be for to <@${member.id}> to ${voteSetup.role}
        `);
    const { includedFeedbacks, unidentifiedFeedbacks, otherFeedbacks } = sortMemberFeedbacks(voteSetup.feedbacks, member);
    let index = 1;
    // TODO add length check for 1024 character limit, add <type> feedback two as name and continue list
    embed.addFields([{
        name: 'Included Feedback:',
        value: includedFeedbacks.map(feedback => getDisplayString(index++, feedback)).join('\n') || 'None'
    },
    {
        name: 'Unknown Tags:',
        value: unidentifiedFeedbacks.map(feedback => getDisplayString(index++, feedback)).join('\n') || 'None'
    },
    {
        name: 'Other Feedback:',
        value: otherFeedbacks.map(feedback => getDisplayString(index++, feedback)).join('\n') || 'None'
    }]);
    return embed;
}

function sortMemberFeedbacks(feedbacks, member) {
    const includedFeedbacks = [];
    const unidentifiedFeedbacks = [];
    const otherFeedbacks = [];
    // sort by timestamp desc (after push the newest feedback is at the highest index)
    feedbacks.filter(feedback => feedback.mentionedIDs.includes(member.id)).sort((a, b) => b.timeStamp - a.timeStamp).forEach(feedback => {
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

function getDisplayString(index, feedback) {
    const tags = (`${feedback.dungeon?.tag || '??'} ${feedback.tier?.tag || '??'}`).padStart(11);
    return `\`${index}.\` \`${tags}\` ${feedback.feedbackURL} <t:${feedback.timeStamp}:f>`;
}

function getRoleSettingsName(settings, role) {
    return Object.keys(settings.roles).find(roleName => settings.roles[roleName] == role.id);
}

async function startVote(settings, voteSetup, member) {
    const roleSettingsName = getRoleSettingsName(settings, voteSetup.role);
    if (!roleSettingsName) { return; }
    const embedStyling = voteConfig.templates
        .find(template => template.settingRole === roleSettingsName);
    let embedColor = voteSetup.role.hexColor;
    if (embedStyling != undefined && embedStyling.embedColor) { embedColor = embedStyling.embedColor; }
    const embed = new Discord.EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: `${member.displayName} to ${voteSetup.role.name}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setDescription(`${member} \`${member.displayName}\``);
    if (embedStyling != undefined && embedStyling.image) { embed.setThumbnail(embedStyling.image); }
    const feedbacks = voteSetup.feedbacks.filter(feedback => feedback.mentionedIDs.includes[member.id] && feedback.feedbackState == FeedbackState.Included);
    embed.addFields({
        name: 'Feedback:',
        value: getDisplayString(feedbacks) || 'None'
    });
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
async function getFeedbacks(guild, bot, voteSetup) {
    // TODO clean up settings usages, it's only one guild settings ever
    async function fetchMessages(limit) {
        const sumMessages = [];
        const feedbackChannel = guild.channels.cache.get(bot.settings[guild.id].channels.rlfeedback);
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
        const roleSettingsName = getRoleSettingsName(bot.settings[guild.id], voteSetup.role);
        let feedbackState = FeedbackState.Other;
        if (!tier || !dungeon) {
            feedbackState = FeedbackState.Unidentified;
        } else if (tier.roles.includes(roleSettingsName) && dungeon.roles.includes(roleSettingsName)) {
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
