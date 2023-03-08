// Imports
const Discord = require('discord.js')
const mysql = require('mysql2')
require('./lib/extensions.js')

// Import Internal Libraries
const ErrorLogger = require(`./lib/logError`)
const botSetup = require('./botSetup.js')
const memberHandler = require('./memberHandler.js')

// Specific Commands
const verification = require('./commands/verification')
const roleAssignment = require('./commands/roleAssignment')

// Global Variables/Data
const botSettings = require('./settings.json')
const token = require('./data/botKey.json')
const prefix = botSettings.prefix;
const rootCas = require('ssl-root-cas').create();
require('https').globalAgent.options.ca = rootCas;
const bot = require('./botMeta.js').bot
const serverWhiteList = require('./data/serverWhiteList.json')
const MessageManager = require('./messageManager.js').MessageManager;

const messageManager = new MessageManager(bot, botSettings);

// Bot Event Handlers
bot.on('messageCreate', async message => {
    // Ignore messages to non-whitelisted servers (but let DMs through)
    if (message.guild && !serverWhiteList.includes(message.guild.id)) return;
    if (message.author.bot) return

    try {
        return await messageManager.handleMessage(message);
    } catch (er) {
        ErrorLogger.log(er, bot, message.guild)
    }
});

bot.on('interactionCreate', async interaction => {
    // Validate the interaction is a command
    if (!interaction.isChatInputCommand()) return;
    // Validate the server is whitelisted
    if (!serverWhiteList.includes(interaction.guild.id)) return
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
    if (!bot.dbs[newMember.guild.id]) return

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
