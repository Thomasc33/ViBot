// Increasing stack trace limit from default of 10 to hopefully be able to follow more error logs
Error.stackTraceLimit = 16;

// Imports
const Discord = require('discord.js');
const mysql = require('mysql2');
const EventSource = require('eventsource');
const fs = require('fs');
require('./lib/extensions.js');

// Import Internal Libraries
const ErrorLogger = require('./lib/logError');
const botSetup = require('./botSetup.js');
const dbSetup = require('./dbSetup.js');
const memberHandler = require('./memberHandler.js');
const { logWrapper, writePoint } = require('./metrics.js');
const { Point } = require('@influxdata/influxdb-client');
const { handleReactionRow } = require('./redis.js');
const Modmail = require('./lib/modmail.js');
// Specific Commands
const verification = require('./commands/verification');

// Global Variables/Data
const botSettings = require('./settings.json');
const { bot } = require('./botMeta.js');
require('./lib/commands').load();

const serverWhiteList = require('./data/serverWhiteList.json');
const { MessageManager } = require('./messageManager.js');

const messageManager = new MessageManager(bot, botSettings);

// Bot Event Handlers
bot.on('messageCreate', logWrapper('message', async (logger, message) => {
    // Ignore messages to non-whitelisted servers (but let DMs through)
    if (message.guild && !serverWhiteList.includes(message.guild.id)) return logger('serverBlacklisted');
    if (message.author.bot) return logger('botAuthor');

    try {
        return await messageManager.handleMessage(message);
    } catch (er) {
        ErrorLogger.log(er, bot, message.guild);
    }
}));

bot.on('interactionCreate', logWrapper('message', async (logger, interaction) => {
    // Validate the server is whitelisted
    if (interaction.guild && !serverWhiteList.includes(interaction.guild.id)) return logger('serverBlacklisted');

    // Triggers when an option is selected in context menu, before a command is run
    if (interaction.isAutocomplete()) return await messageManager.handleAutocomplete(interaction);

    // Validate the interaction is a command
    if (interaction.isChatInputCommand()) return await messageManager.handleCommand(interaction, true);
    if (interaction.isUserContextMenuCommand()) return await messageManager.handleCommand(interaction, true);
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('modmail')) {
            const settings = bot.settings[interaction.guild.id];
            const db = dbSetup.getDB(interaction.guild.id);
            return await Modmail.interactionHandler(interaction, settings, bot, db);
        }
        return await handleReactionRow(bot, interaction);
    }
}));

bot.on('ready', async () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    bot.user.setActivity('vibot.tech');
    const vi = bot.users.cache.get(botSettings.developerId);
    vi.send('Halls Bot Starting Back Up');

    await botSetup.setup(bot);
});

bot.on('guildMemberAdd', async (member) => {
    if (!dbSetup.guildHasDb(member.guild.id)) return;

    await memberHandler.checkWasSuspended(bot, member);

    await memberHandler.checkWasMuted(bot, member);
});

bot.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!dbSetup.guildHasDb(newMember.guild.id)) return;

    const settings = bot.settings[newMember.guild.id];

    if (oldMember.roles.cache.equals(newMember.roles.cache)) return;

    if (settings.commands.prunerushers) await memberHandler.pruneRushers(dbSetup.getDB(newMember.guild.id), settings.roles.rusher, oldMember, newMember);

    if (newMember.roles.cache.has(settings.roles.lol)) return;

    await memberHandler.updateAffiliateRoles(bot, newMember);
});

bot.on('guildMemberRemove', async (member) => {
    if (!dbSetup.guildHasDb(member.guild.id)) return;

    await memberHandler.detectSuspensionEvasion(bot, member);

    await memberHandler.logServerLeave(bot, member);
});

bot.on('messageReactionAdd', async (r, u) => {
    if (u.bot) return;
    // modmail
    if (r.message.partial) r.message = await r.message.fetch();
    // spongemock
    if (r.emoji.id == '812959258638549022') {
        const content = [...r.message.content];
        for (const i in content) {
            if (!content[i]) continue;
            try {
                if (Math.random() > 0.5) content[i] = content[i].toLowerCase();
                else content[i] = content[i].toUpperCase();
            } catch (er) { console.log(er); }
        }
        const spongemockEmbed = new Discord.EmbedBuilder()
            .setColor('#FDF300')
            .setDescription(content.join(''))
            .setThumbnail('https://res.cloudinary.com/nashex/image/upload/v1613698392/assets/759584001131544597_im3kgg.png');
        r.message.channel.send({ embeds: [spongemockEmbed] });
        r.remove();
    }
});

bot.on('typingStart', (c, u) => {
    if (c.type !== Discord.ChannelType.DM || u.bot || verification.checkActive(u.id)) return;
    c.startTyping();
    setTimeout(() => {
        c.stopTyping();
    }, 7500);
});

Promise.all(botSettings.config?.guildIds.map(guildId => {
    const sseUrl = new URL(botSettings.config.url);
    sseUrl.pathname = `/guild/${guildId}/sse`;
    sseUrl.searchParams.append('key', botSettings.config.key);
    const settingsEventSource = new EventSource(sseUrl.toString());
    settingsEventSource.addEventListener('error', err => ErrorLogger.log(err, bot));
    settingsEventSource.addEventListener('open', () => console.log(`Settings SEE Socket opened for ${guildId}`));
    const cacheFile = `data/guildSettings.${guildId}.cache.json`;
    let fileReadTimeout;
    return new Promise(res => {
        // Wait 1s before reading from cache
        settingsEventSource.addEventListener('message', m => {
            console.log(`Updated settings for ${guildId}`);
            const data = JSON.parse(m.data);
            bot.settings[guildId] = data;
            bot.settingsTimestamp[guildId] = m.lastEventId;
            res();
            fs.writeFile(`data/guildSettings.${guildId}.cache.json`, JSON.stringify({ logId: m.lastEventId, ...data }), () => {});
        });

        // Read from cache
        fs.access(cacheFile, (err) => {
            if (err) return;
            fileReadTimeout = setTimeout(() => {
                console.log(`Could not fetch settings for ${guildId} reading cache`);
                const data = JSON.parse(fs.readFileSync(cacheFile));
                bot.settingsTimestamp[guildId] = data.logId;
                delete data.logId;
                bot.settings[guildId] = data;
                res();
            }, 1000);
        });
    }).then(() => clearTimeout(fileReadTimeout));
}) ?? []).then(() => {
    bot.login(botSettings.key);
});

setInterval(() => {
    for (const afkCheckId of Object.keys(bot.afkChecks)) {
        writePoint(new Point('afkchecksmodulesinterval')
            .stringField('afkCheck', afkCheckId));
    }
    for (const afkModuleId of Object.keys(bot.afkModules)) {
        writePoint(new Point('afkchecksmodulesinterval')
            .stringField('afkModule', afkModuleId));
    }
}, 60000);

// ===========================================================================================================
// Process Event Listening
// ===========================================================================================================

process.on('uncaughtException', err => {
    if (!err) return;
    ErrorLogger.log(err, bot);
    if (err.fatal) process.exit(1);
});

process.on('unhandledRejection', err => {
    if (err) {
        if (err.message == 'Target user is not connected to voice.') return;
        if (err.message == 'Cannot send messages to this user') return;
        if (err.message == 'Unknown Message') return;
        if (err.message == 'Unknown Channel') return;
        if (err.message == 'The user aborted a request.') return;
    } else return;
    ErrorLogger.log(err, bot);
});

// Data Base Connectors (Global DB was here, now moved to bot ready listener)
let tokenDB = mysql.createConnection(botSettings.tokenDBInfo);

tokenDB.connect(err => {
    if (err) ErrorLogger.log(err, bot);
    console.log('Connected to token database');
});

tokenDB.on('error', err => {
    if (err.code == 'PROTOCOL_CONNECTION_LOST') tokenDB = mysql.createConnection(botSettings.tokenDBInfo);
    else ErrorLogger.log(err, bot);
});

// ===========================================================================================================
// Functions
// ===========================================================================================================

let vibotControlGuild;
/**
 * Checks user by ID's to see if they have a patreon role in control panel discord
 * @param {String} patreonRoleId
 * @param {String} userId
 * @returns
 */
// eslint-disable-next-line no-unused-vars
function checkPatreon(patreonRoleId, userId) {
    if (!vibotControlGuild) vibotControlGuild = bot.guilds.cache.get('739623118833713214');
    if (vibotControlGuild.members.cache.get(userId) && vibotControlGuild.members.cache.get(userId).roles.cache.has(patreonRoleId)) return true;
    return false;
}

module.exports = { bot };
