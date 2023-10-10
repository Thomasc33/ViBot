const Discord = require('discord.js')
const mysql = require('mysql2')

const ErrorLogger = require('./lib/logError')
const CommandLogger = require('./lib/logCommand')
const { logMessage, genPoint, writePoint } = require('./metrics.js')

const restarting = require('./commands/restart')
const verification = require('./commands/verification')
const stats = require('./commands/stats')
const modmail = require('./commands/modmail')
const { argString } = require('./commands/commands.js')
const { getDB } = require('./dbSetup.js')
const { LegacyCommandOptions, LegacyParserError } = require('./utils.js')

class MessageManager {
    #bot
    #botSettings
    #prefix
    #tokenDB
    #cooldowns = new Discord.Collection()
    #vibotControlGuild

    constructor(bot, botSettings) {
        this.#bot = bot
        this.#botSettings = botSettings
        this.#prefix = botSettings.prefix
        this.#tokenDB = mysql.createConnection(botSettings.tokenDBInfo)

        this.#tokenDB.connect(err => {
            if (err) ErrorLogger.log(err, bot)
            console.log('Connected to token database')
        })

        this.#tokenDB.on('error', err => {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') this.#tokenDB = mysql.createConnection(botSettings.tokenDBInfo)
            else ErrorLogger.log(err, bot)
        })
    }

    /**
     * Handles any messages sent to the bot. Seperates out DMs, normal messages, and commands.
     * @param {Message} message
     * @returns
     */
    handleMessage(message) {
        switch (message.channel.type) {
            case Discord.ChannelType.GuildText:
                if (message.author.bot) return
                if (message.content.startsWith(this.#prefix) && message.content[this.#prefix.length] !== ' ') {
                    // Handle commands (messages that start with a prefix + command)
                    this.handleCommand(message, false)
                } else {
                    // Handle non-command messages
                    this.autoMod(message)
                }

                break
            case Discord.ChannelType.DM:
                try {
                    this.dmHandler(message)
                } catch (er) {
                    ErrorLogger.log(er, this.#bot, message.guild)
                }

                break
            default:
            // Log an error? I guess?
        }
    }

    /**
     * Checks to see if a user has permission to use a command in a server
     * @param {GuildMember} member
     * @param {Guild} guild
     * @param {Command Module} commmand
     * @returns {Boolean}
     */
    #commandPermitted(member, guild, command) {
        // All of these are for user readibility, making it much easier for you reading this right now. You're welcome :)
        const memberPosition = member.roles.highest.position
        const settings = this.#bot.settings[guild.id]
        const roleCache = guild.roles.cache
        const memberId = member.id
        return (
            // Check command role permission
            (memberPosition >= roleCache.get(settings.roles[command.role]).position)
            // Check role overrides
            || (settings.commandsRolePermissions[command.name] && memberPosition >= roleCache.get(settings.roles[settings.commandsRolePermissions[command.name]]).position)
            // Check patreon
            || (command.patreonRole && this.checkPatreon(command.patreonRole, memberId))
            // Check user override
            || (command.userOverride && command.userOverride.includes(memberId))
            // Check admin override
            || this.#bot.adminUsers.includes(memberId)
        )
    }

    /**
     * Handle logging and replying to command errors
     * @param {Discord.Message | Discord.Interaction} e
     * @param {string} commandName
     * @param {string} userMsg
     * @param {string?} logMsg
     */
    async #commandError(e, commandName, userMsg, logMsg) {
        if (userMsg) await e.reply(userMsg)
        logMessage('command', e, (p) => {
            p.tag('command', commandName)
            p.tag('errortype', logMsg || userMsg)
            return p
        })
    }

    async #validateCommand(e, command, commandName, argCount) {
        if (!command) return await this.#commandError(e, commandName, 'Command doesnt exist, check `commands` and try again', 'does not exist')

        // Validate the command is enabled
        if (!this.#bot.settings[e.guild.id].commands[command.name]) return await this.#commandError(e, commandName, 'This command is disabled', 'disabled')

        // Validate the command is not disabled during restart if a restart is pending
        if (restarting.restarting && !command.allowedInRestart && !this.#bot.adminUsers.includes(e.member.id)) return await this.#commandError(e, commandName, 'Cannot execute command as a restart is pending', 'pending restart')

        // Validate the user has permission to use the command
        if (!e.guild.roles.cache.get(this.#bot.settings[e.guild.id].roles[command.role])) return await this.#commandError(e, commandName, 'Permissions not set up for this commands role', 'permissions not setup')

        if (!this.#commandPermitted(e.member, e.guild, command)) return await this.#commandError(e, commandName, 'You do not have permission to use this command', 'no permission')

        if (command.requiredArgs && command.requiredArgs > argCount) return await this.#commandError(e, commandName, `Command Entered incorrecty. \`${this.#botSettings.prefix}${command.name} ${argString(command.args)}\``, 'invalid syntax')
    }

    async #runCommand(e, isInteraction, command, commandName, args) {
        const point = genPoint('commandexecution', e).tag('command', commandName)
        try {
            const db = getDB(e.guild.id)
            if (isInteraction && command.slashCommandExecute) command.slashCommandExecute(e, this.#bot, db)
            else {
                // Add the shim for options
                if (!isInteraction && typeof(command.args) == 'object') {
                    try {
                        const lco = new LegacyCommandOptions(command.args, e, command.varargs)
                        Object.defineProperty(e, 'options', {
                            get() {
                                return lco
                            }
                        })
                    } catch (err) {
                        // can't seem to reason around reducing depth here
                        // eslint-disable-next-line max-depth
                        if (err instanceof LegacyParserError) return e.replyUserError(err.message)
                        throw err
                    }
                }
                const start = Date.now()
                await command.execute(e, args, this.#bot, db)
                point.intField('duration', Date.now() - start)
            }
            db.query('INSERT INTO commandusage (command, userid, guildid, utime) VALUES (?, ?, ?, ?)', [command.name, e.member.id, e.guild.id, Date.now()])
            if (isInteraction) {
                CommandLogger.logInteractionCommand(e, this.#bot)
            } else {
                CommandLogger.log(e, this.#bot)
            }
        } catch (er) {
            ErrorLogger.log(er, this.#bot, e.guild)
            e.reply('Issue executing the command, check `;commands` and try again')
            point.stringField('error', er.name)
        } finally {
            writePoint(point)
        }
    }

    /**
     * Runs the command processing pipeline including parsing, state checks, permissions checks, etc.
     * @param {Discord.Message | Discord.Interaction} e
     * @param {boolean} isInteraction
     * @returns
     */
    async handleCommand(e, isInteraction) {
        if (isInteraction && !this.#bot.settings[e.guild.id]) return

        const getArgs = () => {
            const result = {}
            if (isInteraction) {
                result.args = e.getArgs()
                result.commandName = e.commandName
                result.argCount = e.options.length
            } else {
                result.args = e.content.slice(this.#prefix.length).split(/ +/gi)
                result.commandName = result.args.shift()
                result.argCount = args.length
            }
            return result
        }

        const { args, commandName, argCount } = getArgs()

        // Get the command
        const command = this.#bot.commands.get(commandName) || this.#bot.commands.find(cmd => cmd.alias && cmd.alias.includes(commandName))

        // Ignore problems if command is eval, user is bot admin, and server is vibot info
        try {
            if (require('./settings.json').botOwners.includes(e.member.id) && e.guild.id == '739623118833713214') return await command.execute(e, args, this.#bot, getDB(e.guild.id))
        } catch (er) {
            console.log('botOwners not found in settings.json. Update settings with new items from settings_template')
        }

        const validationResult = await this.#validateCommand(e, command, commandName, argCount)
        if (validationResult) return validationResult

        if (command.cooldown) {
            if (this.#cooldowns.get(command.name)) {
                if (Date.now() + (command.cooldown * 1000) < Date.now()) this.#cooldowns.delete(command.name)
                else return await this.#commandError(e, commandName, null, 'cooldown')
            } else this.#cooldowns.set(command.name, Date.now())
            setTimeout(() => { this.#cooldowns.delete(command.name) }, command.cooldown * 1000)
        }
        return await this.#runCommand(e, isInteraction, command, commandName, args)
    }

    /**
     * Handles DM's sent to the bot. Seperates modmail from commands. Executes commands or sends to modmail
     * @param {Discord.Message} message
     * @returns
     */
    async dmHandler(message) {
        if (verification.checkActive(message.author.id)) return
        let cancelled = false
        const statsTypos = ['stats', 'satts', 'stat', 'status', 'sats', 'stata', 'stts', 'stas']
        if (statsTypos.includes(message.content.split(' ')[0].replace(/[^a-z0-9]/gi, '').toLowerCase())) {
            let guild
            this.#bot.guilds.cache.forEach(g => {
                if (g.members.cache.get(message.author.id)) {
                    guild = g
                }
            })
            if (!guild) cancelled = true
            this.#logCommand(guild, message)
            if (!cancelled) {
                try {
                    stats.execute(message, [], this.#bot)
                } catch (er) {
                    message.channel.send('You are not currently logged in the database. The database gets updated every 24-48 hours')
                }
            }
        } else if (/^.?(pl[ea]{0,2}se?\s*)?(j[oi]{2}n|d[ra]{2}g\s*(me)?)(\s*pl[ea]{0,2}se?)?$/i.test(message.content)) {
            const guild = await this.getGuild(message).catch(() => { cancelled = true })
            this.#logCommand(guild, message)
            if (!cancelled) {
                require('./commands/joinRun').dmExecution(message, message.content.split(/\s+/), this.#bot, getDB(guild.id), guild, this.#tokenDB)
            }
        } else {
            if (message.content.replace(/[^0-9]/g, '') == message.content) return
            const args = message.content.split(/ +/)
            const commandName = args.shift().toLowerCase().replace(this.#prefix, '')
            const command = this.#bot.commands.get(commandName) || this.#bot.commands.find(c => c.alias && c.alias.includes(commandName))
            if (!command) this.#sendModMail(message)
            else if (command.dms) {
                let guild
                if (command.dmNeedsGuild) {
                    guild = await this.getGuild(message).catch(() => { cancelled = true })
                    this.#logCommand(guild, message)
                }

                if (!cancelled) {
                    const db = command.dmNeedsGuild ? getDB(guild.id) : null
                    const member = guild.members.cache.get(message.author.id)
                    const role = guild.roles.cache.get(this.#bot.settings[guild.id].roles[command.role])

                    if (member.roles.highest.position < role.position && !this.#bot.adminUsers.includes(member.id)) this.#sendModMail(message)
                    else command.dmExecution(message, args, this.#bot, db, guild, this.#tokenDB)
                }
            } else message.channel.send('This command does not work in DM\'s. Please use this inside of a server')
        }
    }

    async #logCommand(guild, message) {
        if (!guild || !this.#bot.settings[guild.id]) return
        const logEmbed = new Discord.EmbedBuilder()
            .setAuthor({ name: message.author.tag })
            .setColor('#0000ff')
            .setDescription(`<@!${message.author.id}> sent the bot: "${message.content}"`)
            .setFooter({ text: `User ID: ${message.author.id}` })
            .setTimestamp()
        if (message.author.avatarURL()) logEmbed.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL() })
        guild.channels.cache.get(this.#bot.settings[guild.id].channels.dmcommands).send({ embeds: [logEmbed] }).catch(er => { ErrorLogger.log(new Error(`Unable to find/send in settings.channels.dmcommands channel for ${guild.id}`), this.#bot, guild) })
    }

    async #sendModMail(message) {
        const guild = await this.getGuild(message)
        if (!guild) return
        const confirmModMailEmbed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Are you sure you want to message modmail?')
            .setFooter({ text: 'Spamming modmail with junk will result in being modmail blacklisted' })
            .setDescription(`\`\`\`${message.content}\`\`\``)
        await message.channel.send({ embeds: [confirmModMailEmbed] }).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(message.author.id)) {
                modmail.sendModMail(message, guild, this.#bot, getDB(guild.id))
                return confirmMessage.delete()
            }
            return confirmMessage.delete()
        })

        // Check blacklist
    }

    /**
     * If enabled, will mute users for pinging roles
     * @param {Discord.Message} message
     * @returns
     */
    async autoMod(message) {
        const settings = this.#bot.settings[message.guild.id]
        if (!settings || !settings.backend.automod) return
        if (!message.member.roles.highest || message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.eventrl).position) return
        if (message.mentions.roles.size != 0) mute('Pinging Roles', 2)

        function mute(reason, time) {
            // Time: 1=1 hour, 2=1 day
            let timeString; let timeValue
            if (time == 1) {
                timeString = '1 Hour'
                timeValue = 3600000
            } else if (time == 2) {
                timeString = '1 Day'
                timeValue = 86400000
            }

            message.member.roles.add(settings.roles.muted)
                .then(() => this.#bot.dbs[message.guild.id].query('INSERT INTO mutes (id, guildid, muted, reason, modid, uTime) VALUES (?, ?, ?, ?, ?, ?)', [message.author.id, message.guild.id, true, reason, this.#bot.user.id, Date.now() + timeValue]))
                .then(() => message.author.send(`You have been muted in \`${message.guild.name}\` for \`${reason}\`. This will last for \`${timeString}\``))
                .then(() => {
                    const modlog = message.guild.channels.cache.get(settings.channels.modlog)
                    if (!modlog) return ErrorLogger.log(new Error('Mod log not found for automod'), this.#bot, message.guild)
                    modlog.send(`${message.member} was muted for \`${timeString}\` for \`${reason}\``)
                })
        }
    }

    /**
     * Returns common guild, or prompts for a guild selection
     * @param {Discord.Message} message
     * @returns {Discord.Guild} guild
     */
    async getGuild(message) {
        const guilds = []
        const guildNames = []
        this.#bot.guilds.cache.each(g => {
            const settings = this.#bot.settings[g.id]
            if (this.#bot.emojiServers.includes(g.id)) return
            if (this.#bot.devServers.includes(g.id)) return
            if (!g.members.cache.get(message.author.id)) return
            if (!settings.backend.modmail) return
            guilds.push(g)
            guildNames.push(g.name)
        })
        if (guilds.length == 0) return false // We don't share servers
        if (guilds.length == 1) return guilds[0]

        const guildSelectionEmbed = new Discord.EmbedBuilder()
            .setTitle('Please select a server')
            .setColor('#fefefe')
            .setDescription('Press Cancel if you don\'t wanna proceed')
        const guildSelectionMessage = await message.channel.send({ embeds: [guildSelectionEmbed] })
        const choice = await guildSelectionMessage.confirmList(guildNames, message.author.id)
        guildSelectionMessage.delete()
        if (!choice || choice == 'Cancelled') return false

        for (const i in guilds) {
            if (guilds[i].name == choice) return guilds[i]
        }
    }

    /**
     * Checks user by ID's to see if they have a patreon role in control panel discord
     * @param {String} patreonRoleId
     * @param {String} userId
     * @returns
     */
    checkPatreon(patreonRoleId, userId) {
        if (!this.#vibotControlGuild) this.#vibotControlGuild = this.#bot.guilds.cache.get('739623118833713214')
        if (this.#vibotControlGuild.members.cache.get(userId) && this.#vibotControlGuild.members.cache.get(userId).roles.cache.has(patreonRoleId)) return true
        return false
    }
}

module.exports = { MessageManager }
