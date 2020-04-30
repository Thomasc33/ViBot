const fs = require('fs');
const Discord = require('discord.js');
const botSettings = require('./settings.json');
const prefix = botSettings.prefix;
const bot = new Discord.Client();
bot.commands = new Discord.Collection();
bot.vetBans = require('./vetBans.json');

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    bot.commands.set(command.name, command);
}

bot.on('message', message => {
    if (!message.content.startsWith(prefix) || message.channel.type === 'dm' || message.author.bot) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const pcommand = args.shift().toLowerCase();
    var command = aliasCheck(pcommand);

    if (!bot.commands.has(command)) {
        message.channel.send('Command doesnt exist, check \`commands\` and try again');
        return;
    }
    try {
        bot.commands.get(command).execute(message, args, bot);
    } catch (er) {
        console.log(er);
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
        default:
            return pcommand;
    }
}

bot.login(botSettings.key);

bot.on("ready", () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    bot.user.setActivity(`No, I'm not hardcoded`);
});