const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const keypops = require('../data/keypop.json')
const keyRoles = require('./keyRoles')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')
const { createReactionRow } = require('../redis.js')

module.exports = {
    name: 'pop',
    description: 'Logs key pops',
    getNotes(guild, member) {
        return keypops[guild.id] ? Object.keys(keypops[guild.id]).toString() : `not setup for guild ${guild.id}`
    },
    requiredArgs: 2,
    role: 'eventrl',
    args: [
        slashArg(SlashArgType.String, 'keytype', {
            description: 'The type of key to pop'
        }),
        slashArg(SlashArgType.User, 'user', {
            description: 'The key popper'
        }),
        slashArg(SlashArgType.Integer, 'count', {
            required: false,
            description: 'The number of keys to add (default 1)'
        }),
    ],
    getSlashCommandData(guild) {
        const json = slashCommandJSON(this, guild)
        if (keypops[guild.id]) json[0].options[0].choices = slashChoices(Object.keys(keypops[guild.id]))
        return json
    },
    async execute(message, args) {
        // Initialize
        let count = 1
        if (args.length < 1) return
        if (args.length > 2) count = parseInt(args[2])
        if (isNaN(count) || !count) count = 1
        let user = message.mentions.members.first()
        if (!user) user = message.guild.members.cache.get(args[1])
        if (!user) user = message.guild.members.cache.filter(user => user.nickname !== null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()))
        if (!user) return message.replyUserError('User not found')

        // Validate Command Arguments
        if (!keypops[message.guild.id]) return message.replyUserError('Key information missing for this guild')
        const keyInfo = module.exports.findKey(message.guild.id, args[0].toLowerCase())
        if (!keyInfo) return message.replyUserError(`\`${args[0]}\` not recognized`)

        // Create Discord Embed Confirmation
        const confirmEmbed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`Are you sure you want to log \`\`${count}\`\` **${keyInfo.name}** pops for ${user.nickname}?\n\nPlease select which key.`)

        // add buttons initialized with regular key button
        const buttons = new Discord.ActionRowBuilder()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('Regular Key')
                    .setLabel('Regular Key')
                    .setStyle(Discord.ButtonStyle.Primary)
            )

        // only add modded button if the key is able to be modded
        if (keyInfo.modded) {
            buttons.addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('Modded Key')
                    .setLabel('Modded Key')
                    .setStyle(Discord.ButtonStyle.Primary)
            )
        }

        // add cancel button to the end
        buttons.addComponents(
            new Discord.ButtonBuilder()
                .setCustomId('Cancelled')
                .setLabel('❌ Cancel')
                .setStyle(Discord.ButtonStyle.Danger)
        )

        const reply = await message.reply({ embeds: [confirmEmbed], components: [buttons], ephemeral: true })
        createReactionRow(reply, module.exports.name, 'handleButtons', buttons, message.author, { userId: user.id, keyInfo, count })
    },
    async handleButtons(bot, confirmMessage, db, choice, state) {
        const user = confirmMessage.interaction.guild.members.cache.get(state.userId)
        const { count, keyInfo } = state
        const settings = bot.settings[confirmMessage.interaction.guild.id]
        const { guild } = confirmMessage.interaction
        let moddedKey = false
        if (!choice || choice == 'Cancelled') return confirmMessage.delete()
        if (choice == 'Modded Key') moddedKey = true

        // Execute Database Query
        db.query('SELECT * FROM users WHERE id = ?', [user.id], async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (rows.length == 0) {
                const success = await new Promise((res) => {
                    db.query('INSERT INTO users (id) VALUES (?)', [user.id], (err, rows) => {
                        if (err || !rows || rows.length == 0) {
                            confirmMessage.interaction.reply({
                                embeds: [
                                    new Discord.EmbedBuilder().setDescription(`Unable to add <@!${user.id}> to the database.`).addFields([{ name: 'Error', value: `${err || 'Unknown reason'}` }])
                                ],
                                ephemeral: true
                            })
                            res(false)
                        } else res(true)
                    })
                })
                if (!success) return
            }
            const consumablepops = {
                userid: user.id,
                guildid: guild.id,
                unixtimestamp: Date.now(),
                amount: count,
                ismodded: moddedKey,
                templateid: keyInfo.templateID
            }
            db.query(`INSERT INTO consumablepops (${Object.keys(consumablepops).join(', ')}) VALUES (?, ?, ?, ?, ?, ?)`, Object.values(consumablepops), err => {
                if (err) throw err
                if (err) return console.log(`${keyInfo.schema} missing from ${guild.name} ${guild.id}`)
            })
            db.query(`UPDATE users SET ${keyInfo.schema} = ${keyInfo.schema} + ? WHERE id = ?`, [count, user.id], err => {
                if (err) throw err
                keyRoles.checkUser(user, bot, db)
            })
            if (moddedKey) {
                db.query('UPDATE users SET moddedPops = moddedPops + ? WHERE id = ?', [count, user.id], err => {
                    if (err) throw err
                    keyRoles.checkUser(user, bot, db)
                })
            }
            const embed = new Discord.EmbedBuilder()
                .setColor('#0000ff')
                .setTitle('Key logged!')
                .setDescription(`${user} now has \`\`${parseInt(rows[0][keyInfo.schema]) + parseInt(count)}\`\` ${keyInfo.name} pops`)
            confirmMessage.interaction.channel.send({ embeds: [embed] })
        })

        // Add Points to Database
        if (settings.backend.points && keyInfo.points) {
            let points = settings.points[keyInfo.points] * count
            if (user.roles.cache.hasAny(...settings.lists.perkRoles.map(role => settings.roles[role]))) points *= settings.points.nitromultiplier
            if (moddedKey) points *= settings.points.keymultiplier
            db.query('UPDATE users SET points = points + ? WHERE id = ?', [points, user.id])
        }        // Delete Confirmation Message
        return confirmMessage.delete()
    },
    findKey(guildid, key) {
        const info = keypops[guildid]
        if (Object.keys(info).includes(key)) return info[key]
        for (const i of Object.keys(info)) {
            if (info[i].alias.includes(key)) return info[i]
            if (info[i].schema.toLowerCase() == (key.toLowerCase())) return info[i]
        }
        return null
    }
}
