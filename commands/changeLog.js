const Discord = require('discord.js')
const db = require('../data/changelog.json')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'changelog',
    role: 'headeventrl',
    description: 'Changes logs',
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: 'User to change logs for',
        }),
        slashArg(SlashArgType.String, 'operator', {
            description: 'Operator to use',
            choices: slashChoices(['Add', 'Remove', 'Set'])
        }),
        slashArg(SlashArgType.String, 'type', {
            description: 'Type of log to change',
        }),
        slashArg(SlashArgType.Integer, 'number', {
            description: 'Number of logs to change'
        })
    ],
    requiredArgs: 4,
    getNotes(guildid, member) {
        return getLogTypes(guildid) ? getLogTypes(guildid).toString() : `Not setup for guild ${guildid}`
    },
    getSlashCommandData(guild) {
        let json = slashCommandJSON(this, guild)
        // Magic regex!
        // Makes the log type names look pretty :3
        if (db[guild.id]) json[0].options[2]['choices'] = db[guild.id].logtypes.map((k) => ({name: k.charAt(0).toUpperCase() + k.slice(1).replace(/[A-Z]|(?<=3).|o3|p(?=op)/g, (i) => ` ${i.toUpperCase()}`), value: k}))
        return json
    },
    async execute(message, args, bot, db) {
        if (args.length < 4) return
        let logTypes = getLogTypes(message.guild.id)
        let currentweek = getCurrentWeekTypes(message.guild.id) || []
        if (!logTypes) return message.channel.send('No stored log types')

        //args 0
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found');

        //args 1
        let operator = args[1].charAt(0).toLowerCase()
        if (operator != 'a' && operator != 'r' && operator != 's') return message.channel.send(`\`${args[1]}\` not recognized. Please try \`add, remove, or set\``)

        //args 2
        let logType = args[2].toLowerCase()
        let logIndex = logTypes.findIndex(e => logType == e.toLowerCase())
        if (logIndex == -1) return message.channel.send(`\`${args[2]}\` not recognized. Check out \`;commands changelog\` for a list of log types`)

        //args 3
        let count = parseInt(args[3])
        if (!count) return message.channel.send(`${args[3]} is not a valid number`)
        if (count < 0) return message.channel.send('Cannot change logs to a negative number')

        //change logs
        let query = `UPDATE users SET ${logTypes[logIndex]} = `
        switch (operator) {
            case 'a':
                query += `${logTypes[logIndex]} + ${count} `
                break;
            case 'r':
                query += `${logTypes[logIndex]} - ${count} `
                break;
            case 's':
                query += `${count} `
                break;
        }
        query += `WHERE id = '${member.id}'`

        //confirm
        let confirmEmbed = new Discord.EmbedBuilder()
            .setTitle(`Confirm Action`)
            .setDescription(`${args[1]} ${count} ${logTypes[logIndex]} to ${member}`)
        await message.channel.send({ embeds: [confirmEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(message.author.id)) {
                if (operator != 's') {
                    find: {
                        for (let i of currentweek) {
                            if (i.case == logTypes[logIndex]) {
                                let currentWeekConfirmEmbed = new Discord.EmbedBuilder()
                                    .setTitle('Confirm Action')
                                    .setDescription('Do you also want to add/remove this from currentweek?')
                                await message.channel.send({ embeds: [currentWeekConfirmEmbed] }).then(async confirmMessageWeek => {
                                    if (await confirmMessageWeek.confirmButton(message.author.id)) {
                                        let currentWeekQuery = `UPDATE users SET `
                                        let currentWeekName = i.currentWeekName
                                        if (operator == 'a') currentWeekQuery += `${currentWeekName} = ${currentWeekName} + ${count} `
                                        else currentWeekQuery += `${currentWeekName} = ${currentWeekName} - ${count} `
                                        currentWeekQuery += `WHERE id = '${member.id}'`
                                        db.query(currentWeekQuery, (err, rows) => {
                                            if (err) message.channel.send(`\`${err}\``)
                                        })
                                        confirmMessageWeek.delete()
                                        sendQuery()
                                    } else {
                                        confirmMessageWeek.delete()
                                        sendQuery()
                                    }
                                })
                                break find;
                            }
                        }
                        sendQuery()
                    }
                }
                await confirmMessage.delete()
            } else {
                await confirmMessage.delete()
                message.react('✅')
            }
        })

        function sendQuery() {
            db.query(query, (err, rows) => {
                if (err) message.channel.send(`\`${err}\``)
                message.react('✅')
            })
        }
    },
    async slashCommandExecute(interaction, bot, db) {
        let logTypes = getLogTypes(interaction.guild.id)
        let currentweek = getCurrentWeekTypes(interaction.guild.id) || []
        if (!logTypes) return interaction.replyUserError('No stored log types')

        //args 0
        let member = interaction.options.getMember('user')
        if (!member) return interaction.replyUserError('User not found');

        //args 1
        let operator = interaction.options.getString('operator').charAt(0).toLowerCase()
        if (operator != 'a' && operator != 'r' && operator != 's') return interaction.replyUserError(`\`${interaction.options.getString('operator')}\` not recognized. Please try \`add, remove, or set\``)

        //args 2
        let logType = interaction.options.getString('type').toLowerCase()
        let logIndex = logTypes.findIndex(e => logType == e.toLowerCase())
        if (logIndex == -1) return interaction.replyUserError(`\`${interaction.options.getString('type')}\` not recognized. Check out \`;commands changelog\` for a list of log types`)

        //args 3
        let count = interaction.options.getInteger('number')
        if (!count) return interaction.replyUserError(`${interaction.options.getInteger('number')} is not a valid number`)
        if (count < 0) return interaction.replyUserError('Cannot change logs to a negative number')

        //change logs
        let query = `UPDATE users SET ${logTypes[logIndex]} = `
        switch (operator) {
            case 'a':
                query += `${logTypes[logIndex]} + ${count} `
                break;
            case 'r':
                query += `${logTypes[logIndex]} - ${count} `
                break;
            case 's':
                query += `${count} `
                break;
        }
        query += `WHERE id = '${member.id}'`

        //confirm
        let confirmEmbed = new Discord.EmbedBuilder()
            .setTitle(`Confirm Action`)
            .setDescription(`${interaction.options.getString('operator')} ${count} ${logTypes[logIndex]} to ${member}`)
        let interactionRow = new Discord.ActionRowBuilder()
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
        let mes = await interaction.reply({ embeds: [confirmEmbed], ephemeral: true, components: [interactionRow], fetchReply: true })
        let filter = (i) => i.user.id == interaction.user.id && (i.customId == 'confirm' || i.customId == 'cancel')
        let col = mes.createMessageComponentCollector({ filter, time: 10000, max: 1 })
        col.on('collect', async i => {
            col.stop()
            if (i.customId == 'confirm') {
                if (operator != 's') {
                    let isCurrentweek = false
                    for (let i_ of currentweek) if (i_.case == logTypes[logIndex]) {
                        isCurrentweek = true
                        let currentWeekConfirmEmbed = new Discord.EmbedBuilder()
                            .setTitle('Update Current Week?')
                            .setDescription('Do you also want to add/remove this from currentweek?')
                        let cw_interactionRow = new Discord.ActionRowBuilder()
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
                        await i.update({ embeds: [currentWeekConfirmEmbed], components: [cw_interactionRow] })
                        let currentWeekCol = mes.createMessageComponentCollector({ filter, time: 10000, max: 1 })
                        currentWeekCol.on('collect', async i2 => {
                            currentWeekCol.stop()
                            if (i2.customId == 'confirm') {
                                let currentWeekQuery = `UPDATE users SET ${i_.currentWeekName} = `
                                switch (operator) {
                                    case 'a':
                                        currentWeekQuery += `${i_.currentWeekName} + ${count} `
                                        break;
                                    case 'r':
                                        currentWeekQuery += `${i_.currentWeekName} - ${count} `
                                        break;
                                }
                                currentWeekQuery += `WHERE id = '${member.id}'`
                                const result = await db.promise().query(currentWeekQuery).then(() => send(i2), (err) => {
                                    console.log(err)
                                    currentWeekConfirmEmbed.setDescription('Error updating currentweek')
                                    i2.reply({ embeds: [currentWeekConfirmEmbed], components: [], ephemeral: true })

                                })
                            } else send(i2)
                        })
                    }
                    if (!isCurrentweek) send(i)
                } else send(i)
            } else {
                confirmEmbed.setDescription('Action cancelled')
                i.update({ embeds: [confirmEmbed], components: [] })
            }
        })
        function send(interaction) {
            db.query(query, (err, result) => {
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
function getCurrentWeekTypes(guildid) {
    return db[guildid] ? db[guildid].currentweeks : null
}
