// Imports
const Discord = require('discord.js')
const mysql = require('mysql2')
require('./lib/extensions.js')

// Import Internal Libraries
const ErrorLogger = require(`./lib/logError`)
const CommandLogger = require('./lib/logCommand')
const botSetup = require('./botSetup.js')
const memberHandler = require('./memberHandler.js')

// Specific Commands
const verification = require('./commands/verification')
const stats = require('./commands/stats')
const modmail = require('./commands/modmail')
const restarting = require('./commands/restart')

// Global Variables/Data
const botSettings = require('./settings.json')
const token = require('./data/botKey.json')
const prefix = botSettings.prefix;
const cooldowns = new Discord.Collection()
const rootCas = require('ssl-root-cas').create();
require('https').globalAgent.options.ca = rootCas;

const bot = require('./botMeta.js').bot


// Bot Event Handlers
bot.on('messageCreate', message => {
    try {
        if (!message.channel.type == Discord.ChannelType.GuildText) {
            try {
                if (message.channel.type == Discord.ChannelType.DM) return dmHandler(message);
            } catch (er) {
                ErrorLogger.log(er, bot, message.guild);
            }
        }
        if (message.author.bot) return;
        if (!bot.serverWhiteList.includes(message.guild.id)) return
        if (!message.content.startsWith(prefix)) return autoMod(message);
        if (!bot.settings[message.guild.id]) return
        const args = message.content.slice(prefix.length).split(/ +/);
        const commandName = args.shift().toLowerCase()
        if (commandName.replace(/[^a-z]/gi, '') == '') return
        const command = bot.commands.get(commandName) || bot.commands.find(cmd => cmd.alias && cmd.alias.includes(commandName))
        if (!command) return message.channel.send('Command doesnt exist, check \`commands\` and try again');
        if (!bot.settings[message.guild.id].commands[command.name]) return message.channel.send('Command doesnt exist, check \`commands\` and try again');
        if (restarting.restarting && !command.allowedInRestart) return message.channel.send('Cannot execute command as a restart is pending')
        if (!message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role])) return message.channel.send('Permissions not set up for this commands role')

        // Permission Manager
        /* 
            if (command role permission) true
            if (Role Override permission) true
            else { false }
            if (command patreon role) true
            if (Useroverride permission) true
            if (Admin user permission) true

            This order of hierachy will allow us to not spagethi code
        */

        // All of these are for user readibility, making it much easier for you reading this right now. You're welcome :)
        let hasPermissionForCommand = false // The default will be set to FALSE, if the user has the permission, we will change this to TRUE
        let memberPosition = message.member.roles.highest.position
        let settings = bot.settings[message.guild.id]
        let roleCache = message.guild.roles.cache
        let memberId = message.member.id

        if (memberPosition >= roleCache.get(settings.roles[command.role]).position) hasPermissionForCommand = true
        if (settings.commandsRolePermissions[command.name]) {
            if (memberPosition >= roleCache.get(settings.roles[settings.commandsRolePermissions[command.name]]).position) hasPermissionForCommand = true
            else hasPermissionForCommand = false
        }
        if (command.patreonRole) {
            if (checkPatreon(command.patreonRole, memberId)) hasPermissionForCommand = true
        }
        if (command.userOverride) {
            if (command.userOverride.includes(memberId)) hasPermissionForCommand = true
        }
        if (bot.adminUsers.includes(memberId)) hasPermissionForCommand = true

        if (!hasPermissionForCommand) return message.channel.send('You do not have permission to use this command')

        if (command.requiredArgs && command.requiredArgs > args.length) return message.channel.send(`Command Entered incorrecty. \`${botSettings.prefix}${command.name} ${command.args}\``)
        if (command.cooldown) {
            if (cooldowns.get(command.name)) {
                if (Date.now() + command.cooldown * 1000 < Date.now()) cooldowns.delete(command.name)
                else return
            } else cooldowns.set(command.name, Date.now())
            setTimeout(() => { cooldowns.delete(command.name) }, command.cooldown * 1000)
        }
        try {
            command.execute(message, args, bot, bot.dbs[message.guild.id], tokenDB)
            bot.dbs[message.guild.id].query(`INSERT INTO commandusage (command, userid, guildid, utime) VALUES ('${command.name}', '${message.member.id}', '${message.guild.id}', '${Date.now()}')`);
            CommandLogger.log(message, bot)
        } catch (er) {
            ErrorLogger.log(er, bot, message.guild)
            message.channel.send("Issue executing the command, check \`;commands\` and try again");
        }
    } catch (er) {
        ErrorLogger.log(er, bot, message.guild)
    }
});

bot.on('interactionCreate', async interaction => {
    // Validate the interaction is a command
    if (!interaction.isChatInputCommand()) return;
    // Validate the server is whitelisted
    if (!bot.serverWhiteList.includes(interaction.guild.id)) return
    // Validate the server has settings
    if (!bot.settings[interaction.guild.id]) return
    // Get the command
    const command = bot.commands.get(interaction.commandName);
    // Validate the command exists
    if (!command) return interaction.reply('Command doesnt exist, check \`commands\` and try again');
    // Validate the command is enabled
    if (!bot.settings[interaction.guild.id].commands[command.name]) return interaction.reply('This command is disabled');
    // Validate the command is not disabled during restart if a restart is pending
    if (restarting.restarting && !command.allowedInRestart) return interaction.reply('Cannot execute command as a restart is pending')
    // Validate the user has permission to use the command
    if (!interaction.guild.roles.cache.get(bot.settings[interaction.guild.id].roles[command.role])) return interaction.reply('Permissions not set up for this commands role')

    let hasPermissionForCommand = false // The default will be set to FALSE, if the user has the permission, we will change this to TRUE
    let memberPosition = interaction.member.roles.highest.position
    let settings = bot.settings[interaction.guild.id]
    let roleCache = interaction.guild.roles.cache
    let memberId = interaction.member.id

    if (memberPosition >= roleCache.get(settings.roles[command.role]).position) hasPermissionForCommand = true
    if (settings.commandsRolePermissions[command.name]) {
        if (memberPosition >= roleCache.get(settings.roles[settings.commandsRolePermissions[command.name]]).position) hasPermissionForCommand = true
        else hasPermissionForCommand = false
    }
    if (command.patreonRole && checkPatreon(command.patreonRole, memberId)) hasPermissionForCommand = true
    if (command.userOverride && command.userOverride.includes(memberId)) hasPermissionForCommand = true
    if (bot.adminUsers.includes(memberId)) hasPermissionForCommand = true
    if (!hasPermissionForCommand) return interaction.reply('You do not have permission to use this command')
    if (command.requiredArgs && command.requiredArgs > interaction.options.length) return interaction.reply(`Command Entered incorrecty. \`${botSettings.prefix}${command.name} ${command.args}\``)
    if (command.cooldown) {
        if (cooldowns.get(command.name)) {
            if (Date.now() + command.cooldown * 1000 < Date.now()) cooldowns.delete(command.name)
            else return
        } else cooldowns.set(command.name, Date.now())
        setTimeout(() => { cooldowns.delete(command.name) }, command.cooldown * 1000)
    }
    try {
        command.slashCommandExecute(interaction, bot, bot.dbs[interaction.guild.id], tokenDB)
        bot.dbs[interaction.guild.id].query(`INSERT INTO commandusage (command, userid, guildid, utime) VALUES ('${command.name}', '${interaction.member.id}', '${interaction.guild.id}', '${Date.now()}')`);
        CommandLogger.logInteractionCommand(interaction, bot)
    }
    catch (er) {
        ErrorLogger.log(er, bot, interaction.guild)
        interaction.reply("Issue executing the command, check \`;commands\` and try again");
    }
})

bot.on("ready", async () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    bot.user.setActivity(`vibot.tech`)
    let vi = bot.users.cache.get(botSettings.developerId)
    vi.send('Halls Bot Starting Back Up')

    await botSetup.setup(bot)
});

bot.on('guildMemberAdd', async (member) => {
    if (!bot.dbs[member.guild.id]) return

    await memberHandler.checkWasSuspended(bot, member)

    await memberHandler.checkWasMuted(bot, member)
})

bot.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!bot.dbs[member.guild.id]) return

    const settings = bot.settings[newMember.guild.id];

    if (!oldMember.roles.cache.equals(newMember.roles.cache)) return

    if (settings.commands.prunerushers) await memberHandler.pruneRushers(bot.dbs[newMember.guild.id], settings.roles.rusher, oldMember, newMember)

    if (newMember.roles.cache.has(settings.roles.lol)) return

    await memberHandler.updateAffiliateRoles(bot, newMember)
})

bot.on('guildMemberRemove', async (member) => {
    if (!bot.dbs[member.guild.id]) return

    await memberHandler.detectSuspensionEvasion(bot, member)
})

bot.on('messageReactionAdd', async (r, u) => {
    if (u.bot) return
    //modmail
    if (r.message.partial) r.message = await r.message.fetch();
    //spongemock
    if (r.emoji.id == '812959258638549022') {
        let content = [...r.message.content]
        for (let i in content) {
            if (!content[i]) continue
            try {
                if (Math.random() > .5) content[i] = content[i].toLowerCase()
                else content[i] = content[i].toUpperCase()
            } catch (er) { console.log(er) }
        }
        let spongemockEmbed = new Discord.EmbedBuilder()
            .setColor('#FDF300')
            .setDescription(content.join(''))
            .setThumbnail('https://res.cloudinary.com/nashex/image/upload/v1613698392/assets/759584001131544597_im3kgg.png')
        r.message.channel.send({ embeds: [spongemockEmbed] })
        r.remove()
    }
})

bot.on('typingStart', (c, u) => {
    if (c.type !== Discord.ChannelType.DM || u.bot || verification.checkActive(u.id)) return
    c.startTyping()
    setTimeout(() => {
        c.stopTyping()
    }, 7500)
})

bot.login(token.key);



// Process Event Listening
process.on('uncaughtException', err => {
    if (!err) return
    ErrorLogger.log(err, bot);
    if (err.fatal) process.exit(1)
})

process.on('unhandledRejection', err => {
    if (err) {
        if (err.message == 'Target user is not connected to voice.') return;
        if (err.message == 'Cannot send messages to this user') return
        if (err.message == 'Unknown Message') return
        if (err.message == 'Unknown Channel') return
        if (err.message == 'The user aborted a request.') return
    } else return
    ErrorLogger.log(err, bot);
})



// Data Base Connectors (Global DB was here, now moved to bot ready listener)
var tokenDB = mysql.createConnection(botSettings.tokenDBInfo)

tokenDB.connect(err => {
    if (err) ErrorLogger.log(err, bot);
    console.log('Connected to token database')
})

tokenDB.on('error', err => {
    if (err.code == 'PROTOCOL_CONNECTION_LOST') tokenDB = mysql.createConnection(botSettings.tokenDBInfo)
    else ErrorLogger.log(err, bot)
})



// Functions
/**
 * Handles DM's sent to the bot. Seperates modmail from commands. Executes commands or sends to modmail
 * @param {Discord.Message} message 
 * @returns 
 */
async function dmHandler(message) {
    if (message.author.bot) return;
    if (verification.checkActive(message.author.id)) return
    let cancelled = false;
    let statsTypos = ['stats', 'satts', 'stat', 'status', 'sats', 'stata', 'stts', 'stas']
    if (statsTypos.includes(message.content.split(' ')[0].replace(/[^a-z0-9]/gi, '').toLowerCase())) {
        let guild;
        bot.guilds.cache.forEach(g => {
            if (g.members.cache.get(message.author.id)) {
                guild = g;
            }
        })
        if (!guild) cancelled = true;
        logCommand(guild)
        if (!cancelled) {
            try {
                message.channel.send({ embeds: [await stats.getStatsEmbed(message.author.id, guild, bot)] })
            }
            catch (er) {
                message.channel.send('You are not currently logged in the database. The database gets updated every 24-48 hours')
            }
        }
    } else if (/^.?(pl[ea]{0,2}se?\s*)?(j[oi]{2}n|d[ra]{2}g\s*(me)?)(\s*pl[ea]{0,2}se?)?$/i.test(message.content)) {
        let guild = await getGuild(message).catch(er => cancelled = true)
        logCommand(guild)
        if (!cancelled) {
            require('./commands/joinRun').dmExecution(message, message.content.split(/\s+/), bot, bot.dbs[guild.id], guild, tokenDB);
        }
    } else {
        if (message.content.replace(/[^0-9]/g, '') == message.content) return;
        let args = message.content.split(/ +/)
        let commandName = args.shift().toLowerCase().replace(prefix, '')
        const command = bot.commands.get(commandName) || bot.commands.find(c => c.alias && c.alias.includes(commandName))
        if (!command) sendModMail()
        else if (command.dms) {
            let guild
            if (command.dmNeedsGuild) {
                guild = await getGuild(message).catch(er => cancelled = true)
                logCommand(guild)
            }
            if (!cancelled) {
                if (!command.dmNeedsGuild) command.dmExecution(message, args, bot, null, guild, tokenDB)
                else {
                    let member = guild.members.cache.get(message.author.id)
                    if (member.roles.highest.position < guild.roles.cache.get(bot.settings[guild.id].roles[command.role]).position && !bot.adminUsers.includes(message.member.id)) {
                        sendModMail();
                    } else command.dmExecution(message, args, bot, bot.dbs[guild.id], guild, tokenDB)
                }
            }
        } else message.channel.send('This command does not work in DM\'s. Please use this inside of a server')

        async function sendModMail() {
            let confirmModMailEmbed = new Discord.EmbedBuilder()
                .setColor(`#ff0000`)
                .setTitle('Are you sure you want to message modmail?')
                .setFooter({ text: 'Spamming modmail with junk will result in being modmail blacklisted' })
                .setDescription(`\`\`\`${message.content}\`\`\``)
            let guild = await getGuild(message).catch(er => { cancelled = true })
            await message.channel.send({ embeds: [confirmModMailEmbed] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(message.author.id)) {
                    modmail.sendModMail(message, guild, bot, bot.dbs[guild.id])
                    return confirmMessage.delete()
                } else return confirmMessage.delete()
            })

            //Check blacklist
        }
    }
    async function logCommand(guild) {
        if (!guild || !bot.settings[guild.id]) return
        let logEmbed = new Discord.EmbedBuilder()
            .setAuthor({ name: message.author.tag })
            .setColor('#0000ff')
            .setDescription(`<@!${message.author.id}> sent the bot: "${message.content}"`)
            .setFooter({ text: `User ID: ${message.author.id}` })
            .setTimestamp()
        if (message.author.avatarURL()) logEmbed.setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL() })
        guild.channels.cache.get(bot.settings[guild.id].channels.dmcommands).send({ embeds: [logEmbed] }).catch(er => { ErrorLogger.log(new Error(`Unable to find/send in settings.channels.dmcommands channel for ${guild.id}`), bot, guild) })
    }
}

/**
 * If enabled, will mute users for pinging roles
 * @param {Discord.Message} message 
 * @returns 
 */
async function autoMod(message) {
    let settings = bot.settings[message.guild.id]
    if (!settings || !settings.backend.automod) return;
    if (!message.member.roles.highest || message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.eventrl).position) return
    if (message.mentions.roles.size != 0) mute('Pinging Roles', 2);

    function mute(reason, time) {
        //time: 1=1 hour, 2=1 day
        let timeString, timeValue;
        if (time == 1) {
            timeString = '1 Hour';
            timeValue = 3600000
        } else if (time == 2) {
            timeString = '1 Day';
            timeValue = 86400000
        }
        message.member.roles.add(settings.roles.muted)
            .then(() => bot.dbs[message.guild.id].query(`INSERT INTO mutes (id, guildid, muted, reason, modid, uTime) VALUES ('${message.author.id}', '${message.guild.id}', true, '${reason}','${bot.user.id}', '${Date.now() + timeValue}')`))
            .then(() => message.author.send(`You have been muted in \`${message.guild.name}\` for \`${reason}\`. This will last for \`${timeString}\``))
            .then(() => {
                let modlog = message.guild.channels.cache.get(settings.channels.modlog)
                if (!modlog) return ErrorLogger.log(new Error('Mod log not found for automod'), bot, message.guild)
                modlog.send(`${message.member} was muted for \`${timeString}\` for \`${reason}\``)
            })
    }
}

/**
 * Returns common guild, or prompts for a guild selection
 * @param {Discord.Message} message 
 * @returns {Discord.Guild} guild
 */
async function getGuild(message) {
    return new Promise(async (resolve, reject) => {
        let guilds = []
        let guildNames = []
        bot.guilds.cache.each(g => {
            if (bot.emojiServers.includes(g.id)) { return }
            if (bot.devServers.includes(g.id)) { return }
            guilds.push(g)
            guildNames.push(g.name)
        })
        if (guilds.length == 0) reject('We dont share any servers')
        else if (guilds.length == 1) resolve(guilds[0])
        else {
            let guildSelectionEmbed = new Discord.EmbedBuilder()
                .setTitle('Please select a server')
                .setColor('#fefefe')
                .setDescription('Press Cancel if you don\'t wanna proceed')
            let guildSelectionMessage = await message.channel.send({ embeds: [guildSelectionEmbed] })
            const choice = await guildSelectionMessage.confirmList(guildNames, message.author.id);
            if (!choice || choice == 'Cancelled') return guildSelectionMessage.delete();
            guildSelectionMessage.delete();

            function getGuildByName(guildName) {
                for (let i in guilds) {
                    if (guilds[i].name == choice) return guilds[i]
                }
            }
            resolve(getGuildByName(choice));
        }
    })
}

var vibotControlGuild
/**
 * Checks user by ID's to see if they have a patreon role in control panel discord
 * @param {String} patreonRoleId 
 * @param {String} userId 
 * @returns 
 */
function checkPatreon(patreonRoleId, userId) {
    if (!vibotControlGuild) vibotControlGuild = bot.guilds.cache.get('739623118833713214')
    if (vibotControlGuild.members.cache.get(userId) && vibotControlGuild.members.cache.get(userId).roles.cache.has(patreonRoleId)) return true
    else return false
}

module.exports = { bot }
