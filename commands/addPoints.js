const botSettings = require('../settings.json')
const ErrorLogger = require('../lib/logError')
const Discord = require('discord.js')

module.exports = {
    name: 'addpoints',
    alias: ['stream', 'priest', 'trickster'],
    guildSpecific: true,
    role: 'security',
    getSlashCommandData(guild) {
        let settings = guild.client.settings[guild.id]
        if (!settings || !settings.backend.points || !settings.commands.addpoints) return undefined
        return new Discord.SlashCommandBuilder()
            .setName('addpoints')
            .setDescription('Add points to a user')
            .addStringOption(option => option.setName('type').setDescription('Type of points to add').setRequired(true).addChoices({ name: 'Streaming', value: 'stream' }, { name: 'Puri', value: 'priest' }, { name: 'Trickster', value: 'trickster' }))
            .addUserOption(option => option.setName('user').setDescription('User to add points to').setRequired(true))
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
            default: return message.channel.send(`${type} not recognized`)
        }
        db.query(`UPDATE users SET points = points + ${points} WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot, message.guild)
            else message.react('✅')
        })
    },
    async slashCommandExecute(interaction, bot, db) {
        let settings = bot.settings[interaction.guild.id]
        if (!settings || !settings.backend.points) return
        let type = interaction.options.getString('type')
        let member = interaction.options.getMember('user')
        let points
        switch (type) {
            case 'stream': points = settings.points.o3streaming; break;
            case 'priest': points = settings.points.o3puri; break;
            case 'trickster': points = settings.points.o3trickster; break;
            default: return interaction.reply({ content: `Invalid point type.`, ephemeral: true })
        }
        if (!points) return interaction.reply({ content: `Invalid point type.`, ephemeral: true })
        db.query(`UPDATE users SET points = points + ${points} WHERE id = '${member.id}'`, (err, rows) => {
            if (err) {
                interaction.reply({ content: `Error adding points.`, ephemeral: true })
                ErrorLogger.log(err, bot, interaction.guild)
            }
            interaction.reply({ content: `Added ${points} (${type}) points to ${member.user.tag}`, ephemeral: true })
        })
    },
}