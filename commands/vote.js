const Discord = require('discord.js');
const getFeedback = require('./getFeedback');
const ErrorLogger = require('../lib/logError');
const voteConfigurationTemplates = require('../data/voteConfiguration.json');

module.exports = {
    name: 'vote',
    role: 'headrl',
    args: '<role> [<user1> (user2) (user3)...]',
    requiredArgs: 2,
    description: 'Puts up a vote for the person based on your role input',
    async execute(message, args, bot, db) {
        const voteModule = new Vote(message, args, bot, db);
        await voteModule.startProcess();
    }
};

class Vote {
    /**
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     */

    constructor(message, args, bot, db) {
        // Basic assignments from parameters
        this.message = message;
        this.args = args;
        this.bot = bot;
        this.db = db;

        // Guild and member-related assignments
        this.guild = message.guild;
        this.member = message.member || {};
        this.channel = message.channel || {};
        this.settings = bot.settings[this.guild.id] || {};
        this.emojiDatabase = bot.storedEmojis || {};

        // Role and template initializations
        this.roleType = args.shift() || '';
        this.guildVoteTemplates = null;
        this.template = null;
        this.embedStyling = { color: null, image: null };
        this.voteConfigurationTemplates = voteConfigurationTemplates;

        this.emojis = ['✅', '❌', '👀'];
        this.voteConfiguration = {
            channel: this.channel,
            maximumFeedbacks: 5,
            members: this.args.map(member => this.guild.findMember(member)).filter(member => member != undefined),
            role: this.guild.findRole(this.roleType)
        };
    }

    async startProcess() {
        if (!this.voteConfiguration.role) { return await this.channel.send(`Could not find role \`${this.roleType}\``); }
        if (this.voteConfiguration.members.length == 0) { return await this.channel.send('No members found.'); }

        this.getVoteConfigurationButtons();
        await this.message.smartDelete();
        await this.sendConfirmationMessage();
        await this.updateConfirmationMessage();
    }

    async sendConfirmationMessage() {
        this.embed = new Discord.EmbedBuilder()
            .setColor(this.member.roles.highest.hexColor)
            .setAuthor({ name: 'Vote Configuration', iconURL: this.member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription('Loading...');
        this.voteConfigurationMessage = await this.channel.send({ embeds: [this.embed], components: [this.getVoteConfigurationButtons()] });

        this.voteConfigurationMessageInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.voteConfigurationMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        this.voteConfigurationMessageInteractionCollector.on('collect', async (interaction) => await this.interactionHandler(interaction));
    }

    async updateConfirmationMessage() {
        const voteConfigurationDescription = this.getVoteConfigurationDescription();
        this.embed = new Discord.EmbedBuilder()
            .setColor(this.member.roles.highest.hexColor)
            .setAuthor({ name: 'Vote Configuration', iconURL: this.member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(voteConfigurationDescription);
        await this.voteConfigurationMessage.edit({ embeds: [this.embed], components: [this.getVoteConfigurationButtons()] });
    }

    getVoteConfigurationDescription() {
        return `
            This vote will be for ${this.voteConfiguration.role}, inside of ${this.voteConfiguration.channel}
            ${this.emojiDatabase.feedback.text} \`${this.voteConfiguration.maximumFeedbacks}\`
            
            ## Leaders
            ${this.voteConfiguration.members.join(', ')}
        `;
    }

    getVoteConfigurationButtons() {
        return new Discord.ActionRowBuilder()
            .addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('✅ Confirm')
                    .setStyle(3)
                    .setCustomId('voteConfirm'),
                new Discord.ButtonBuilder()
                    .setLabel('Feedbacks')
                    .setStyle(2)
                    .setEmoji(this.emojiDatabase.feedback.id)
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

    async interactionHandler(interaction) {
        if (interaction.member.id != this.member.id) {
            return await interaction.reply({ content: 'You are not permitted to configure this', ephemeral: true });
        }

        switch (interaction.customId) {
            case 'voteConfirm':
                await this.buttonVoteConfirm(interaction);
                break;
            case 'voteCancel':
                await this.buttonVoteCancel(interaction);
                break;
            case 'voteFeedbackConfigure':
                await this.buttonVoteFeedbackConfigure(interaction);
                break;
            case 'voteChannelConfigure':
                await this.buttonVoteChannelConfigure(interaction);
                break;
            case 'voteRoleConfigure':
                await this.buttonVoteRoleConfigure(interaction);
                break;
            default:
                this.channel.send('How?');
                break;
        }
    }

    async endVoteConfigurationPhase(interaction) {
        await interaction.message.smartDelete();
        this.voteConfigurationMessageInteractionCollector.stop();
    }

    async buttonVoteConfirm(interaction) {
        try {
            await interaction.reply({ content: 'The votes will be put up', ephemeral: true });
            await this.endVoteConfigurationPhase(interaction);
            this.getEmbedStyling();
            Promise.all(this.voteConfiguration.members.map(async member => {
                const feedbacks = await getFeedback.getFeedback(member, this.guild, this.bot);
                await this.startVote(member, feedbacks);
            }));
        } catch (error) {
            ErrorLogger.log(error, this.bot, this.guild);
        }
    }

    async startVote(member, feedbacks) {
        let embedColor = this.voteConfiguration.role.hexColor;
        if (this.embedStyling != undefined && this.embedStyling.embedColor) { embedColor = this.embedStyling.embedColor; }
        this.embed = new Discord.EmbedBuilder()
            .setColor(embedColor)
            .setAuthor({ name: `${member.displayName} to ${this.voteConfiguration.role.name}`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
            .setDescription(`${member} \`${member.displayName}\``);
        if (this.embedStyling != undefined && this.embedStyling.image) { this.embed.setThumbnail(this.embedStyling.image); }
        this.embed.addFields({
            name: 'Recent Feedback:',
            value: `${feedbacks.length != 0 ? `${feedbacks.slice(
                0, this.voteConfiguration.maximumFeedbacks).map(
                (feedback, index) => `\`${(index + 1).toString().padStart(2, ' ')}\` ${feedback}`).join('\n')}` : 'None'}`,
            inline: false
        });
        const voteMessage = await this.voteConfiguration.channel.send({ embeds: [this.embed] });
        for (const emoji of this.emojis) { voteMessage.react(emoji); }
    }

    getEmbedStyling() {
        const settingRoleName = Object.keys(this.settings.roles)
            .find(roleName => this.settings.roles[roleName] === this.voteConfiguration.role.id);
        if (!settingRoleName) { return; }
        this.embedStyling = this.voteConfigurationTemplates
            .find(template => template.settingRole === settingRoleName);
    }

    async buttonVoteCancel(interaction) {
        await interaction.reply({ content: 'You have decided to cancel the votes', ephemeral: true });
        await this.endVoteConfigurationPhase(interaction);
    }

    async buttonVoteFeedbackConfigure(interaction) {
        const embedFeedbackConfigure = this.getBaseEmbed();
        embedFeedbackConfigure.setDescription('Choose how many feedbacks you want ViBot to look through');
        const confirmationMessage = await interaction.reply({ embeds: [embedFeedbackConfigure], fetchReply: true });
        const choice = await confirmationMessage.confirmNumber(10, interaction.member.id);
        if (!choice || isNaN(choice) || choice == 'Cancelled') return await confirmationMessage.smartDelete();
        await confirmationMessage.smartDelete();
        this.voteConfiguration.maximumFeedbacks = choice;
        await this.updateConfirmationMessage();
    }

    async buttonVoteChannelConfigure(interaction) {
        const embedFeedbackConfigure = this.getBaseEmbed();
        embedFeedbackConfigure.setDescription('Type a different channel for the vote to be put up in');
        await interaction.update({ embeds: [embedFeedbackConfigure] });
        const configurationRepliedMessage = await interaction.channel.next(null, null, interaction.member.id);
        const channel = await this.guild.findChannel(configurationRepliedMessage.content);
        if (channel) { this.voteConfiguration.channel = channel; }
        await this.updateConfirmationMessage();
    }

    async buttonVoteRoleConfigure(interaction) {
        const embedFeedbackConfigure = this.getBaseEmbed();
        embedFeedbackConfigure.setDescription('Type a different role for the vote');
        await interaction.update({ embeds: [embedFeedbackConfigure] });
        const configurationRepliedMessage = await interaction.channel.next(null, null, interaction.member.id);
        const role = await this.guild.findRole(configurationRepliedMessage.content);
        if (role) { this.voteConfiguration.role = role; }
        await this.updateConfirmationMessage();
    }

    getBaseEmbed() {
        return new Discord.EmbedBuilder()
            .setColor(this.member.roles.highest.hexColor)
            .setAuthor({
                name: 'Vote Configuration',
                iconURL: this.member.user.displayAvatarURL({ dynamic: true })
            });
    }
}
