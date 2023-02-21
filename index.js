// Imports
const fs = require('fs')
const Discord = require('discord.js')
const cron = require('cron')
const mysql = require('mysql')
const express = require('express')
const https = require('https')
const http = require('http')
const bodyParser = require('body-parser')
const rateLimit = require('express-rate-limit')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const path = require('path');
const moment = require('moment');
require('./lib/extensions.js')
global.appRoot = path.resolve(__dirname); //put here so verification ml doenst break


// Import Internal Libraries
const ErrorLogger = require(`./lib/logError`)
const CommandLogger = require('./lib/logCommand')

// Specific Commands
const botstatus = require('./commands/botstatus')
const vibotChannels = require('./commands/vibotChannels')
const vetVerification = require('./commands/vetVerification')
const verification = require('./commands/verification')
const quota = require('./commands/quota')
const roleAssignment = require('./commands/roleAssignment')
const stats = require('./commands/stats')
const modmail = require('./commands/modmail')
const setup = require('./commands/setup')
const restarting = require('./commands/restart')
const excuses = require('./commands/excuse');
const quotas = require('./data/quotas.json');
const emoji = require('./commands/emoji.js');
// Global Variables/Data
const botSettings = require('./settings.json')
const token = require('./botKey.json')
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const prefix = botSettings.prefix;
const cooldowns = new Discord.Collection()
const bot = new Discord.Client({
    intents: [ // Discord moment
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildBans,
        Discord.GatewayIntentBits.GuildEmojisAndStickers,
        Discord.GatewayIntentBits.GuildIntegrations,
        Discord.GatewayIntentBits.GuildWebhooks,
        Discord.GatewayIntentBits.GuildInvites,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildPresences,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildMessageReactions,
        Discord.GatewayIntentBits.GuildMessageTyping,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.DirectMessageReactions,
        Discord.GatewayIntentBits.DirectMessageTyping,
        Discord.GatewayIntentBits.MessageContent,
    ],
    partials: [
        Discord.Partials.User,
        Discord.Partials.Channel,
        Discord.Partials.GuildMember,
        Discord.Partials.Message,
        Discord.Partials.Reaction
    ]
})
bot.commands = new Discord.Collection()
bot.dbs = {}
bot.crasherList = moduleIsAvailable('./data/crasherList.json') ? require('./data/crasherList.json') : {}
bot.afkChecks = moduleIsAvailable('./afkChecks.json') ? require('./afkChecks.json') : {}
bot.settings = moduleIsAvailable('./guildSettings.json') ? require('./guildSettings.json') : {}
bot.serverWhiteList = moduleIsAvailable('./data/serverWhiteList.json') ? require('./data/serverWhiteList.json') : {}
bot.partneredServers = moduleIsAvailable('./data/partneredServers.json') ? require('./data/partneredServers.json') : []
bot.fetchPartneredServer = function (guildId) {
    for (let i in bot.partneredServers) {
        server = bot.partneredServers[i]
        if (server.guildId == guildId) return server
    }
    return null
}
bot.adminUsers = ['277636691227836419', '258286481167220738', '190572077219184650']
bot.partneredServers = moduleIsAvailable('./data/partneredServers.json') ? require('./data/partneredServers.json') : {}
bot.emojiServers = moduleIsAvailable('./data/emojiServers.json') ? require('./data/emojiServers.json') : {}
bot.devServers = ["739623118833713214"]
bot.storedEmojis = moduleIsAvailable('./data/emojis.json') ? require('./data/emojis.json') : {}
const dbSchemas = require('./data/schemas.json')
const { channel } = require('diagnostics_channel')
const app = express();
const rootCas = require('ssl-root-cas').create();
require('https').globalAgent.options.ca = rootCas;
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    bot.commands.set(command.name, command);
}


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
        let guildId = message.guild.id
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

bot.on("ready", async () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    bot.user.setActivity(`vibot.tech`)
    let vi = bot.users.cache.get(botSettings.developerId)
    vi.send('Halls Bot Starting Back Up')

    //start api
    startAPI()

    // Update emojis.json
    try {
        await emoji.update(bot)
        console.log('Emoji file updated')
    } catch (error) {
        await ErrorLogger.log(error, bot)
        console.log('Emoji file failed to update')
    }

    //connect databases
    bot.guilds.cache.each(g => {
        if (bot.emojiServers.includes(g.id)) { return }
        if (bot.devServers.includes(g.id)) { return }
        if (!dbSchemas[g.id] || !dbSchemas[g.id].schema) return console.log('Missing Schema name (schema.json) for: ', g.id)
        let dbInfo = {
            host: dbSchemas[g.id].host || botSettings.defaultDbInfo.host,
            user: dbSchemas[g.id].user || botSettings.defaultDbInfo.user,
            password: dbSchemas[g.id].password || botSettings.defaultDbInfo.password,
            database: dbSchemas[g.id].schema
        }
        bot.dbs[g.id] = mysql.createConnection(dbInfo)
        connectDB(bot.dbs[g.id])

        bot.dbs[g.id].on('error', err => {
            if (err.code == 'PROTOCOL_CONNECTION_LOST' || err.code == 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
                bot.dbs[g.id] = mysql.createConnection(dbInfo)
                connectDB(bot.dbs[g.id])
            }
            else ErrorLogger.log(err, bot, g)
        })
    })

    //to hide dev server
    if (bot.user.id == botSettings.prodBotId) bot.devServers.push('701483950559985705');

    //generate default settings
    bot.guilds.cache.each(g => {
        if (bot.emojiServers.includes(g.id)) { return }
        if (bot.devServers.includes(g.id)) { return }
        setup.autoSetup(g, bot)
    })

    //purge veri-active
    bot.guilds.cache.each(g => {
        if (bot.emojiServers.includes(g.id)) { return }
        if (bot.devServers.includes(g.id)) { return }
        let veriActive = g.channels.cache.get(bot.settings[g.id].channels.veriactive)
        if (!veriActive) return;
        veriActive.bulkDelete(100).catch(er => { })
    })

    //vetban check
    let vetbanInterval = setInterval(() => {
        let checked = []
        bot.guilds.cache.each(g => {
            if (bot.emojiServers.includes(g.id)) { return }
            if (bot.devServers.includes(g.id)) { return }
            if (bot.dbs[g.id] && !checked.includes(bot.dbs[g.id].config.databse)) {
                checked.push(bot.dbs[g.id].config.databse) //prevents people from being unsuspended twice
                bot.dbs[g.id].query(`SELECT * FROM vetbans WHERE suspended = true`, async (err, rows) => {
                    if (err) ErrorLogger.log(err, bot, g)
                    for (let i in rows) {
                        if (Date.now() > parseInt(rows[i].uTime)) {
                            const guildId = rows[i].guildid;
                            let settings = bot.settings[guildId]
                            const guild = bot.guilds.cache.get(guildId);
                            const proofLogID = rows[i].logmessage;
                            const member = guild.members.cache.get(rows[i].id);
                            if (!member) return bot.dbs[g.id].query(`UPDATE vetbans SET suspended = false WHERE id = '${rows[i].id}'`)
                            try {
                                await member.roles.remove(settings.roles.vetban)
                                setTimeout(() => { member.roles.add(settings.roles.vetraider); }, 1000)
                                setTimeout(() => {
                                    if (!member.roles.cache.has(settings.roles.vetraider))
                                        member.roles.add(settings.roles.vetraider).catch(er => ErrorLogger.log(er, bot, g))
                                }, 5000)
                                try {
                                    let messages = await guild.channels.cache.get(settings.channels.suspendlog).messages.fetch({ limit: 100 })
                                    let m = messages.get(proofLogID)
                                    if (!m) {
                                        guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[i].id}> has been un-vet-banned automatically`)
                                    } else {
                                        let embed = new Discord.EmbedBuilder()
                                        embed.data = m.embeds.shift().data;
                                        embed.setColor('#00ff00')
                                            .setDescription(embed.data.description.concat(`\nUn-vet-banned automatically`))
                                            .setFooter({ text: 'Unsuspended at' })
                                            .setTimestamp(Date.now())
                                        m.edit({ embeds: [embed] })
                                    }
                                } catch (er) {
                                    guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[i].id}> has been un-vet-banned automatically`)
                                } finally {
                                    await bot.dbs[g.id].query(`UPDATE vetbans SET suspended = false WHERE id = '${rows[i].id}'`)
                                }
                            } catch (er) {
                                ErrorLogger.log(er, bot, g)
                            }
                        }
                    }
                })
            }
        })
    }, 120000);

    //suspension check
    let suspensionInterval = setInterval(() => {
        let checked = []
        bot.guilds.cache.each(g => {
            if (bot.emojiServers.includes(g.id)) { return }
            if (bot.devServers.includes(g.id)) { return }
            if (bot.dbs[g.id] && !checked.includes(bot.dbs[g.id].config.databse)) {
                checked.push(bot.dbs[g.id].config.databse) //prevents people from being unsuspended twice
                bot.dbs[g.id].query(`SELECT * FROM suspensions WHERE suspended = true AND perma = false`, async (err, rows) => {
                    if (err) ErrorLogger.log(err, bot, g)
                    for (let i in rows) {
                        if (Date.now() > parseInt(rows[i].uTime)) {
                            const guildId = rows[i].guildid;
                            let settings = bot.settings[guildId]
                            const proofLogID = rows[i].logmessage;
                            const rolesString = rows[i].roles;
                            let roles = []
                            const guild = bot.guilds.cache.get(guildId);
                            const member = guild.members.cache.get(rows[i].id);
                            if (!member) {
                                guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[i].id}> has been unsuspended automatically. However, they are not in the server`)
                                return bot.dbs[g.id].query(`UPDATE suspensions SET suspended = false WHERE id = '${rows[i].id}'`)
                            }
                            rolesString.split(' ').forEach(r => { if (r !== '') roles.push(r) })
                            try {
                                await member.edit({ roles: roles }).catch(er => ErrorLogger.log(er, bot, g))
                                setTimeout(() => {
                                    if (member.roles.cache.has(settings.roles.tempsuspended))
                                        member.edit({ roles: roles }).catch(er => ErrorLogger.log(er, bot, g))
                                }, 5000)
                                try {
                                    let messages = await guild.channels.cache.get(settings.channels.suspendlog).messages.fetch({ limit: 100 })
                                    let m = messages.get(proofLogID)
                                    if (!m) {
                                        guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[i].id}> has been unsuspended automatically`)
                                    } else {
                                        let embed = new Discord.EmbedBuilder()
                                        embed.data = m.embeds.shift().data;
                                        embed.setColor('#00ff00')
                                            .setDescription(embed.data.description.concat(`\nUnsuspended automatically`))
                                            .setFooter({ text: 'Unsuspended at' })
                                            .setTimestamp(Date.now())
                                        m.edit({ embeds: [embed] })
                                    }
                                } catch (er) {
                                    guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[i].id}> has been unsuspended automatically`)
                                } finally {
                                    await bot.dbs[g.id].query(`UPDATE suspensions SET suspended = false WHERE id = '${rows[i].id}'`)
                                }
                            } catch (er) {
                                ErrorLogger.log(er, bot, g)
                            }
                        }
                    }
                })
            }
        })
    }, 60000);

    //key alerts check
    let keyAlertsInterval = setInterval(() => {
        bot.guilds.cache.each(g => {
            const settings = bot.settings[g.id];
            if (!settings || !settings.channels.keyalerts || !settings.numerical.keyalertsage)
                return;

            const channel = bot.channels.cache.get(settings.channels.keyalerts);
            channel.messages.fetch()
                .then(messages => {
                    bulk = [];

                    messages.each(message => {
                        if (new Date() - message.createdAt > 60000 * settings.numerical.keyalertsage)
                            bulk.push(message);
                    })
                    if (bulk.length == 1)
                        bulk[0].delete();
                    else if (bulk.length > 1)
                        channel.bulkDelete(bulk);
                })
        })
    }, 300000);

    //mute check
    let muteInterval = setInterval(() => {
        let checked = []
        bot.guilds.cache.each(g => {
            if (bot.emojiServers.includes(g.id)) { return }
            if (bot.devServers.includes(g.id)) { return }
            if (bot.dbs[g.id] && !checked.includes(bot.dbs[g.id].config.databse)) {
                checked.push(bot.dbs[g.id].config.databse) //prevents people from being unsuspended twice
                bot.dbs[g.id].query(`SELECT * FROM mutes WHERE muted = true`, async (err, rows) => {
                    if (err) ErrorLogger.log(err, bot, g)
                    for (let i in rows) {
                        if (Date.now() > parseInt(rows[i].uTime)) {
                            const guildId = rows[i].guildid;
                            let settings = bot.settings[guildId]
                            const guild = bot.guilds.cache.get(guildId);
                            if (guild) {
                                const member = guild.members.cache.get(rows[i].id);
                                if (!member) return bot.dbs[g.id].query(`UPDATE mutes SET muted = false WHERE id = '${rows[i].id}'`)
                                try {
                                    await member.roles.remove(settings.roles.muted)
                                    await bot.dbs[g.id].query(`UPDATE mutes SET muted = false WHERE id = '${rows[i].id}'`)
                                } catch (er) {
                                    ErrorLogger.log(er, bot, g)
                                }
                            }
                        }
                    }
                })
            }
        })
    }, 90000);

    //initialize components (eg. modmail, verification)
    bot.guilds.cache.each(g => {
        if (bot.emojiServers.includes(g.id)) { return }
        if (bot.devServers.includes(g.id)) { return }
        vibotChannels.update(g, bot).catch(er => { })
        // if (bot.settings[g.id].backend.modmail) modmail.init(g, bot, bot.dbs[g.id]).catch(er => { ErrorLogger.log(er, bot, g); })
        if (bot.settings[g.id].backend.verification) verification.init(g, bot, bot.dbs[g.id]).catch(er => { ErrorLogger.log(er, bot, g); })
        if (bot.settings[g.id].backend.vetverification) vetVerification.init(g, bot, bot.dbs[g.id]).catch(er => { ErrorLogger.log(er, bot, g); })
        botstatus.init(g, bot, bot.dbs[g.id])
    })

    //initialize channels from createchannel.js
    require('./commands/createChannel').init(bot)

    //reset currentweek
    const currentWeekReset = cron.job('0 0 * * SUN', () => {
        const biweekly = !(moment().diff(moment(1413378000), 'week') % 2);
        bot.guilds.cache.each(g => {
            if (bot.emojiServers.includes(g.id)) { return }
            if (bot.devServers.includes(g.id)) { return }
            const guildQuotas = quotas[g.id];
            if (!guildQuotas) { return }
            const quotaList = guildQuotas.quotas.filter(q => q.reset == "weekly" || (q.reset == "biweekly" && biweekly));
            if (!quotaList.length) return;

            quota.fullReset(g, bot.dbs[g.id], bot, quotaList);
        })
    }, null, true, 'America/New_York', null, false)

    const currentMonthReset = cron.job('0 0 1 * *', () => {
        bot.guilds.cache.each(g => {
            if (bot.emojiServers.includes(g.id)) { return }
            if (bot.devServers.includes(g.id)) { return }
            const guildQuotas = quotas[g.id];
            if (!guildQuotas) { return }
            const quotaList = guildQuotas.quotas.filter(q => q.reset == "weekly" || (q.reset == "biweekly" && biweekly));
            if (!quotaList.length) return;
            for (const q of quotaList)
                if (q.reset == "monthly")
                    quota.newWeek(g, bot, bot.dbs[g.id], bot.settings[g.id], guildQuotas, q);
        })
    }, null, true, 'America/New_York', null, false)
});

bot.on('guildMemberAdd', member => {
    if (bot.dbs[member.guild.id]) {
        let db = bot.dbs[member.guild.id]
        db.query(`SELECT suspended, ignOnLeave FROM suspensions WHERE id = '${member.id}' AND suspended = true AND guildid = '${member.guild.id}'`, (err, rows) => {
            if (rows.length !== 0) {
                let msg = `${member} rejoined server after leaving while suspended. `;
                member.roles.add(bot.settings[member.guild.id].roles.tempsuspended)
                if (rows[0].ignOnLeave) {
                    if (rows[0].ignOnLeave != 'undefined' && rows[0].ignOnLeave != 'null') {
                        member.setNickname(rows[0].ignOnLeave);
                        msg += `Giving suspended role and nickname back.`
                    } else
                        msg += `Could not assign a nickname as it was either null or undefined. Giving suspended role back.`;
                } else
                    msg += `Could not assign a nickname as it was either null or undefined. Giving suspended role back.`;
                let modlog = member.guild.channels.cache.get(bot.settings[member.guild.id].channels.modlogs)
                if (!modlog) return ErrorLogger.log(new Error(`mod log not found in ${member.guild.id}`), bot, member.guild)
                modlog.send(`${member} rejoined server after leaving while suspended. Giving suspended role and nickname back.`)
            }
        })
        db.query(`SELECT muted FROM mutes WHERE id = '${member.id}' AND muted = true`, (err, rows) => {
            if (rows.length !== 0) {
                member.roles.add(bot.settings[member.guild.id].roles.muted)
                let modlog = member.guild.channels.cache.get(bot.settings[member.guild.id].channels.modlogs)
                if (!modlog) return ErrorLogger.log(new Error(`mod log not found in ${member.guild.id}`), bot, member.guild)
                modlog.send(`${member} rejoined server after leaving while muted. Giving muted role back.`)
            }
        })
    }
})

bot.on('guildMemberUpdate', async (oldMember, newMember) => {
    const settings = bot.settings[newMember.guild.id];
    const guildId = newMember.guild.id
    if (settings && settings.commands.prunerushers && !oldMember.roles.cache.has(settings.roles.rusher) && newMember.roles.cache.has(settings.roles.rusher)) {
        let today = new Date()
        bot.dbs[newMember.guild.id].query(`INSERT IGNORE INTO rushers (id, guildid, time) values ("${newMember.id}", "${newMember.guild.id}", ${today.valueOf()})`)
    } else if (settings && settings.commands.prunerushers && oldMember.roles.cache.has(settings.roles.rusher) && !newMember.roles.cache.has(settings.roles.rusher)) {
        let today = new Date()
        bot.dbs[newMember.guild.id].query(`DELETE FROM rushers WHERE id = "${newMember.id}"`)
    }
    
    let roleDifference = await roleDiff(oldMember, newMember)
    if (!roleDifference.changed) { return }
    function getPartneredServers(guildId) {
        for (let i in bot.partneredServers) {
            if (bot.partneredServers[i].guildId == guildId) { return bot.partneredServers[i]}
        }
        return null
    }
    let partneredServer = getPartneredServers(guildId)
    if (!partneredServer) { return }
    if (newMember.roles.cache.has(settings.roles.lol)) { return }

    const partneredSettings = bot.settings[partneredServer.id]
    let otherServer = bot.guilds.cache.find(g => g.id == partneredServer.id)
    let otherServerRaider = otherServer.roles.cache.get(partneredSettings.roles.raider)
    let otherServerPermaSuspend = otherServer.roles.cache.get(partneredSettings.roles.permasuspended)
    let otherServerTempSuspend = otherServer.roles.cache.get(partneredSettings.roles.tempsuspended)
    let partneredMember = await otherServer.members.cache.get(newMember.id)

    if (!partneredMember) { return }
    if (!partneredMember.roles.cache.has(otherServerRaider.id)) { return }
    if (partneredMember.roles.cache.hasAny(...[otherServerPermaSuspend.id, otherServerTempSuspend])) { return }

    let partneredModLogs = otherServer.channels.cache.get(partneredSettings.channels.modlogs)
    let as = otherServer.roles.cache.get(partneredSettings.roles.affiliatestaff)
    let vas = otherServer.roles.cache.get(partneredSettings.roles.vetaffiliate)

    if (partneredMember.roles.cache.has(as.id)) hasAffiliate = true; else hasAffiliate = false
    if (partneredMember.roles.cache.has(vas.id)) hasVetAffiliate = true; else hasVetAffiliate = false

    const isStaff = hasRoleInList(newMember, settings, partneredServer.affiliatelist)
    const vasEligable = hasRoleInList(newMember, settings, partneredServer.vaslist)
    let iconUrl = 'https://cdn.discordapp.com/avatars/' + newMember.id + '/' + newMember.user.avatar + '.webp'
    embed = new Discord.EmbedBuilder()
        .setAuthor({ name: `${partneredMember.displayName}`, iconURL: iconUrl })

    if (isStaff && !hasAffiliate) {
        setTimeout(async () => {
            partneredMember.roles.add(as)
            embed.setDescription(`Given role ${as} to ${partneredMember} \`\`${partneredMember.displayName}\`\``)
            embed.setColor(as.hexColor)
            await partneredModLogs.send({ embeds: [embed] })
        }, 500)
        
    } else if (!isStaff && hasAffiliate) {
        setTimeout(async () => {
            partneredMember.roles.remove(as)
            embed.setDescription(`Removed role ${as} from ${partneredMember} \`\`${partneredMember.displayName}\`\``)
            embed.setColor(as.hexColor)
            await partneredModLogs.send({ embeds: [embed] })
        }, 500)
        
    }
    if (vasEligable && !hasVetAffiliate) {
        setTimeout(async () => {
            partneredMember.roles.add(vas)
            embed.setDescription(`Given role ${vas} to ${partneredMember} \`\`${partneredMember.displayName}\`\``)
            embed.setColor(vas.hexColor)
            await partneredModLogs.send({ embeds: [embed] })
            partneredMember = await otherServer.members.cache.get(partneredMember.id)
            let partneredMemberOldNickname = partneredMember.displayName
            if (partneredMember.roles.highest.position == vas.position && isLetter(partneredMember.displayName[0])) {
                await partneredMember.setNickname(`${partneredServer.prefix}${partneredMember.displayName}`, 'Automatic Nickname Change: User just got Veteran Affiliate Staff as their highest role')
                embed.setDescription(`Automatic Prefix Change for ${partneredMember}\nOld Nickname: \`${partneredMemberOldNickname}\`\nNew Nickname: \`${partneredMember.displayName}\`\nPrefix: \`${partneredServer.prefix}\``)
                embed.setColor(partneredMember.roles.highest.hexColor)
                await partneredModLogs.send({ embeds: [embed] })
            }
        }, 1000)
        
    } else if (!vasEligable && hasVetAffiliate) {
        setTimeout(async () => {
            partneredMember.roles.remove(vas)
            embed.setDescription(`Removed role ${vas} from ${partneredMember} \`\`${partneredMember.displayName}\`\``)
            embed.setColor(vas.hexColor)
            await partneredModLogs.send({ embeds: [embed] })
        }, 1000)
    }

    // I don't think there is a built in javascript method to check if a character is a letter or special character. true if letter; else false
    function isLetter(c) {
        return c.toLowerCase() != c.toUpperCase();
    }

    function hasRoleInList(user, settings, roles) {
        for (let i in roles) {
            role = roles[i]
            if (user.roles.cache.has(settings.roles[role])) return true
        }
        return false
    }

    async function roleDiff(oldMember, newMember) {
        let oldRoles = oldMember.roles.cache.map(r => r.id)
        let newRoles = newMember.roles.cache.map(r => r.id)
        var removed = []
        var added = []
        for (var i in newRoles) {
            if (!oldRoles.includes(newRoles[i])) {
                added.push(newRoles[i])
            }
        }
        for (var i in oldRoles) {
            if (!newRoles.includes(oldRoles[i])) {
                removed.push(oldRoles[i])
            }
        }
        return {
            "changed": (added.length > 0 || removed.length > 0) ? true : false,
            "added": added,
            "removed": removed
        }
    }
})

bot.on('guildMemberRemove', member => {
    if (bot.dbs[member.guild.id]) {
        let db = bot.dbs[member.guild.id]
        db.query(`SELECT suspended FROM suspensions WHERE id = '${member.id}' AND suspended = true AND guildid = '${member.guild.id}`, (err, rows) => {
            if (err) return ErrorLogger.log(err, bot, member.guild)
            if (rows.length !== 0) {
                let modlog = member.guild.channels.cache.get(bot.settings[member.guild.id].channels.modlogs)
                if (!modlog) return ErrorLogger.log(new Error(`mod log not found in ${member.guild.id}`), bot, member.guild)
                modlog.send(`${member} is attempting to dodge a suspension by leaving the server`)
                db.query(`UPDATE suspensions SET ignOnLeave = '${member.nickname}' WHERE id = '${member.id}' AND suspended = true`)
                if (member.nickname) {
                    member.nickname.replace(/[^a-z|]/gi, '').split('|').forEach(n => {
                        db.query(`INSERT INTO veriblacklist (id, guildid, modid, reason) VALUES ('${n}', '${member.guild.id}', '${bot.user.id}', 'Left Server While Suspended')`)
                    })
                }
            }
        })
    }
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

function connectDB(db) {
    db.connect(err => {
        if (err) ErrorLogger.log(err, bot);
        else console.log("Connected to database: ", db.config.database);
    })
}

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

/**
 * Fits a string into an embed as tightly as possible, or sends the embed and resets the embed variable to an empty embed
 * @param {Discord.MessageEmbed} embed 
 * @param {String} string 
 * @param {Discord.TextChannel} channel 
 */
function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `\n${string}`.length >= 2048) {
        if (embed.data.fields.length == 0) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`\n${string}`))
    }
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

function moduleIsAvailable(path) {
    try {
        require.resolve(path);
        require(path)
        return true;
    } catch (e) {
        return false;
    }
}



// API
function startAPI() {
    if (botSettings.api) {
        console.log('api starting')
        var credentials = {}
        try {
            credentials.key = fs.readFileSync('C:\\Certbot\\live\\a.vibot.tech\\privkey.pem', 'utf8')
            credentials.cert = fs.readFileSync('C:\\Certbot\\live\\a.vibot.tech\\cert.pem', 'utf8')
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

        app.use((req, res, next) => {
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


module.exports = {
    bot
}
