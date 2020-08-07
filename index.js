const fs = require('fs')
const Discord = require('discord.js')
const cron = require('cron')
const mysql = require('mysql')
const botSettings = require('./settings.json')
const prefix = botSettings.prefix
const bot = new Discord.Client()
bot.commands = new Discord.Collection()
bot.vetBans = require('./vetBans.json')
bot.crasherList = require('./crasherList.json')
bot.mutes = require('./mutes.json')
bot.afkChecks = require('./afkChecks.json')
bot.settings = require('./guildSettings.json')
const ErrorLogger = require(`./logError`)
const vibotChannels = require('./commands/vibotChannels')
const vetVerification = require('./commands/vetVerification')
const verification = require('./commands/verification')
const currentWeek = require('./commands/currentWeek')
const ecurrentWeek = require('./commands/eventCurrentWeek')
const stats = require('./commands/stats')
const modmail = require('./commands/modmail')
const setup = require('./commands/setup')
const emojiServers = ['739623118833713214', '738506334521131074', '738504422396788798', '719905601131511850', '719905712507191358', '719930605101383780', '719905684816396359', '719905777363714078', '720260310014885919', '720260593696768061', '720259966505844818', '719905506054897737', '720260132633706577', '719934329857376289', '720260221720592394', '720260562390351972', '720260005487575050', '719905949409869835', '720260467049758781', '720260436875935827', '719905747986677760', '720260079131164692', '719932430126940332', '719905565035200573', '719905806082113546', '722999001460244491', '720260272488710165', '722999622372556871', '720260194596290650', '720260499312476253', '720259927318331513', '722999694212726858', '722999033387548812', '720260531901956166', '720260398103920670', '719905651337461820']
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    bot.commands.set(command.name, command);
}

bot.on('message', message => {
    if (message.channel.type === 'dm') return dmHandler(message)
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const commandName = args.shift().toLowerCase()
    if (commandName.replace(/[^a-z]/gi, '') == '') return
    const command = bot.commands.get(commandName) || bot.commands.find(cmd => cmd.alias && cmd.alias.includes(commandName))
    if (!command) return message.channel.send('Command doesnt exist, check \`commands\` and try again');
    if (message.member.roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role]).position && message.author.id !== '277636691227836419') return;
    if (command.requiredArgs && command.requiredArgs > args.length) return message.channel.send(`Command Entered incorrecty. \`${botSettings.prefix}${command.name} ${command.args}\``)
    try {
        command.execute(message, args, bot, db)
    } catch (er) {
        ErrorLogger.log(er, bot)
        message.channel.send("Issue executing the command, check \`;commands\` and try again");
    }
});

async function dmHandler(message) {
    if (message.author.bot) return;
    if (verification.checkActive(message.author.id)) return
    let cancelled = false;
    let statsTypos = ['stats', 'satts', 'stat', 'status', 'sats', 'stata', 'stts']
    if (statsTypos.includes(message.content.replace(/[^a-z0-9]/gi, ''))) {
        let guild = await getGuild(message).catch(er => { cancelled = true })
        logCommand(guild)
        if (!cancelled) message.channel.send(await stats.getStatsEmbed(message.author.id, guild, db)
            .catch(er => { message.channel.send('You are not currently logged in the database. The database gets updated every 24-48 hours') }))
    } else {
        if (message.content.replace(/[^0-9]/g, '') == message.content) return;
        let args = message.content.split(/ +/)
        let commandName = args.shift().toLowerCase().replace(prefix, '')
        let command = bot.commands.get(commandName) || bot.commands.find(c => c.alias && c.alias.includes(commandName))
        if (!command) {
            sendModMail()
        } else if (command.dms) {
            let guild = await getGuild(message).catch(er => cancelled = true)
            logCommand(guild)
            if (!cancelled) {
                if (guild.members.cache.get(message.author.id).roles.highest.position < guild.roles.cache.get(bot.settings[guild.id].roles[command.role]).position && message.author.id !== '277636691227836419') {
                    message.channel.send('You do not have permissions to use this command')
                } else command.dmExecution(message, args, bot, db, guild)
            }
        } else {
            message.channel.send('This command does not work in DM\'s. Please use this inside of a server')
        }
        async function sendModMail() {
            let confirmModMailEmbed = new Discord.MessageEmbed()
                .setColor(`#ff0000`)
                .setTitle('Are you sure you want to message modmail?')
                .setFooter('Spamming modmail with junk will result in being modmail blacklisted')
                .setDescription(`\`\`\`${message.content}\`\`\``)
            let confirmModMailMessage = await message.channel.send(confirmModMailEmbed)
            let reactionCollector = new Discord.ReactionCollector(confirmModMailMessage, (r, u) => u.id == message.author.id && (r.emoji.name == '✅' || r.emoji.name == '❌'))
            reactionCollector.on('collect', async (r, u) => {
                reactionCollector.stop()
                let guild = await getGuild(message).catch(er => { cancelled = true })
                if (!cancelled) {
                    if (r.emoji.name == '✅') modmail.sendModMail(message, guild, bot, db)
                    confirmModMailMessage.delete()
                }
            })
            confirmModMailMessage.react('✅')
                .then(confirmModMailMessage.react('❌'))
        }
    }
    async function logCommand(guild) {
        let logEmbed = new Discord.MessageEmbed()
            .setAuthor(message.author.tag)
            .setColor('#0000ff')
            .setDescription(`<@!${message.author.id}> sent the bot: "${message.content}"`)
            .setFooter(`User ID: ${message.author.id}`)
            .setTimestamp()
        if (message.author.avatarURL()) logEmbed.author.iconURL = message.author.avatarURL()
        guild.channels.cache.get(bot.settings[guild.id].channels.dmcommands).send(logEmbed)
    }
}

bot.login(botSettings.key);

var db = mysql.createConnection(botSettings.dbInfo)

db.connect(err => {
    if (err) throw err;
    console.log('Connected to database')
})

bot.on("ready", async () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    let vi = await bot.users.fetch(`277636691227836419`)
    vi.send('Bot Starting Back Up')
    bot.user.setActivity(`verifications??`);
    //generate default settings
    bot.guilds.cache.each(g => {
        if (!emojiServers.includes(g.id)) {
            setup.autoSetup(g, bot)
        }
    })
    //vetban check
    bot.setInterval(() => {
        for (let i in bot.vetBans) {
            const time = parseInt(bot.vetBans[i].time);
            const guildId = bot.vetBans[i].guild;
            const reason = bot.vetBans[i].reason;
            const banBy = bot.vetBans[i].by;
            const proofLogID = bot.vetBans[i].logMessage;
            const guild = bot.guilds.cache.get(guildId);
            const settings = bot.settings[guild.id]
            const member = guild.members.cache.get(i);
            const vetBanRole = guild.roles.cache.find(r => r.name === 'Banned Veteran Raider');
            const vetRaiderRole = guild.roles.cache.find(r => r.name === 'Veteran Raider');
            try {
                if (Date.now() > time) {
                    member.roles.remove(vetBanRole)
                        .then(member.roles.add(vetRaiderRole));
                    delete bot.vetBans[i];
                    fs.writeFile('./vetBans.json', JSON.stringify(bot.vetBans, null, 4), function (err) {
                        if (err) throw err;

                        let embed = bot.guilds.cache.get(guildId).channels.cache.get(settings.channels.suspendlog).messages.fetch(proofLogID).embeds.shift();
                        embed.setColor('#00ff00')
                            .setFooter('Unsuspended at');
                        bot.guilds.cache.get(guildId).channels.cache.get(settings.channels.suspendlog).messages.fetche(proofLogID).edit(embed);
                    })
                }
            } catch (er) {
                ErrorLogger.log(er, bot)
                continue;
            }
        }
    }, 60000);
    //suspension check
    bot.setInterval(() => {
        db.query(`SELECT * FROM suspensions WHERE suspended = true AND perma = false`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            for (let i in rows) {
                if (Date.now() > parseInt(rows[i].uTime)) {
                    const guildId = rows[i].guildid;
                    let settings = bot.settings[guildId]
                    const proofLogID = rows[i].logmessage;
                    const rolesString = rows[i].roles;
                    let roles = []
                    const guild = bot.guilds.cache.get(guildId);
                    const member = guild.members.cache.get(rows[i].id);
                    if (!member) return db.query(`UPDATE suspensions SET suspended = false WHERE id = '${rows[i].id}'`)
                    rolesString.split(' ').forEach(r => { if (r !== '') roles.push(r) })
                    try {
                        await member.edit({ roles: roles }).catch(er => ErrorLogger.log(er, bot))
                        setTimeout(() => {
                            if (member.roles.cache.has(settings.roles.tempsuspended))
                                member.edit({ roles: roles }).catch(er => ErrorLogger.log(er, bot))
                        }, 5000)
                        try {
                            let messages = await guild.channels.cache.get(settings.channels.suspendlog).messages.fetch({ limit: 100 })
                            let m = messages.get(proofLogID)
                            if (!m) {
                                guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[i].id}> has been unsuspended automatically`)
                            } else {
                                let embed = m.embeds.shift();
                                embed.setColor('#00ff00')
                                    .setDescription(embed.description.concat(`\nUnsuspended automatically`))
                                    .setFooter('Unsuspended at')
                                    .setTimestamp(Date.now())
                                m.edit(embed)
                            }
                        }
                        catch (er) {
                            guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[i].id}> has been unsuspended automatically`)
                        }
                        finally {
                            await db.query(`UPDATE suspensions SET suspended = false WHERE id = '${rows[i].id}'`)
                        }
                    } catch (er) {
                        ErrorLogger.log(er, bot)
                    }
                }
            }
        })
    }, 60000);
    //mute check
    bot.setInterval(() => {
        for (let i in bot.mutes) {
            const time = parseInt(bot.mutes[i].time);
            const guild = bot.guilds.cache.get(bot.mutes[i].guild);
            const member = guild.members.cache.get(i);
            const muteRole = guild.roles.cache.get(bot.settings[guild.id].roles.muted)
            if (Date.now() > time) {
                member.roles.remove(muteRole).catch(er => ErrorLogger.log(er, bot))
                delete bot.mutes[i];
                fs.writeFile('./mutes.json', JSON.stringify(bot.mutes, null, 4), function (err) {
                    if (err) ErrorLogger.log(err, bot);
                })
            }
        }
    }, 60000)
    //initialize components (eg. modmail, verification)
    bot.guilds.cache.each(g => {
        if (!emojiServers.includes(g.id)) {
            vibotChannels.update(g, bot).catch(er => { })
            if (bot.settings[g.id].backend.modmail) modmail.update(g, bot, db).catch(er => { })
            if (bot.settings[g.id].backend.verification) verification.init(g, bot, db).catch(er => { })
            if (bot.settings[g.id].backend.vetverification) vetVerification.init(g, bot, db).catch(er => { })
        }
    })
    //reset currentweek
    const currentWeekReset = cron.job('0 0 * * SUN', () => {
        bot.guilds.cache.each(g => {
            if (!emojiServers.includes(g.id)) {
                if (bot.settings[g.id].backend.currentweek) currentWeek.newWeek(g, bot, db);
                if (bot.settings[g.id].backend.eventcurrentweek) ecurrentWeek.newWeek(g, bot, db)
            }
        }, null, true, null, null, false)
    })
});

bot.on('error', err => {
    ErrorLogger.log(err, bot)
})

bot.on('guildMemberAdd', member => {
    db.query(`SELECT suspended FROM suspensions WHERE id = '${member.id}' AND suspended = true`, (err, rows) => {
        if (rows.length !== 0) {
            member.roles.add(bot.settings[member.guild.id].roles.tempsuspended)
            let modlog = member.guild.channels.cache.get(bot.settings[member.guild.id].channels.modlogs)
            if (!modlog) return ErrorLogger.log(new Error(`mod log not found in ${member.guild.id}`), bot)
            modlog.send(`${member} rejoined server after leaving while suspended. Giving suspended role back.`)
        }
    })
})

bot.on('guildMemberRemove', member => {
    db.query(`SELECT suspended FROM suspensions WHERE id = '${member.id}' AND suspended = true`, (err, rows) => {
        if (err) ErrorLogger.log(err, bot)
        if (rows.length !== 0) {
            let modlog = member.guild.channels.cache.get(bot.settings[member.guild.id].channels.modlogs)
            if (!modlog) return ErrorLogger.log(new Error(`mod log not found in ${member.guild.id}`), bot)
            modlog.send(`${member} is attempting to dodge a suspension by leaving the server`)
            db.query(`UPDATE suspension SET suspended = false WHERE id = '${member.id}'`)
        }
    })
})

process.on('uncaughtException', err => {
    ErrorLogger.log(err, bot);
    console.log(err);
})
process.on('unhandledRejection', err => {
    if (err) {
        if (err.message == 'Target user is not connected to voice.') return;
        if (err.message == 'Cannot send messages to this user') return
        if (err.message == 'Unknown Message') return
        if (err.message == 'Unknown Channel') return
    }
    ErrorLogger.log(err, bot);
    console.log(err);
})

async function getGuild(message) {
    return new Promise(async (resolve, reject) => {
        let guilds = []
        bot.guilds.cache.each(g => {
            if (g.members.cache.has(message.author.id) && !emojiServers.includes(g.id)) {
                guilds.push(g)
            }
        })
        if (guilds.length == 0) reject('We dont share any servers')
        else if (guilds.length == 1) resolve(guilds[0])
        else {
            let guildSelectionEmbed = new Discord.MessageEmbed()
                .setTitle('Please select a server')
                .setColor('#fefefe')
                .setDescription('None!')
                .setFooter('React with the number corresponding to the target guild')
            if (guilds.length > 10) guildSelectionEmbed.setFooter('Please type the number corresponding to the target guild')
            for (let i in guilds) {
                g = guilds[i]
                fitStringIntoEmbed(guildSelectionEmbed, `**${parseInt(i) + 1}:** ${g.name}`, message.channel)
            }
            let guildSelectionMessage = await message.channel.send(guildSelectionEmbed)
            if (guilds.length > 10) {
                let messageCollector = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                messageCollector.on('collect', async m => {
                    if (m.content.replace(/[^0-9]/g, '') != m.content) {
                        if (m.content.toLowerCase() == 'cancel') {
                            await m.delete()
                            await guildSelectionMessage.delete()
                        } else {
                            let retryMessage = await message.channel.send(`\`${m.content}\` is an invalid number. Please try again or type \`cancel\` to cancel`)
                            setTimeout(() => { retryMessage.delete() }, 5000)
                        }
                    } else {
                        let i = parseInt(m.content) - 1
                        resolve(guilds[i])
                        await guildSelectionMessage.delete()
                    }
                })
            } else {
                let reactionCollector = new Discord.ReactionCollector(guildSelectionMessage, (r, u) => !u.bot)
                reactionCollector.on('collect', async (r, u) => {
                    switch (r.emoji.name) {
                        case '1️⃣': resolve(guilds[0]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '2️⃣': resolve(guilds[1]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '3️⃣': resolve(guilds[2]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '4️⃣': resolve(guilds[3]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '5️⃣': resolve(guilds[4]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '6️⃣': resolve(guilds[5]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '7️⃣': resolve(guilds[6]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '8️⃣': resolve(guilds[7]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '9️⃣': resolve(guilds[8]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '🔟': resolve(guilds[9]); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        case '❌': reject('User Cancelled'); await guildSelectionMessage.delete(); reactionCollector.stop(); break;
                        default:
                            let retryMessage = await message.channel.send('There was an issue with the reaction. Please try again');
                            setTimeout(() => { retryMessage.delete() }, 5000)
                    }
                })
                for (let i = 0; i < guilds.length; i++) {
                    switch (i) {
                        case 0: await guildSelectionMessage.react('1️⃣'); break;
                        case 1: await guildSelectionMessage.react('2️⃣'); break;
                        case 2: await guildSelectionMessage.react('3️⃣'); break;
                        case 3: await guildSelectionMessage.react('4️⃣'); break;
                        case 4: await guildSelectionMessage.react('5️⃣'); break;
                        case 5: await guildSelectionMessage.react('6️⃣'); break;
                        case 6: await guildSelectionMessage.react('7️⃣'); break;
                        case 7: await guildSelectionMessage.react('8️⃣'); break;
                        case 8: await guildSelectionMessage.react('9️⃣'); break;
                        case 9: await guildSelectionMessage.react('🔟'); break;
                    }
                }
                await guildSelectionMessage.react('❌')
            }
        }
    })
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + `\n${string}`.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
            if (embed.length + `\n${string}`.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + `\n${string}`.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`\n${string}`))
    }
}