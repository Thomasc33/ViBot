const fs = require('fs');
const Discord = require('discord.js');
const botSettings = require('./settings.json');
const prefix = botSettings.prefix;
const bot = new Discord.Client();
bot.commands = new Discord.Collection();
bot.vetBans = require('./vetBans.json');
bot.suspensions = require('./suspensions.json')
const ErrorLogger = require(`./logError`)
const mysql = require('mysql')

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    bot.commands.set(command.name, command);
}

bot.on('message', message => {
    //if (message.content.includes(`<@!${bot.user.id}>`) || message.content.includes(`<@!277636691227836419>`)) { message.react('706688782732230696') }
    if (!message.content.startsWith(prefix) || message.channel.type === 'dm' || message.author.bot) return;
    if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Event Organizer").position) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const pcommand = args.shift().toLowerCase();
    var command = aliasCheck(pcommand);
    if (/[^a-z]/gi.test(command)) return;
    if (!bot.commands.has(command)) {
        message.channel.send('Command doesnt exist, check \`commands\` and try again');
        return;
    }
    try {
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === bot.commands.get(command).role).position && message.author.id !== '277636691227836419') return;
    } catch (er) { ErrorLogger.log(er, bot) }
    try {
        bot.commands.get(command).execute(message, args, bot, db);
    } catch (er) {
        ErrorLogger.log(er, bot)
        message.channel.send("Issue executing the command, check \`;commands\` and try again");
    }
});

function aliasCheck(pcommand) {
    switch (pcommand) {
        case 'rc':
            return 'lock';
        case 'resetchannel':
            return 'lock';
        case 'ul':
            return 'unlock';
        case 'loc':
            return 'location';
        case 'pm':
            return 'parsemembers';
        case 'aa':
            return 'addalt';
        case 'ping':
            return 'status';
        case 'hc':
            return 'headcount';
        case 'cn':
            return 'changename';
        case 'rq':
            return 'request';
        case 'clear':
            return 'clean';
        case 'gfb':
            return 'getfeedback';
        case 'mvv':
            return 'manualvetverify';
        case 'mv':
            return 'manualverify';
        case 'help':
            return 'commands';
        case 'ava':
            return 'avatar';
        case 'bp':
            return 'bazaarparse';
        case 'bpm':
            return 'bazaarparse';
        case 'suspect':
            return 'suspectalt';
        case 'sa':
            return 'suspectalt';
        case 'eafk':
            return 'eventafk';
        case 'rr':
            return 'russianroulette';
        default:
            return pcommand;
    }
}

bot.login(botSettings.key);

var db = mysql.createConnection(botSettings.dbInfo)

db.connect(err => {
    if(err) throw err;
    console.log('Connected to database')
})

bot.on("ready", () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    bot.user.setActivity(`No, I'm not hardcoded`);
    bot.setInterval(() => {
        for (let i in bot.vetBans) {
            const time = bot.vetBans[i].time;
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

    }, 60000);//change to 60k after testing
    bot.setInterval(() => {
        for (let i in bot.suspensions) {
            const time = bot.suspensions[i].time;
            const guildId = bot.suspensions[i].guild;
            const proofLogID = bot.suspensions[i].logMessage;
            const roles = bot.suspensions[i].roles;
            const guild = bot.guilds.cache.get(guildId);
            const member = guild.members.cache.get(i);
            const suspendedRole = guild.roles.cache.find(r => r.name === 'Suspended but Verified');
            try {
                if (Date.now() > time) {
                    member.edit({
                        roles: roles
                    })
                    member.roles.add(roles)
                    delete bot.suspensions[i];
                    fs.writeFile('./suspensions.json', JSON.stringify(bot.suspensions, null, 4), function (err) {
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

    }, 1000);
});