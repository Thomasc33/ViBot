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
                slashArg(SlashArgType.String, 'vc_id', {
                    required: false,
                    description: 'The vc to parse'
                })
            ]
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    role: 'eventrl',
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().trim().toLowerCase();
        switch (focusedValue.name) {
            case 'raid':
                break;
            default:
        }
    },
    async execute(message/* , bot, db */) {
        const action = message.options.getSubcommand();
        switch (action) {
            case 'members':
                console.log(message.options[0].options);
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
