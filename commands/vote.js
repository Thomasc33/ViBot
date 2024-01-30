const Discord = require('discord.js');
const voteConfigurationTemplates = require('../data/voteConfiguration.json');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');
const { createReactionRow } = require('../redis.js');

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
        const { guild, member, channel } = message;

        const voteConfiguration = new VoteConfiguration({
            channel,
            role: message.options.getRole('role'),
            maximumFeedbacks: 5,
            members: message.options.getString('users').split(' ').concat(message.options.getVarargs() || []).map(member => guild.findMember(member)).filter(member => member != undefined)
        });

        if (voteConfiguration.members.length == 0) { return await message.reply('No members found.'); }

        const embed = voteConfiguration.confirmationMessage(member, bot.storedEmojis);
        const voteConfigurationButtons = generateVoteConfigurationButtons(bot);
        const voteConfigurationMessage = await message.reply({ embeds: [embed], components: [voteConfigurationButtons] });
        createReactionRow(voteConfigurationMessage, module.exports.name, 'interactionHandler', voteConfigurationButtons, message.author, voteConfiguration.toJSON());
    },
    async interactionHandler(bot, message, db, choice, voteConfigurationJSON, updateState) {
        const emojiDatabase = bot.storedEmojis || {};
        const interaction = message.interaction; // eslint-disable-line prefer-destructuring
        const member = interaction.member; // eslint-disable-line prefer-destructuring
        const voteConfiguration = VoteConfiguration.fromJSON(interaction.guild, voteConfigurationJSON);
        switch (choice) {
            case 'voteConfirm':
                await message.delete();
                Promise.all(voteConfiguration.members.map(async memberId => {
                    const member = await interaction.guild.members.fetch(memberId);
                    const feedbacks = await getFeedback(member, interaction.guild, bot);
                    await startVote(bot.settings[interaction.guild.id], voteConfiguration, member, feedbacks);
                }));
                break;
            case 'voteCancel':
                await message.delete();
                break;
            case 'voteFeedbackConfigure': {
                const confirmationMessage = await interaction.reply({ embeds: [voteConfiguration.getEmbed(member, 'Choose how many feedbacks you want ViBot to look through')], fetchReply: true });
                const choice = await confirmationMessage.confirmNumber(10, interaction.member.id);
                await confirmationMessage.delete();
                if (!choice || isNaN(choice) || choice == 'Cancelled') return;
                voteConfiguration.maximumFeedbacks = choice;
                await updateState('maximumFeedbacks', choice);
                await interaction.message.edit({ embeds: [voteConfiguration.confirmationMessage(member, emojiDatabase)], components: [generateVoteConfigurationButtons(bot)] });
                break;
            }
            case 'voteChannelConfigure': {
                await interaction.update({ embeds: [voteConfiguration.getEmbed(member, 'Type a different channel for the vote to be put up in')] });
                const channelMessage = await interaction.channel.next(null, null, member.id);
                const channel = await interaction.guild.findChannel(channelMessage.content);
                if (channel) {
                    voteConfiguration.channel = channel;
                    await updateState('channel', channel.id);
                } else {
                    await interaction.channel.send('Invalid channel. Please type the name of a channel.');
                }
                await interaction.message.edit({ embeds: [voteConfiguration.confirmationMessage(member, emojiDatabase)], components: [generateVoteConfigurationButtons(bot)] });
                break;
            }
            case 'voteRoleConfigure': {
                await interaction.update({ embeds: [voteConfiguration.getEmbed(member, 'Type a different role for the vote')] });
                const roleMessage = await interaction.channel.next(null, null, member.id);
                const role = await interaction.guild.findRole(roleMessage.content);
                if (role) {
                    voteConfiguration.role = role;
                    await updateState('role', role.id);
                } else {
                    await interaction.channel.send('Invalid role. Please type the name of a role.');
                }
                await interaction.message.edit({ embeds: [voteConfiguration.confirmationMessage(member, emojiDatabase)], components: [generateVoteConfigurationButtons(bot)] });
                break;
            }
            default:
                console.log('Invalid choice', choice);
                break;
        }
    }
};

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

async function getFeedback(member, guild, bot) {
    const settings = bot.settings[member.guild.id];
    const feedbackChannel = guild.channels.cache.get(settings.channels.rlfeedback);
    const messages = await getMessages(feedbackChannel, 500);
    const mentions = messages.filter(m => m.mentions.users.get(member.id)).map(m => m.url);
    return mentions;
}

class VoteConfiguration {
    constructor({ channel, maximumFeedbacks, members, role }) {
        this.channel = channel;
        this.maximumFeedbacks = maximumFeedbacks;
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
            maximumFeedbacks: this.maximumFeedbacks,
            members: this.members.map(m => m.id),
            role: this.role.id
        };
    }

    getEmbed(member, description) {
        return new Discord.EmbedBuilder()
            .setColor(member.roles.highest.hexColor)
            .setAuthor({
                name: 'Vote Configuration',
                iconURL: member.user.displayAvatarURL({ dynamic: true })
            })
            .setDescription(description);
    }

    description(emojiDatabase) {
        return `
            This vote will be for ${this.role}, inside of ${this.channel}
            ${emojiDatabase.feedback.text} \`${this.maximumFeedbacks}\`

            ## Leaders
            ${this.members.join(', ')}
        `;
    }

    confirmationMessage(member, emojiDatabase) {
        return this.getEmbed(member, this.description(emojiDatabase));
    }
}

async function startVote(settings, voteConfiguration, member, feedbacks) {
    const settingRoleName = Object.keys(settings.roles)
        .find(roleName => settings.roles[roleName] === voteConfiguration.role.id);
    if (!settingRoleName) { return; }
    const embedStyling = voteConfigurationTemplates
        .find(template => template.settingRole === settingRoleName);
    let embedColor = voteConfiguration.role.hexColor;
    if (embedStyling != undefined && embedStyling.embedColor) { embedColor = embedStyling.embedColor; }
    const embed = new Discord.EmbedBuilder()
        .setColor(embedColor)
        .setAuthor({ name: `${member.displayName} to ${voteConfiguration.role.name}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
        .setDescription(`${member} \`${member.displayName}\``);
    if (embedStyling != undefined && embedStyling.image) { embed.setThumbnail(embedStyling.image); }
    embed.addFields({
        name: 'Recent Feedback:',
        value: `${feedbacks.length != 0 ? `${feedbacks.slice(
            0, voteConfiguration.maximumFeedbacks).map(
            (feedback, index) => `\`${(index + 1).toString().padStart(2, ' ')}\` ${feedback}`).join('\n')}` : 'None'}`,
        inline: false
    });
    const voteMessage = await voteConfiguration.channel.send({ embeds: [embed] });
    for (const emoji of ['✅', '❌', '👀']) { voteMessage.react(emoji); }
}

function generateVoteConfigurationButtons(bot) {
    return new Discord.ActionRowBuilder()
        .addComponents([
            new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(3)
                .setCustomId('voteConfirm'),
            new Discord.ButtonBuilder()
                .setLabel('Feedbacks')
                .setStyle(2)
                .setEmoji(bot.storedEmojis.feedback.id)
                .setCustomId('voteFeedbackConfigure'),
            new Discord.ButtonBuilder()
                .setLabel('# Channel')
                .setStyle(2)
                .setCustomId('voteChannelConfigure'),
            new Discord.ButtonBuilder()
                .setLabel('@ Role')
                .setStyle(2)
                .setCustomId('voteRoleConfigure'),
            new Discord.ButtonBuilder()
                .setLabel('❌ Cancel')
                .setStyle(4)
                .setCustomId('voteCancel')
        ]);
}
