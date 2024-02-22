const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const app = express();
const cors = require('cors');
const http = require('http');
const Discord = require('discord.js');
const redisConnect = require('./redis.js').setup;

const { config, settings } = require('./lib/settings.js');
const ErrorLogger = require('./lib/logError');
// Commands
const emoji = require('./commands/emoji.js');
const afkCheck = require('./commands/afkCheck.js');
const vibotChannels = require('./commands/vibotChannels');
const vetVerification = require('./commands/vetVerification');
const verification = require('./commands/verification');
// Specific Jobs
const { UnbanVet, Unsuspend } = require('./jobs/unban.js');
const { KeyAlert } = require('./jobs/keyAlert.js');
const { Mute } = require('./jobs/mute.js');
const { BiWeeklyQuota, MonthlyQuota } = require('./jobs/quota.js');
const { BotStatusUpdate } = require('./jobs/botstatus.js');
const { iterServers } = require('./jobs/util.js');
const dbSetup = require('./dbSetup.js');

async function deployCommands(bot, guild) {
    // Organize commands
    const slashCommands = bot.commands.filter(c => c.getSlashCommandData).map(c => c.getSlashCommandData(guild)).filter(c => c).flat();

    // Deploy commands
    const rest = new Discord.REST({ version: '10' }).setToken(config.key);
    try {
        console.log(`Deploying ${slashCommands.length} slash commands to ${guild.name} (${guild.id})`);
        await rest.put(Discord.Routes.applicationGuildCommands(bot.user.id, guild.id), { body: slashCommands });
        console.log(`Deployed ${slashCommands.length} slash commands to ${guild.name} (${guild.id})`);
    } catch (er) {
        console.log(`Error deploying slash commands: ${er}`);
    }
}

function startAPI() {
    if (config.api) {
        console.log('api starting');

        const apiLimit = rateLimit({
            windowMs: 1 * 10 * 1000,
            max: 10
        });

        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());
        app.use(cookieParser());
        app.use(cors());
        app.use('/api/', apiLimit);
        app.use('/api', require('./lib/API'));

        app.use((err, req, res, next) => {
            if (err) return res.status(err.status).send({ status: err.status, message: err.message });

            const d = new Date();
            const formattedDate = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
            const log = `[${formattedDate}] ${req.method}:${req.url} ${res.statusCode}`;
            console.log(log);
            next();
        });

        const server = http.createServer(app);
        const port = config.apiPort;
        server.listen(port);
    }
}

async function setup(bot) {
    // Check to see if the bot was restarted and send message to channel that bot is back online
    try {
        const restartInfo = require('./data/restart_channel.json');
        if (restartInfo && restartInfo.channel && restartInfo.guild) {
            const guild = bot.guilds.cache.get(restartInfo.guild);
            if (guild) {
                const channel = guild.channels.cache.get(restartInfo.channel);
                if (channel) {
                    channel.send("I'm back :flushed:");
                    fs.writeFileSync('./data/restart_channel.json', '{}');
                }
            }
        }
    } catch (er) { }

    // start api
    startAPI();

    // Update emojis.json
    await emoji.update(bot);

    // connect databases
    await dbSetup.init(bot);

    await redisConnect();

    // to hide dev server
    if (bot.user.id == config.prodBotId) { bot.devServers.push('701483950559985705'); }

    // purge veri-active
    iterServers(bot, (bot, g) => {
        const veriActive = g.channels.cache.get(settings[g.id].channels.veriactive);
        if (veriActive) veriActive.bulkDelete(100).catch(er => { console.log('Could not delete veriActive'); });
    });

    const unbanVetJob = new UnbanVet(bot);
    const unsuspendJob = new Unsuspend(bot);
    const keyAlertJob = new KeyAlert(bot);
    const muteJob = new Mute(bot);
    const biWeeklyQuotaJob = new BiWeeklyQuota(bot);
    const monthlyQuotaJob = new MonthlyQuota(bot);
    const botStatusUpdateJob = new BotStatusUpdate(bot);

    unbanVetJob.runAtInterval(120000);
    unsuspendJob.runAtInterval(60000);
    keyAlertJob.runAtInterval(300000);
    muteJob.runAtInterval(90000);
    biWeeklyQuotaJob.schedule('0 0 * * SUN');
    monthlyQuotaJob.schedule('0 0 1 * *');
    await botStatusUpdateJob.runOnce();
    botStatusUpdateJob.runAtInterval(30000);

    // initialize components (eg. modmail, verification)
    iterServers(bot, (bot, g) => {
        const db = dbSetup.getDB(g.id);
        vibotChannels.update(g, bot, db).catch(er => { });
        afkCheck.loadBotAfkChecks(g, bot, db);
        if (settings[g.id].backend.verification) verification.init(g, bot, db).catch(er => { ErrorLogger.log(er, bot, g); });
        if (settings[g.id].backend.vetverification) vetVerification.init(g, bot, db).catch(er => { ErrorLogger.log(er, bot, g); });
    });

    // Initialize the bot's slash commands
    iterServers(bot, deployCommands);
}

const launchFlask = require('./ml/spawnFlask.js');
launchFlask();

module.exports = { setup };
