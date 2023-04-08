const botSettings = require('../settings.json')
const ErrorLogger = require('../lib/logError')
const Discord = require('discord.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
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
                'Streaming': 'stream',
                'Puri': 'priest',
                'Trickster': 'trickster'
            })
        }),
        slashArg(SlashArgType.User, 'user', {
            description: 'User to add points to'
        })
    ],
    getSlashCommandData(guild) {
        let settings = guild.client.settings[guild.id]
        if (!settings || !settings.backend.points || !settings.commands.addpoints) return undefined
        return slashCommandJSON(this, guild)
    },
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (!settings || !settings.backend.points) return
        let type
        let command = message.content.substring(botSettings.prefix.length, message.content.length).split(/ +/)[0].toLowerCase()
        if (command == this.name) type = args.shift()
        else type = command
        let member = message.guild.members.cache.get(args[0])
        if (!member) member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send(`${args[0]} not found`)
        let points
        switch (type) {
            case 'stream': points = settings.points.o3streaming; break;
            case 'priest': points = settings.points.o3puri; break;
            case 'trickster': points = settings.points.o3trickster; break;
            default: return message.reply(`${type} not recognized`)
        }
        db.query(`UPDATE users SET points = points + ${points} WHERE id = '${member.id}'`, (err, rows) => {
            if (err) {
                interaction.replyInternalError("Error adding points.")
                ErrorLogger.log(err, bot, message.guild)
            }
            else message.replySuccess(`Added ${points} (${type}) points to ${member.user.tag}`)
        })
    },
}
