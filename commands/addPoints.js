const ErrorLogger = require('../lib/logError')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'addpoints',
    slashCommandName: 'addpoints',
    description: 'Add points to a user',
    guildSpecific: true,
    role: 'security',
    args: [
        slashArg(SlashArgType.String, 'type', {
            description: 'Type of points to add',
            choices: slashChoices({
                Streaming: 'stream',
                Puri: 'priest',
                Trickster: 'trickster'
            })
        }),
        slashArg(SlashArgType.User, 'user', {
            description: 'User to add points to'
        })
    ],
    getSlashCommandData(guild) {
        const settings = guild.client.settings[guild.id]
        if (!settings || !settings.backend.points || !settings.commands.addpoints) return undefined
        return slashCommandJSON(this, guild)
    },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        if (!settings?.backend.points) return message.channel.send('This server does not have points functionality enabled')

        const type = message.options.getString('type').toLowerCase()
        const member = message.options.getMember('user')

        const points = {
            stream: settings.points.o3streaming,
            priest: settings.points.o3puri,
            trickster: settings.points.o3trickster
        }[type]

        if (!points) return message.reply(`${type} not recognized`)

        db.query('UPDATE users SET points = points + ? WHERE id = ?', [points, member.id], err => {
            if (err) {
                message.replyInternalError('Error adding points.')
                ErrorLogger.log(err, bot, message.guild)
            } else message.replySuccess(`Added ${points} (${type}) points to ${member.user.tag}`)
        })
    }
}
