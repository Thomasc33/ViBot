const fs = require('fs');
const Discord = require('discord.js');
const botSettings = require('./settings.json');
const prefix = botSettings.prefix;
const bot = new Discord.Client();
bot.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    bot.commands.set(command.name, command);
}

bot.on('message', message => {
    if (!message.content.startsWith(prefix) || message.channel.type === 'dm' || message.author.bot) return;
    if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) return;
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    if (!bot.commands.has(command)) return;

    try {
        bot.commands.get(command).execute(message, args);
    } catch (er) {
        console.log(er);
        message.channel.send("Issue executing the command, check \`;commands\` and try again");
    }
});

bot.login(botSettings.key);

bot.on("ready", () => {
    console.log(`Bot loaded: ${bot.user.username}`);
    bot.user.setActivity(`No, I'm not hardcoded`);
});