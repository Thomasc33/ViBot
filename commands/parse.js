const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

module.exports = {
    name: 'bananas',
    description: 'read the name',
    alias: ['pm'],
    args: [
        slashArg(SlashArgType.Subcommand, 'reacts', {
            description: 'Lists reacts for the run',
            options: [
                slashArg(SlashArgType.String, 'raidId', {
                    required: false,
                    description: 'The id of the raid you wish to parse'
                })
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'simple_VC', {
            description: 'Checks vc against /who only',
            options: [
                slashArg(SlashArgType.Attachment, 'who', {
                    required: true,
                    description: '/who image'
                }),
                slashArg(SlashArgType.String, 'vcId', {
                    required: false,
                    description: 'vc you are trying to parse'
                })
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'members', {
            description: 'regular old parse',
            options: [
                slashArg(SlashArgType.Attachment, 'who', {
                    required: true,
                    description: '/who image'
                }),
                slashArg(SlashArgType.String, 'raidId', {
                    required: false,
                    description: 'The id of the raid you are trying to parse'
                }),
            ]
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    role: 'eventrl',
    async execute() { },
    async slashCommandExecute() { }
};
