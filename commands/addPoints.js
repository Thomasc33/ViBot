const botSettings = require('../settings.json')
const ErrorLogger = require('../lib/logError')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'addpoints',
    slashCommandName: 'addpoints',
    description: 'Add points to a user',
    alias: ['stream', 'priest', 'trickster'],
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
        const command = message.content.substring(botSettings.prefix.length, message.content.length).split(/ +/)[0].toLowerCase()
        const type = command == this.name ? args.shift() : command

        const member = message.guild.findMember(args[0])
        if (!member) return message.channel.send(`${args[0]} not found`)
        let points = 0
        switch (type) {
            case 'stream': points = settings.points.o3streaming; break
            case 'priest': points = settings.points.o3puri; break
            case 'trickster': points = settings.points.o3trickster; break
            default: return message.reply(`${type} not recognized`)
        }
        db.query('UPDATE users SET points = points + ? WHERE id = ?', [points, member.id], err => {
            if (err) {
                message.replyInternalError('Error adding points.')
                ErrorLogger.log(err, bot, message.guild)
            } else message.replySuccess(`Added ${points} (${type}) points to ${member.user.tag}`)
        })
    }
}
