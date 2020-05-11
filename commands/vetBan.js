const fs = module.require('fs');
const Discord = require('discord.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'vetban',
    description: 'Gives user vet banned role',
    args: '[in-game names] <time> <time type d/m/s/w/y> <reason>',
    role: 'Veteran Raid Leader',
    async execute(message, args, bot) {
        const vetBanRole = message.guild.roles.cache.find(r => r.name === 'Banned Veteran Raider');
        const vetRaiderRole = message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        const suspensionLog = message.guild.channels.cache.find(c => c.name === 'suspend-log');
        if (!message.channel.name === 'veteran-bot-commands') {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Veteran Raid Leader").position) return;
        let toBan = [];

        for (i = 0; i < args.length; i++) {
            let arg = args[0];
            if (arg.replace(/[a-z]/gi, '') !== '') {
                break;
            } else {
                toBan.push(args.shift());
            }
        }
        try {
            let time = parseInt(args[0]);
            let timeType = args[1];
            let timeTypeString;

            switch (timeType.toLowerCase()) {
                case 'd':
                    time *= 86400000;
                    timeTypeString = 'day(s)';
                    break;
                case 'm':
                    time *= 60000;
                    timeTypeString = 'minutes';
                    break;
                case 's':
                    time *= 1000;
                    timeTypeString = 'second(s)';
                    break;
                case 'w':
                    time *= 604800000;
                    timeTypeString = 'week(s)';
                    break;
                case 'y':
                    time *= 31536000000;
                    timeTypeString = 'year(s)';
                    break;
                default:
                    message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**s**__econd, __**w**__eek, __**y**__ear");
                    return;
            }
            var reason = "";
            for (i = 2; i < args.length; i++) {
                reason = reason.concat(args[i]) + ' ';
            }
            if (reason == "") reason = "None"
            toBan.forEach(u => {

                let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()));

                if (member == null) {
                    message.channel.send(`${u} not found, please try again`);
                    return;
                }
                if (!member.roles.cache.has(vetRaiderRole.id)) {
                    message.channel.send(member.nickname.concat(' does not have veteran raider role'))
                    return;
                }
                if (member.roles.cache.has(vetBanRole.id)) {
                    message.channel.send(member.nickname.concat(' already has a veteran ban. Reply __**Y**__es to overwrite'));
                    let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
                    collector.on('collect', message => {
                        if (message.content.charAt(0) == 'y') {
                            message.channel.send('Overwriting vet ban...');
                            vetBanProcess()
                            collector.stop();
                        } else {
                            message.channel.send('Response not recognized. Please try suspending again');
                            cont = false;
                            collector.stop();
                        }
                    })
                } else {
                    vetBanProcess()
                }
                async function vetBanProcess() {
                    let embed = new Discord.MessageEmbed()
                        .setColor('#ff0000')
                        .setTitle('Veteran Ban Information')
                        .setDescription(`The ban is for ${parseInt(args[0])} ${timeTypeString}`)
                        .addField(`User Information \`${member.nickname}\``, `<@!${member.id}> (Tag: ${member.user.tag})`, true)
                        .addField(`Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, `<@!${message.author.id}> (Tag: ${message.author.tag})`, true)
                        .addField(`Reason:`, reason)
                        .setFooter(`Unsuspending at `)
                        .setTimestamp(Date.now() + time);
                    messageId = await suspensionLog.send(embed);

                    member.roles.remove(vetRaiderRole);
                    member.roles.add(vetBanRole);

                    bot.vetBans[member.id] = {
                        guild: message.guild.id,
                        time: Date.now() + time,
                        reason: reason,
                        by: message.author.id,
                        logMessage: messageId.id
                    }

                    fs.writeFile('./vetBans.json', JSON.stringify(bot.vetBans, null, 7), function (err) {
                        if (err) return console.error(err);
                        message.channel.send(`${member.nickname} will be suspended`);
                    });
                }

            })
        } catch (er) {
            ErrorLogger.log(er, bot)
            message.channel.send("Error with command. Please check syntax and try again");
        }
    }
}