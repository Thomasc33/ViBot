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
                slashArg(SlashArgType.Attachment, 'players', {
                    required: true,
                    description: '/who image'
                }),
                slashArg(SlashArgType.String, 'raid', {
                    required: false,
                    autocomplete: true,
                    description: 'The raid to parse'
                }),
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'reacts', {
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
                slashArg(SlashArgType.Attachment, 'players', {
                    required: true,
                    description: '/who image'
                }),
                slashArg(SlashArgType.String, 'vc', {
                    required: false,
                    description: 'The vc id to parse'
                })
            ]
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    role: 'eventrl',
    async autocomplete(interaction, bot) {
        const focusedOption = interaction.options.getFocused(true);
        switch (focusedOption.name) { // switch statement for future autocomplete types, may remove later
            case 'raid':
                return await filterRaidIds(interaction, bot);
            default:
        }
    },
    async execute(message/* , bot, db */) {
        const action = message.options.getSubcommand();
        switch (action) {
            case 'members':
                await message.reply('members');
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

async function filterRaidIds(interaction, bot) {
    const raidIdMappings = Object.keys(bot.afkModules).filter(raidId => bot.afkModules[raidId].guild.id == interaction.guild.id).map(raidId => ({ name: bot.afkModules[raidId].afkTitle(), value: raidId })); // may need some null-proofing here, unsure if I should bother
    if (raidIdMappings.length == 0) { return; }
    const focusedValue = interaction.options.getFocused().trim().toLowerCase();
    const filteredValues = raidIdMappings.filter(raidIdMapping => raidIdMapping.name.includes(focusedValue)).slice(0, 25);
    await interaction.respond(filteredValues);
}
