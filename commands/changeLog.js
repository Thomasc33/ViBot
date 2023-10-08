const Discord = require('discord.js')
const db = require('../data/changelog.json')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

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
        return getLogTypes(guild.id) ? getLogTypes(guild.id).toString() : `Not setup for guild ${guild.id}`
    },
    getSlashCommandData(guild) {
        const json = slashCommandJSON(this, guild)
        // Magic regex!
        // Makes the log type names look pretty :3
        if (db[guild.id]) json[0].options[2].choices = db[guild.id].logtypes.map((k) => ({ name: k.charAt(0).toUpperCase() + k.slice(1).replace(/[A-Z]|(?<=3).|o3|p(?=op)/g, (i) => ` ${i.toUpperCase()}`), value: k }))
        return json
    },
    async execute(message, args, bot, db) {
        if (args.length < 4) return
        const logTypes = getLogTypes(message.guild.id)
        const currentweek = getCurrentWeekTypes(message.guild.id) || []
        if (!logTypes) return message.channel.send('No stored log types')

        // args 0
        const member = message.guild.findMember(args[0])
        if (!member) return message.channel.send('User not found')

        // args 1
        const operator = args[1].charAt(0).toLowerCase()
        if (operator != 'a' && operator != 'r' && operator != 's') return message.channel.send(`\`${args[1]}\` not recognized. Please try \`add, remove, or set\``)

        // args 2
        const logType = args[2].toLowerCase()
        const logIndex = logTypes.findIndex(e => logType == e.toLowerCase())
        if (logIndex == -1) return message.channel.send(`\`${args[2]}\` not recognized. Check out \`;commands changelog\` for a list of log types`)

        // args 3
        const count = parseInt(args[3])
        if (!count) return message.channel.send(`${args[3]} is not a valid number`)
        if (count < 0) return message.channel.send('Cannot change logs to a negative number')

        // change logs
        let query = `UPDATE users SET ${logTypes[logIndex]} = `
        switch (operator) {
            case 'a':
                query += `${logTypes[logIndex]} + ${count} `
                break
            case 'r':
                query += `${logTypes[logIndex]} - ${count} `
                break
            case 's':
            default:
                query += `${count} `
                break
        }
        query += `WHERE id = '${member.id}'`

        // confirm
        const confirmEmbed = new Discord.EmbedBuilder()
            .setTitle('Confirm Action')
            .setDescription(`${args[1]} ${count} ${logTypes[logIndex]} to ${member}`)
        await message.channel.send({ embeds: [confirmEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(message.author.id)) {
                if (operator != 's') {
                    for (const i of currentweek) {
                        if (i.case == logTypes[logIndex]) {
                            const currentWeekConfirmEmbed = new Discord.EmbedBuilder()
                                .setTitle('Confirm Action')
                                .setDescription('Do you also want to add/remove this from currentweek?')
                            // eslint-disable-next-line no-await-in-loop
                            await message.channel.send({ embeds: [currentWeekConfirmEmbed] }).then(async confirmMessageWeek => {
                                if (await confirmMessageWeek.confirmButton(message.author.id)) {
                                    let currentWeekQuery = 'UPDATE users SET '
                                    const { currentWeekName } = i
                                    if (operator == 'a') currentWeekQuery += `${currentWeekName} = ${currentWeekName} + ${count} `
                                    else currentWeekQuery += `${currentWeekName} = ${currentWeekName} - ${count} `
                                    currentWeekQuery += `WHERE id = '${member.id}'`
                                    db.query(currentWeekQuery, err => {
                                        if (err) message.channel.send(`\`${err}\``)
                                    })
                                    confirmMessageWeek.delete()
                                    sendQuery()
                                } else {
                                    confirmMessageWeek.delete()
                                    sendQuery()
                                }
                            })
                            break
                        }
                    }
                    sendQuery()
                }
                await confirmMessage.delete()
            } else {
                await confirmMessage.delete()
                message.react('✅')
            }
        })

        function sendQuery() {
            db.query(query, err => {
                if (err) message.channel.send(`\`${err}\``)
                message.react('✅')
            })
        }
    },
    async slashCommandExecute(interaction, bot, db) {
        const logTypes = getLogTypes(interaction.guild.id)
        const currentweek = getCurrentWeekTypes(interaction.guild.id) || []
        if (!logTypes) return interaction.replyUserError('No stored log types')

        // args 0
        const member = interaction.options.getMember('user')
        if (!member) return interaction.replyUserError('User not found')

        // args 1
        const operator = interaction.options.getString('operator').charAt(0).toLowerCase()
        if (operator != 'a' && operator != 'r' && operator != 's') return interaction.replyUserError(`\`${interaction.options.getString('operator')}\` not recognized. Please try \`add, remove, or set\``)

        // args 2
        const logType = interaction.options.getString('type').toLowerCase()
        const logIndex = logTypes.findIndex(e => logType == e.toLowerCase())
        if (logIndex == -1) return interaction.replyUserError(`\`${interaction.options.getString('type')}\` not recognized. Check out \`;commands changelog\` for a list of log types`)

        // args 3
        const count = interaction.options.getInteger('number')
        if (!count) return interaction.replyUserError(`${interaction.options.getInteger('number')} is not a valid number`)
        if (count < 0) return interaction.replyUserError('Cannot change logs to a negative number')

        // change logs
        const queryArgs = { count, column: logTypes[logIndex], id: member.id }
        // confirm
        const confirmEmbed = new Discord.EmbedBuilder()
            .setTitle('Confirm Action')
            .setDescription(`${interaction.options.getString('operator')} ${count} ${logTypes[logIndex]} to ${member}`)
        const interactionRow = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Confirm')
                    .setStyle('Success'),
                new Discord.ButtonBuilder()
                    .setCustomId('cancel')
                    .setLabel('Cancel')
                    .setStyle('Danger')
            )
        const mes = await interaction.reply({ embeds: [confirmEmbed], ephemeral: true, components: [interactionRow], fetchReply: true })
        const filter = (i) => i.user.id == interaction.user.id && (i.customId == 'confirm' || i.customId == 'cancel')
        const col = mes.createMessageComponentCollector({ filter, time: 10000, max: 1 })
        col.on('collect', async confirmationInteraction => {
            col.stop()
            if (confirmationInteraction.customId == 'confirm') {
                if (operator == 's') send(confirmationInteraction)
                else {
                    const weeks = currentweek.filter(w => w.case == logTypes[logIndex])
                    weeks.forEach(async week => {
                        const currentWeekConfirmEmbed = new Discord.EmbedBuilder()
                            .setTitle('Update Current Week?')
                            .setDescription('Do you also want to add/remove this from currentweek?')
                        const cwInteractionRow = new Discord.ActionRowBuilder()
                            .addComponents(
                                new Discord.ButtonBuilder()
                                    .setCustomId('confirm')
                                    .setLabel('Yes')
                                    .setStyle('Success'),
                                new Discord.ButtonBuilder()
                                    .setCustomId('cancel')
                                    .setLabel('No')
                                    .setStyle('Danger')
                            )
                        await confirmationInteraction.update({ embeds: [currentWeekConfirmEmbed], components: [cwInteractionRow] })
                        const currentWeekCol = mes.createMessageComponentCollector({ filter, time: 10000, max: 1 })
                        currentWeekCol.on('collect', async i2 => {
                            currentWeekCol.stop()
                            if (i2.customId == 'confirm') {
                                await db.promise().query('UPDATE users SET ?? = ?? + ? where id = ?', [week.currentWeekName, week.currentWeekName, operator == 'a' ? count : -count, member.id]).then(() => send(i2), (err) => {
                                    console.log(err)
                                    currentWeekConfirmEmbed.setDescription('Error updating currentweek')
                                    i2.reply({ embeds: [currentWeekConfirmEmbed], components: [], ephemeral: true })
                                })
                            } else send(i2)
                        })
                    })
                    if (weeks.length) send(confirmationInteraction)
                }
            } else {
                confirmEmbed.setDescription('Action cancelled')
                confirmationInteraction.update({ embeds: [confirmEmbed], components: [] })
            }
        })
        function send(interaction) {
            const queryText = operator == 's'   ? 'UPDATE users SET ?? = ? WHERE id = ?'            : 'UPDATE users SET ?? = ?? + ? WHERE id = ?'
            const queryParams = operator == 's' ? [queryArgs.column, queryArgs.count, queryArgs.id] : [queryArgs.column, queryArgs.column, operator == 'a' ? queryArgs.count : -queryArgs.count, queryArgs.id]
            db.query(queryText, queryParams, err => {
                if (err) {
                    console.log(err)
                    confirmEmbed.setDescription('Error updating logs')
                    interaction.update({ embeds: [confirmEmbed], components: [] })
                } else {
                    confirmEmbed.setDescription('Logs updated')
                    interaction.update({ embeds: [confirmEmbed], components: [] })
                }
            })
        }
    }

}

function getLogTypes(guildid) {
    return db[guildid] ? db[guildid].logtypes : null
}

/**
 * @typedef {{
 *  case: string,
 *  currentWeekName: string
 * }} CurrentWeekItem
 */

/**
 * @param {Discord.Snowflake} guildid
 * @returns {CurrentWeekItem[]?}
 */
function getCurrentWeekTypes(guildid) {
    return db[guildid] ? db[guildid].currentweeks : null
}
