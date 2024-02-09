/**
 * Represents the 'parse' command.
 * @module parseCommand
 */

const Discord = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

module.exports = {
    name: 'parse',
    description: 'read the name',
    alias: ['parse'],
    args: [
        slashArg(SlashArgType.Subcommand, 'members', {
            description: 'regular old parse',
            options: [
                slashArg(SlashArgType.String, 'raid', {
                    required: false,
                    autocomplete: true,
                    description: 'The raid to parse'
                }),
                slashArg(SlashArgType.String, 'vc', {
                    required: false,
                    description: 'The vc to parse against'
                }),
                slashArg(SlashArgType.Attachment, 'players', {
                    required: false,
                    description: '/who image'
                })
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'reactlist', {
            description: 'Lists reacts for the run',
            options: [
                slashArg(SlashArgType.String, 'raid', {
                    autocomplete: true,
                    required: false,
                    description: 'The raid to parse'
                })
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'simple', {
            description: 'Checks vc against /who only',
            options: [
                slashArg(SlashArgType.String, 'vc', {
                    required: false,
                    description: 'The vc id to parse'
                }),
                slashArg(SlashArgType.Attachment, 'players', {
                    required: false,
                    description: '/who image'
                })
            ]
        })
    ],
    /**
     * Returns the slash command data.
     * @param {Discord.Guild} guild - The guild object.
     * @returns {Object} The slash command data in JSON form.
     */
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    role: 'eventrl',
    /**
     * Handles autocomplete for the command.
     * @param {Object} interaction - The interaction object.
     * @param {Object} bot - The bot object.
     * @returns {Promise} A promise that resolves with the autocomplete result.
     */
    async autocomplete(interaction, bot) {
        const focusedOption = interaction.options.getFocused(true);
        switch (focusedOption.name) { // switch statement for future autocomplete types, may remove later
            case 'raid':
                return await filterRaidIds(interaction, bot);
            default:
        }
    },
    /**
     * Executes the command.
     * @param {Object} message - The message object.
     */
    async execute(message, args, bot, db) {
        const action = message.options.getSubcommand();
        switch (action) {
            case 'members':
                await message.reply('members');
                await parseMembers(message, bot, db);
                break;
            case 'reacts':
                await message.reply('reacts');
                break;
            case 'simple':
                await message.reply('simple');
                break;
            default:
        }
    }
};

async function parseMembers(message, bot, db) {
    const raid = bot.afkModules[message.options.getString('raid')] || getRaid(message, bot, message.member.voice?.channelID);
    console.log('raid object:', raid, 'raidId:', message.options.getString('raid'));
    const vc = (raid.vcOptions == 1) ? message.options.getString('vc') : message.member.voice?.channelID;
    const playersImage = message.options.getAttachment('players')?.url;

    console.log('vc id: ', vc, 'image url: ', playersImage);
}

/**
 * Determines the raid via interactive modal
 * @param {Object} message - The message object.
 * @param {Object} bot - The bot object.
 * @param {string} memberVoiceChannel - The member's voice channel ID.
 * @returns {Promise} A promise that resolves with the raid.
 */
async function getRaid(message, bot, memberVoiceChannel) {
    const raids = Object.values(bot.afkModules).filter(afk => afk.guild?.id == message.guild.id);
    if (raids.length == 0) {
        message.channel.send('Could not find an active run. Please try again.');
        return;
    }

    if (raids.length == 1) return raids[0];
    if (raids.filter(afk => afk.channel?.id == memberVoiceChannel).length == 1) {
        return raids.find(afk => afk.channel?.id == memberVoiceChannel);
    }

    const raidMenu = new Discord.StringSelectMenuBuilder()
        .setPlaceholder('Active Runs')
        .setMinValues(1)
        .setMaxValues(1);
    let text = 'Which active run would you like to parse for?';
    for (let index = 0; index < raids.length; index++) {
        text += `\n\`\`${index+1}.\`\` ${raids[index].afkTitle()}`;
        raidMenu.addOptions({ label: `${index + 1}. ${raids[index].afkTitle()}`, value: String(index) });
    }
    const { value } = await message.selectPanel(text, null, raidMenu, 30000, false, true);
    if (value) return raids[value];
    await message.reply('You must specify the raid to parse, or join the raid\'s voice channel.');
}

/**
 * Filters raid IDs based on the interaction and bot.
 * @param {Object} interaction - The interaction object.
 * @param {Object} bot - The bot object.
 * @returns {Promise} A promise that resolves with the filtered raid IDs.
 */
async function filterRaidIds(interaction, bot) {
    const raidIdMappings = Object.keys(bot.afkModules).filter(raidId => bot.afkModules[raidId].guild.id == interaction.guild.id).map(raidId => ({ name: bot.afkModules[raidId].afkTitle(), value: raidId })); // may need some null-proofing here, unsure if I should bother
    if (raidIdMappings.length == 0) { return; }
    const focusedValue = interaction.options.getFocused().trim().toLowerCase();
    const filteredValues = raidIdMappings.filter(raidIdMapping => raidIdMapping.name.includes(focusedValue)).slice(0, 25);
    await interaction.respond(filteredValues);
}
