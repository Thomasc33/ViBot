const fs = require('fs')
const Discord = require('discord.js')
const cron = require('cron')
const mysql = require('mysql')
const botSettings = require('./settings.json')
const prefix = botSettings.prefix
const bot = new Discord.Client()
bot.commands = new Discord.Collection()
bot.vetBans = require('./vetBans.json')
bot.suspensions = require('./suspensions.json')
bot.crasherList = require('./crasherList.json')
bot.mutes = require('./mutes.json')
bot.afkChecks = require('./afkChecks.json')
const ErrorLogger = require(`./logError`)
const vibotChannels = require('./commands/vibotChannels')
const vetVerification = require('./commands/vetVerification')
const currentWeek = require('./commands/currentWeek')
const ecurrentWeek = require('./commands/eventCurrentWeek')
const stats = require('./commands/stats')
const modmail = require('./commands/modmail')
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    bot.commands.set(command.name, command);
}

bot.on('message', message => {
    //if (message.content.includes(`<@!${bot.user.id}>`) || message.content.includes(`<@!277636691227836419>`)) { message.react('706688782732230696') }
    if (message.channel.type === 'dm') return dmHandler(message)
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const commandName = args.shift().toLowerCase()
    const command = bot.commands.get(commandName) || bot.commands.find(cmd => cmd.alias && cmd.alias.includes(commandName))

    if (!command) return message.channel.send('Command doesnt exist, check \`commands\` and try again');
    try {
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === command.role).position && message.author.id !== '277636691227836419') return;
    } catch (er) { ErrorLogger.log(er, bot) }
    try {
        command.execute(message, args, bot, db);
    } catch (er) {
        ErrorLogger.log(er, bot)
        message.channel.send("Issue executing the command, check \`;commands\` and try again");
    }
});

async function dmHandler(message) {
    if (message.author.bot) return;
    let statsTypos = ['stats', 'satts', 'stat', 'status', 'sats', 'stata', 'stts']
    if (statsTypos.includes(message.content.replace(/[^a-z0-9]/gi, ''))) {
        message.channel.send(await stats.getStatsEmbed(message.author.id, bot.guilds.cache.get(botSettings.guildID), db))
    } else {
        modmail.sendModMail(message, bot.guilds.cache.get(botSettings.guildID), bot, db)
    }
}

bot.login(botSettings.key);

var db = mysql.createConnection(botSettings.dbInfo)

db.connect(err => {
    if (err) throw err;
    console.log('Connected to database')
})

bot.on("ready", () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    bot.user.setActivity(`No, I'm not hardcoded`);
    const halls = bot.guilds.cache.get(botSettings.guildID);
    bot.setInterval(() => {
        for (let i in bot.vetBans) {
            const time = parseInt(bot.vetBans[i].time);
            const guildId = bot.vetBans[i].guild;
            const reason = bot.vetBans[i].reason;
            const banBy = bot.vetBans[i].by;
            const proofLogID = bot.vetBans[i].logMessage;
            const guild = bot.guilds.cache.get(guildId);
            const member = guild.members.cache.get(i);
            const vetBanRole = guild.roles.cache.find(r => r.name === 'Banned Veteran Raider');
            const vetRaiderRole = guild.roles.cache.find(r => r.name === 'Veteran Raider');
            try {
                if (Date.now() > time) {
                    member.roles.remove(vetBanRole)
                        .then(member.roles.add(vetRaiderRole));
                    delete bot.vetBans[i];
                    fs.writeFile('./vetBans.json', JSON.stringify(bot.vetBans, null, 7), function (err) {
                        if (err) throw err;

                        let embed = bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.cache.get(proofLogID).embeds.shift();
                        embed.setColor('#00ff00')
                            .setFooter('Unsuspended at');
                        bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.cache.get(proofLogID).edit(embed);
                    })
                }
            } catch (er) {
                ErrorLogger.log(er, bot)
                continue;
            }
        }
    }, 60000);
    bot.setInterval(() => {
        db.query(`SELECT * FROM suspensions WHERE suspended = '1'`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            for (let i in rows) {
                if (Date.now() > parseInt(rows[i].uTime)) {
                    const guildId = rows[i].guildid;
                    const proofLogID = rows[i].logmessage;
                    const rolesString = rows[i].roles;
                    let roles = []
                    const guild = bot.guilds.cache.get('701483950559985705');
                    const reason = rows[i].reason
                    const member = guild.members.cache.get(rows[i].id);
                    rolesString.split(' ').forEach(r => { if (r !== '') roles.push(r) })
                    try {
                        await member.edit({
                            roles: roles
                        })
                        .catch(er => ErrorLogger.log(er, bot))
                        try {
                            let messages = await bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.fetch({ limit: 100 })
                            let m = messages.get(proofLogID)
                            if (!m) {
                                guild.channels.cache.find(c => c.name === 'suspend-log').send(`<@!${rows[i].id}> has been unsuspended automatically`)
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
                            bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').send(`<@!${rows[i].id}> has been unsuspended automatically`)
                        }
                        finally {
                            console.log(`UPDATE suspensions SET suspended = 0 WHERE id = '${rows[i].id}'`)
                            await db.query(`UPDATE suspensions SET suspended = 0 WHERE id = '${rows[i].id}'`)
                        }

                    } catch (er) {
                        ErrorLogger.log(er, bot)
                    }
                }
            }
        })

        /*for (let i in bot.suspensions) {
            const time = bot.suspensions[i].time;
            const guildId = bot.suspensions[i].guild;
            const proofLogID = bot.suspensions[i].logMessage;
            const roles = bot.suspensions[i].roles;
            const guild = bot.guilds.cache.get(guildId);
            const member = guild.members.cache.get(i);
            const suspendedRole = guild.roles.cache.find(r => r.name === 'Suspended but Verified');
            try {
                if (Date.now() > time) {
                    unsuspendProcess()
                    async function unsuspendProcess() {
                        await member.edit({
                            roles: roles
                        })
                        setTimeout(() => {
                            delete bot.suspensions[i];
                            fs.writeFile('./suspensions.json', JSON.stringify(bot.suspensions, null, 4), async function (err) {
                                if (err) throw err;

                                try {
                                    let messages = await bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.fetch({ limit: 100 })
                                    let message = messages.get(proofLogID)
                                    let embed = message.embeds.shift();
                                    embed.setColor('#00ff00')
                                        .setFooter('Unsuspended at');
                                    message.edit(embed)
                                }
                                catch (er) { bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').send(`${member} has been unsuspended automatically`) }
                            })
                        }, 2000)
                    }
                }
            } catch (er) {
                ErrorLogger.log(er, bot)
                continue;
            }
        }
*/
    }, 60000);
    bot.guilds.cache.each(g => {
        try {
            vibotChannels.update(g, bot)
        } catch (er) { return; }
    })
    const currentWeekReset = cron.job('0 0 * * SUN', () => { currentWeek.newWeek(halls, bot, db); ecurrentWeek.newWeek(halls, bot, db) }, null, true, null, null, false)
    modmail.update(halls, bot, db)
    //vetVerification.init(bot.guilds.cache.get(botSettings.guildID), bot, db)
});

bot.on('error', err => {
    ErrorLogger.log(err, bot)
})