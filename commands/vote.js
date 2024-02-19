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
// TODO clean up unused properties
/**
 * @typedef FeedbackData
 * @property {string} feedbackContent
 * @property {FeedbackType} tier
 * @property {FeedbackType} dungeon
 * @property {string} firstLine
 * @property {string} mentionedID
 * @property {string} feedbackURL
 * @property {string} feedbackerID
 * @property {number} timeStamp
 * @property {FeedbackState} displayState
 */

/**
 * @enum {number}
 */
const FeedbackState = {
    Included: 1,
    Unidentified: 0,
    Other: -1
};

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
        await getFeedbacks(voteSetup.members, guild, bot, voteSetup);

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
                // TODO finish the interactions
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
                // const confirmationMessage = await interaction.reply({ embeds: [voteSetup.getEmbed(member, 'Choose how many feedbacks you want ViBot to look through')], fetchReply: true });
                // const choice = await confirmationMessage.confirmNumber(10, interaction.member.id);
                // await confirmationMessage.delete();
                // if (!choice || isNaN(choice) || choice == 'Cancelled') return;
                // voteSetup.maximumFeedbacks = choice;
                // await updateState('maximumFeedbacks', choice);
                // await interaction.message.edit({ embeds: [voteSetup.confirmationMessage(member, emojiDatabase)], components: [generateVoteSetupButtons(bot)] });
                break;
            }
            case 'voteRemoveFeedbacks': {
                // await interaction.update({ embeds: [voteSetup.getEmbed(member, 'Type a different channel for the vote to be put up in')] });
                // const channelMessage = await interaction.channel.next(null, null, member.id);
                // const channel = await interaction.guild.findChannel(channelMessage.content);
                // if (channel) {
                //     voteSetup.channel = channel;
                //     await updateState('channel', channel.id);
                // } else {
                //     await interaction.channel.send('Invalid channel. Please type the name of a channel.');
                // }
                // await interaction.message.edit({ embeds: [voteSetup.confirmationMessage(member, emojiDatabase)], components: [generateVoteSetupButtons(bot)] });
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

    const memberFeedbacks = voteSetup.feedbacks.filter(feedback => feedback.mentionedID == member.id);
    const includedFeedbacks = memberFeedbacks.filter(feedback => feedback.feedbackState == FeedbackState.Included);
    const unidentifiedFeedbacks = memberFeedbacks.filter(feedback => feedback.feedbackState == FeedbackState.Unidentified);
    const otherFeedbacks = memberFeedbacks.filter(feedback => feedback.feedbackState == FeedbackState.Other);
    // TODO add length check for 1024 character limit, add <type> feedback two as name and continue list
    // also add indexes to the feedbacks if needed
    embed.addFields([{
        name: 'Included Feedback:',
        value: getFeedbackString(includedFeedbacks) || 'None'
    },
    {
        name: 'Unidentified Feedback:',
        value: getFeedbackString(unidentifiedFeedbacks) || 'None'
    },
    {
        name: 'Other Feedback:',
        value: getFeedbackString(otherFeedbacks) || 'None'
    }]);
    return embed;
}

function getFeedbackString(feedbacks) {
    return feedbacks.map(feedback => `\`${feedback.dungeon?.tag || '  ??  '} ${feedback.tier?.tag || '  ?? '}\` ${feedback.feedbackURL} <t:${feedback.timeStamp}:f>`).join('\n');
}

async function startVote(settings, voteSetup, member) {
    const roleSettingsName = voteSetup.getRoleSettingsName(settings);
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
    const feedbacks = voteSetup.feedbacks.filter(feedback => feedback.mentionedID == member.id && feedback.feedbackState == FeedbackState.Included);
    embed.addFields({
        name: 'Feedback:',
        value: getFeedbackString(feedbacks) || 'None'
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
async function getFeedbacks(members, guild, bot, voteSetup) {
    const feedbackChannel = guild.channels.cache.get(bot.settings[guild.id].channels.rlfeedback); // TODO clean up settings usages, it's only one guild settings ever
    // get the messages that mention the relevant members
    const messages = await getMessages(feedbackChannel, 500);
    // filter the messages to only ones that mention the members, message.mentions.members is Collection<Snowflake, GuildMember>
    const filteredMessages = messages.filter(message => members.some(member => message.mentions.members.has(member.id)));
    const roleSettingsName = Object.keys(bot.settings[guild.id].roles).find(roleName => bot.settings[guild.id].roles[roleName] == voteSetup.role.id);
    // map the messages to FeedbackData
    voteSetup.feedbacks = filteredMessages.map(message => {
        const mentionedID = message.mentions.users.first()?.id;
        const feedbackerID = message.author.id;
        const firstLine = message.content.split('\n')[0].toLowerCase(); // Convert to lowercase for searching
        const dungeon = voteConfig.feedbackTypes.dungeon.find(dungeon => dungeon.flags.some(flag => firstLine.includes(flag)));
        const tier = voteConfig.feedbackTypes.tier.find(tier => tier.flags.some(flag => firstLine.includes(flag)));
        let displayState = FeedbackState.Other;
        if (!dungeon || !tier) {
            displayState = FeedbackState.Unidentified;
        } else if (dungeon.roles.includes(roleSettingsName) && tier.roles.includes(roleSettingsName)) {
            displayState = FeedbackState.Included;
        }
        console.log(displayState);
        return {
            tier,
            dungeon,
            firstLine: message.content.split('\n')[0], // Preserve the original case for the return
            mentionedID,
            feedbackURL: message.url,
            display: FeedbackState.Other,
            feedbackerID,
            timeStamp: (message.createdTimestamp / 1000).toFixed(0),
            displayState
        };
    }) || [];
}

async function getMessages(channel, limit) {
    const sumMessages = [];
    for (let i = 0; i <= limit; i += 100) {
        const options = { limit: 100, before: i > 0 ? sumMessages[sumMessages.length - 1].id : null };
        // eslint-disable-next-line no-await-in-loop
        const messages = await channel.messages.fetch(options);
        sumMessages.push(...messages.map(m => m));
        if (messages.size != 100) break;
    }
    return sumMessages;
}
