const fs = require('fs')
const express = require('express')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
const app = express()
const cors = require('cors')
const https = require('https')
const http = require('http')
const Discord = require('discord.js')
const redisConnect = require('./redis.js').setup

const botSettings = require('./settings.json')
const ErrorLogger = require(`./lib/logError`)
// Commands
const emoji = require('./commands/emoji.js');
const globalSetup = require('./commands/setup')
const afkCheck = require('./commands/afkCheck.js')
const vibotChannels = require('./commands/vibotChannels')
const vetVerification = require('./commands/vetVerification')
const verification = require('./commands/verification')
const motmg = require('./commands/motmg.js').Motmg
// Specific Jobs
const unbanJobs = require('./jobs/unban.js')
const UnbanVet = unbanJobs.UnbanVet;
const Unsuspend = unbanJobs.Unsuspend;
const KeyAlert = require('./jobs/keyAlert.js').KeyAlert
const Mute = require('./jobs/mute.js').Mute
const quotaJobs = require('./jobs/quota.js')
const BiWeeklyQuota = quotaJobs.BiWeeklyQuota;
const MonthlyQuota = quotaJobs.MonthlyQuota;
const BotStatusUpdate = require('./jobs/botstatus.js').BotStatusUpdate;
const iterServers = require('./jobs/util.js').iterServers;
const dbSetup = require('./dbSetup.js');

async function deployCommands(bot, guild) {
    // Organize commands
    let slashCommands = bot.commands.filter(c => c.getSlashCommandData).map(c => c.getSlashCommandData(guild)).filter(c => c).flat();

    // Deploy commands
    const rest = new Discord.REST({ version: '10' }).setToken(require('./data/botKey.json').key)
    try {
        console.log(`Deploying ${slashCommands.length} slash commands to ${guild.name} (${guild.id})`)
        await rest.put(Discord.Routes.applicationGuildCommands(bot.user.id, guild.id), { body: slashCommands })
        console.log(`Deployed ${slashCommands.length} slash commands to ${guild.name} (${guild.id})`)
    } catch (er) {
        console.log(`Error deploying slash commands: ${er}`)
    }
}

function startAPI() {
    if (botSettings.api) {
        console.log('api starting')
        var credentials = {}
        try {
            credentials.key = fs.readFileSync('/etc/letsencrypt/live/a.vibot.tech/privkey.pem', 'utf8')
            credentials.cert = fs.readFileSync('/etc/letsencrypt/live/a.vibot.tech/cert.pem', 'utf8')
        } catch (e) { }

        const apiLimit = rateLimit({
            windowMs: 1 * 10 * 1000,
            max: 10
        })

        app.use(express.urlencoded({ extended: true }));
        app.use(express.json());
        app.use(cookieParser())
        app.use(cors())
        app.use('/api/', apiLimit)
        app.use('/api', require('./lib/API'))

        app.use((err, req, res, next) => {
            if (err) return res.status(err.status).send({ status: err.status, message: err.message});
            
            let d = new Date();
            let formatted_date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + " " + d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
            let log = `[${formatted_date}] ${req.method}:${req.url} ${res.statusCode}`;
            console.log(log);
            next();
        })

        const httpsServer = credentials.key && credentials.cert ? https.createServer(credentials, app) : http.createServer(app)
        const port = botSettings.apiPort
        httpsServer.listen(port)
    }
}

async function setup(bot) {
    // Check to see if the bot was restarted and send message to channel that bot is back online
    try {
        let restart_info = require('./data/restart_channel.json')
        if (restart_info && restart_info.channel && restart_info.guild) {
            let guild = bot.guilds.cache.get(restart_info.guild)
            if (guild) {
                let channel = guild.channels.cache.get(restart_info.channel)
                if (channel) {
                    channel.send('I\'m back :flushed:')
                    fs.writeFileSync('./data/restart_channel.json', '{}')
                }
            }
        }
    } catch (er) { }

    //start api
    startAPI()

    // Update emojis.json
    await emoji.update(bot)

    //connect databases
    await dbSetup.init(bot)

    await redisConnect()

    //to hide dev server
    if (bot.user.id == botSettings.prodBotId) bot.devServers.push('701483950559985705');

    //generate default settings
    iterServers(bot, function (bot, g) {
        globalSetup.autoSetup(g, bot)
    })

    //purge veri-active
    iterServers(bot, function (bot, g) {
        let veriActive = g.channels.cache.get(bot.settings[g.id].channels.veriactive)
        veriActive && veriActive.bulkDelete(100).catch(er => { })
    })

    const unbanVetJob = new UnbanVet(bot)
    const unsuspendJob = new Unsuspend(bot)
    const keyAlertJob = new KeyAlert(bot)
    const muteJob = new Mute(bot)
    const biWeeklyQuotaJob = new BiWeeklyQuota(bot)
    const monthlyQuotaJob = new MonthlyQuota(bot)
    const botStatusUpdateJob = new BotStatusUpdate(bot)
    const motmgJob = new motmg(bot)

    unbanVetJob.runAtInterval(120000)
    unsuspendJob.runAtInterval(60000)
    keyAlertJob.runAtInterval(300000)
    muteJob.runAtInterval(90000)
    biWeeklyQuotaJob.schedule('0 0 * * SUN')
    monthlyQuotaJob.schedule('0 0 1 * *')
    await botStatusUpdateJob.runOnce()
    botStatusUpdateJob.runAtInterval(30000)
    await motmgJob.runOnce()
    motmgJob.runAtInterval(900000)


    //initialize components (eg. modmail, verification)
    iterServers(bot, function (bot, g) {
        vibotChannels.update(g, bot).catch(er => { })
        const db = dbSetup.getDB(g.id)
        afkCheck.loadBotAfkChecks(g, bot, db)
        // if (bot.settings[g.id].backend.modmail) modmail.init(g, bot, db).catch(er => { ErrorLogger.log(er, bot, g); })
        if (bot.settings[g.id].backend.verification) verification.init(g, bot, db).catch(er => { ErrorLogger.log(er, bot, g); })
        if (bot.settings[g.id].backend.vetverification) vetVerification.init(g, bot, db).catch(er => { ErrorLogger.log(er, bot, g); })
    })

    //initialize channels from createchannel.js
    require('./commands/createChannel').init(bot)

    // Initialize the bot's slash commands
    iterServers(bot, deployCommands)
}

module.exports = { setup }
