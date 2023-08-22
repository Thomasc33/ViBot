const keypops = require('../data/keypop.json')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashCommandJSON } = require('../utils.js')
const popExecute = require('./pop.js').execute

module.exports = {
    name: 'usevial',
    description: 'Logs key pops',
    alias: ['uv'],
    requiredArgs: 1,
    role: 'eventrl',
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: 'The vial popper'
        }),
        slashArg(SlashArgType.Integer, 'count', {
            required: false,
            description: 'The number of keys to add (default 1)'
        }),
    ],
    getNotes(guild, member) {
        return keypops[guild.id] ? Object.keys(keypops[guild.id]).toString() : `not setup for guild ${guild.id}`
    },
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild)
    },
    async execute(message, args, bot, db) {
        args.unshift('vial')
        await popExecute(message, args, bot, db)
    }
}
