const Discord = require('discord.js')
const clConfig = require('../data/changelog.json')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'changelog',
    role: 'headeventrl',
    description: 'Changes logs',
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: 'User to change logs for'
        }),
        slashArg(SlashArgType.String, 'operator', {
            description: 'Operator to use',
            choices: slashChoices(['Add', 'Remove', 'Set'])
        }),
        slashArg(SlashArgType.String, 'type', {
            description: 'Type of log to change'
        }),
        slashArg(SlashArgType.Integer, 'number', {
            description: 'Number of logs to change'
        })
    ],
    requiredArgs: 4,
    getNotes(guild) {
        const types = clConfig[guild.id]?.logtypes.map(type => type + (clConfig[guild.id]?.currentweeks.find(cw => cw.case == type) ? '\\*' : '')).sort(a => a[a.length - 1] == '*' ? -1 : 1)
        return { title: 'Available Logs', value: (types ? `${types.join(', ')}\n\n*\\* logs associated with quota*` : `Not setup for guild ${guild.id}`) }
    },
    getSlashCommandData(guild) {
        const json = slashCommandJSON(this, guild)
        // Magic regex!
        // Makes the log type names look pretty :3
        if (clConfig[guild.id]) json[0].options[2].choices = clConfig[guild.id].logtypes.map((k) => ({ name: k?.deCamelCase(), value: k }))
        return json
    },

    /**
     * @param {Discord.Message | Discord.CommandInteraction} interaction
     * @param {Discord.Client} bot
     * @param {*} db
     */
    async processChangeLog(interaction, bot, db) {
        const member = interaction.options.getMember('user')

        async function printError(err) {
            ErrorLogger.log(err, bot, member.guild)
            const reply = await interaction.fetchReply()

            const errEmbed = new Discord.EmbedBuilder()
                .setTitle('Changelog Error')
                .setAuthor({ name: interaction.member.displayName, iconURL: member.displayAvatarURL() })
                .setColor('Red')
                .setDescription(`Could not perform changelog for ${member}`)
                .addFields({ name: 'Reason', value: `${err}` })

            if (reply) interaction.editReply({ embeds: [errEmbed], components: [] })
            else interaction.reply({ embeds: [errEmbed], ephemeral: true, allowedMentions: { repliedUser: false } })
        }

        const modlogs = interaction.guild.channels.cache.get(bot.settings[interaction.member.guild.id]?.channels.modlogs)

        if (!modlogs) return printError(`Mod-logs channel not setup for guild ${member.guild.name}`)
        if (!clConfig[interaction.member.guild.id]) return printError(`Changelog not setup for guild ${member.guild.name}`)

        const operator = interaction.options.getString('operator')?.deCamelCase()
        const op = operator.charAt(0).toLowerCase()

        const count = interaction.options.getInteger('number')

        const logTypeRequest = interaction.options.getString('type').toLowerCase()
        const logIndex = clConfig[member.guild.id].logtypes.findIndex(e => logTypeRequest == e.toLowerCase())
        const logType = clConfig[member.guild.id].logtypes[logIndex]
        if (!logType) return printError(`\`${logTypeRequest}\` is not a valid log name. Check \`;commands changelog\` for valid logs.`)

        const { currentWeekName: currentweek } = clConfig[member.guild.id].currentweeks.find(week => week.case == logType) || {}

        // confirm
        const confirmEmbed = new Discord.EmbedBuilder()
            .setAuthor({ name: interaction.member.displayName, iconURL: member.displayAvatarURL() })
            .setTitle('Confirm Changelog')
            .setColor('Blue')
            .setDescription(`Attempting to update ${member}`)
            .addFields(
                { name: 'Action', value: operator, inline: true },
                { name: 'Log', value: `${logType?.deCamelCase()}`, inline: true },
                { name: 'Change', value: `${count}`, inline: true },
                { name: 'Member', value: `${member}`, inline: true }
            )
            .setTimestamp(new Date())

        await interaction.reply({ embeds: [confirmEmbed], ephemeral: true, allowedMentions: { repliedUser: false } })

        /** @type {Discord.Message} */
        const changelogConfirmed = await interaction.confirmReply()

        if (currentweek) {
            confirmEmbed.addFields({ name: 'Changing Total', value: changelogConfirmed ? '✅' : '❌' })
                .setDescription(`Do you also want to update ${currentweek?.deCamelCase()}`)
                .setTitle('Confirm Changelog - Currentweek')
                .setColor('Purple')
        }

        const currentweekConfirmed = currentweek && await interaction.editReply({ embeds: [confirmEmbed], components: [] }).then(() => interaction.confirmReply())

        const hasChanges = currentweekConfirmed || changelogConfirmed

        let confirmedSet = op != 's'
        if (hasChanges && op == 's') {
            const text = []
            if (changelogConfirmed) text.push(`\`${logType.deCamelCase()}\``)
            if (currentweekConfirmed) text.push(`\`${currentweek.deCamelCase()}\``)
            confirmEmbed.setTitle('Attempt to Set')
                .setDescription(`Are you **SURE** you want to **SET** ${text.join(' and ')} to ${count} instead of adding or removing?`)
                .setColor('DarkOrange')
                .setFields()
            confirmedSet = await interaction.editReply({ embeds: [confirmEmbed], components: [] }).then(() => interaction.confirmReply())
        }

        if (!confirmedSet || !hasChanges) {
            confirmEmbed.setTitle('Changelog Cancelled')
                .setColor('Red')
                .setDescription(`Cancelled changelog for ${member}`)
                .setFields()
            return interaction.editReply({ embeds: [confirmEmbed], components: [] })
        }
        async function getUserLogs() {
            return currentweek
                ? await db.promise().query('SELECT ??, ?? FROM users WHERE id = ?', [logType, currentweek, member.id])
                : await db.promise().query('SELECT ?? FROM users WHERE id = ?', [logType, member.id])
        }

        async function updateUserLogs(logType) {
            return op == 's'
                ? await db.promise().query('UPDATE users SET ?? = ? WHERE id = ?', [logType, count, member.id])
                : await db.promise().query('UPDATE users SET ?? = GREATEST(CAST(?? AS SIGNED) + ?, 0) WHERE id = ?', [logType, logType, op == 'r' ? -count : count, member.id])
        }

        const [oldLogs] = await getUserLogs()
        if (changelogConfirmed) await updateUserLogs(logType)
        if (currentweekConfirmed) await updateUserLogs(currentweek)
        const [newLogs] = await getUserLogs()

        const embed = new Discord.EmbedBuilder()
            .setColor('Green')
            .setTitle('Changelog')
            .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
            .setDescription('Changelog performed')
            .addFields(
                { name: 'Member', value: `${member}\n\`${member.displayName}\``, inline: true },
                { name: 'Mod', value: `${interaction.member}\n\`${interaction.member.displayName}\``, inline: true },
                { name: 'Action', value: `${operator} ${count}`, inline: true },
                { name: 'Log', value: `\`${logType?.deCamelCase()}\` ${changelogConfirmed ? '✅' : '❌'}\nOld Value: \`${oldLogs[0][logType]}\`\nNew Value: \`${newLogs[0][logType]}\``, inline: true }
            )
            .setTimestamp(new Date())

        if (currentweek) embed.addFields({ name: 'Quota', value: `\`${currentweek?.deCamelCase()}\` ${currentweekConfirmed ? '✅' : '❌'}\nOld Value: \`${oldLogs[0][currentweek]}\`\nNew Value: \`${newLogs[0][currentweek]}\``, inline: true })

        modlogs.send({ embeds: [embed] })
        interaction.editReply({ embeds: [embed], components: [] })
    },
    /**
     * @param {Discord.Message} message
     * @param {string[]} args
     * @param {Discord.Client} bot
     * @param {*} db
     */
    async execute(message, args, bot, db) { await this.processChangeLog(message, bot, db) },
    async slashCommandExecute(interaction, bot, db) { await this.processChangeLog(interaction, bot, db) }
}
