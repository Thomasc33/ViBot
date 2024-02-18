const Discord = require('discord.js');
const reacts = require('../data/roleAssignment.json');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js');

async function interactionHandler(interaction, botSettings, guildReacts) {
    const embed = new Discord.EmbedBuilder()
        .setColor(Discord.Colors.Green)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

    switch (interaction.customId) {
        case 'giveAllRoles': {
            const guildReactsToAdd = guildReacts.filter(reaction => !interaction.member.roles.cache.has(botSettings.roles[reaction.role]));
            const rolesToAdd = guildReactsToAdd.map(reaction => interaction.guild.roles.cache.get(botSettings.roles[reaction.role]));
            await interaction.member.roles.add(rolesToAdd);
            if (rolesToAdd.length == 0) embed.setDescription('You already **have** all the roles to receive pings');
            else embed.setDescription(`You now **have** the roles to receive pings for the following dungeons:\n${rolesToAdd.map((role, i) => `- ${guildReactsToAdd[i].emoji} ${guildReactsToAdd[i].name}: ${role}`).join('\n')} `);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            break;
        }
        case 'takeAllRoles': {
            const guildReactsToRemove = guildReacts.filter(reaction => interaction.member.roles.cache.has(botSettings.roles[reaction.role]));
            const rolesToRemove = guildReactsToRemove.map(reaction => interaction.guild.roles.cache.get(botSettings.roles[reaction.role]));
            await interaction.member.roles.remove(rolesToRemove);
            if (rolesToRemove.length == 0) embed.setDescription('You already **no longer** have any of the roles to receive pings');
            else embed.setDescription(`You now **no longer have** the roles to receive pings for the following dungeons:\n${rolesToRemove.map((role, i) => `- ${guildReactsToRemove[i].emoji} ${guildReactsToRemove[i].name}: ${role}`).join('\n')} `);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            break;
        }
        default: {
            const guildReact = guildReacts.find(reaction => reaction.emojiId === interaction.customId);
            const role = interaction.guild.roles.cache.get(botSettings.roles[guildReact.role]);
            if (interaction.member.roles.cache.has(role.id)) {
                await interaction.member.roles.remove(role);
                embed.setDescription(`You now **no longer have** the role to receive pings for ${guildReact.emoji} ${guildReact.name}: ${role}`);
            } else {
                await interaction.member.roles.add(role);
                embed.setDescription(`You now **have** the role to receive pings for ${guildReact.emoji} ${guildReact.name}: ${role}`);
            }
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
}

module.exports = {
    name: 'roleassignment',
    description: 'Creates or updates role assignment',
    requiredArgs: 1,
    args: [
        slashArg(SlashArgType.String, 'type', {
            description: 'Type of role assignment function to use',
            choices: slashChoices(['Send', 'Update'])
        })
    ],
    role: 'moderator',
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    /**
     * @param {Discord.Message} message
     * @param {string[]} args
     * @param {Discord.Client} bot
     */
    async execute(message, args, bot) { await this.processRoleAssignment(message, bot); },
    /**
     * @param {Discord.CommandInteraction} interaction
     * @param {Discord.Client} bot
     */
    async slashCommandExecute(interaction, bot) { await this.processRoleAssignment(interaction, bot); },
    /**
     * @param {Discord.Message | Discord.CommandInteraction} interaction
     * @param {Discord.Client} bot
     */
    async processRoleAssignment(interaction, bot) {
        const botSettings = bot.settings[interaction.guild.id];
        if (!botSettings || !botSettings.backend.roleassignment) return interaction.reply(`Role Assignment not setup for guild ${interaction.guild.name}`);
        const guildReacts = reacts[interaction.guild.id];
        if (!guildReacts) return interaction.reply(`Reactions not setup for guild ${interaction.guild.name}`);
        const channel = interaction.guild.channels.cache.get(botSettings.channels.roleassignment);
        if (!channel) return interaction.reply(`Role Assignment channel not setup for guild ${interaction.guild.name}`);
        const type = interaction.options.getString('type');
        switch (type.toLowerCase()) {
            case 'send': {
                const embed = new Discord.EmbedBuilder()
                    .setTitle('Assign Roles')
                    .setColor(Discord.Colors.Blue)
                    .setDescription('Press the buttons with one of the following emojis to get pinged for specific runs\nCan be disabled by pressing the same button after recieving your role')
                    .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
                    .setTimestamp();
                guildReacts.map(reaction => embed.addFields([{ name: reaction.name, value: reaction.emoji, inline: true }]));
                const message = await channel.send({ embeds: [embed], components: this.addInteractionComponents(guildReacts) });
                const roleAssignmentInteractionCollector = new Discord.InteractionCollector(bot, { message, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
                roleAssignmentInteractionCollector.on('collect', (interaction) => interactionHandler(interaction, botSettings, guildReacts));
                interaction.reply(`Role Assignment message has been successfully sent ${message.url}`);
                break;
            }
            case 'update': {
                await this.updateRoleAssignmentListeners(interaction.guild, bot);
                interaction.reply(`Role Assignment message has been successfully updated ${channel.url}`);
                break;
            }
            default: {
                return interaction.reply('Invalid type of role assignment function, please try again.');
            }
        }
    },
    /**
     * @param {Discord.Guild} guild
     * @param {Discord.Client} bot
     */
    async updateRoleAssignmentListeners(guild, bot) {
        const botSettings = bot.settings[guild.id];
        if (!botSettings) return; // If roleassignment is not setup for the guild it will not continue
        const guildReacts = reacts[guild.id];
        if (!guildReacts) return; // If there are no reacts for the guild it will not continue
        const roleAssignmentChannel = guild.channels.cache.get(botSettings.channels.roleassignment);
        if (!roleAssignmentChannel) return; // If there is no roleassignment channel it will not continue

        const roleAssignmentChannelMessages = await roleAssignmentChannel.messages.fetch(); // This fetches all the messages in the roleassignment channel
        roleAssignmentChannelMessages.map(async message => { // This will loop through the roleassignment channel messages
            if (message.author.id !== bot.user.id) return; // If the roleassignment message author is not the same id as ViBot it will not continue with this message
            if (message.embeds.length == 0) return; // If the message has no embeds it will not continue
            if (message.components == 0) return; // If the message has no components it will not continue
            // Anything below this code inside this function is for roleassignment messages, and we need to reset them
            await message.edit({ components: this.addInteractionComponents(guildReacts) }); // This will add a roleassignment button listeners to the message
            const roleAssignmentInteractionCollector = new Discord.InteractionCollector(bot, { message, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
            roleAssignmentInteractionCollector.on('collect', (interaction) => interactionHandler(interaction, botSettings, guildReacts));
        });
    },
    addInteractionComponents(guildReacts) {
        const components = [];

        components.push(new Discord.ButtonBuilder()
            .setCustomId('giveAllRoles')
            .setLabel('✅ Give All')
            .setStyle(Discord.ButtonStyle.Success));

        guildReacts.map(reaction =>
            components.push(new Discord.ButtonBuilder()
                .setCustomId(reaction.emojiId)
                .setEmoji(reaction.emojiId)
                .setStyle(Discord.ButtonStyle.Secondary))
        );

        components.push(new Discord.ButtonBuilder()
            .setCustomId('takeAllRoles')
            .setLabel('❌ Take All')
            .setStyle(Discord.ButtonStyle.Danger));
        return components.reduce((rows, btn, idx) => {
            if (idx % 5 == 0) rows.push(new Discord.ActionRowBuilder());
            rows[rows.length - 1].addComponents(btn);
            return rows;
        }, []);
    }
};
