const fs = module.require('fs');
const Discord = require('discord.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'suspend',
    description: 'Suspends user',
    args: '[in-game names] <time> <time type d/m/s/w/y> <reason>',
    role: 'Raid Leader',
    async execute(message, args, bot) {
        const suspendedRole = message.guild.roles.cache.find(r => r.name === 'Suspended but Verified');
        const raiderRole = message.guild.roles.cache.find(r => r.name === 'Verified Raider');
        const suspensionLog = message.guild.channels.cache.find(c => c.name === 'suspend-log');
        let toBan = [];
        if (args.length < 3) {
            message.channel.send("Expected at least 4 arguments, but recieved " + args.length)
            return;
        }
        for (i = 0; i < args.length; i++) {
            var arg = args[0];
            if (arg.replace(/[a-z]/gi, '') !== '') {
                break;
            } else {
                toBan.push(args.shift());
            }
        }
        try {
            var time = parseInt(args[0]);
            var timeType = args[1];
            var timeTypeString;

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
        } catch (er) {
            message.channel.send("Invalid time given. Please try again");
            return;
        }
        try {
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

                if (member.roles.highest.position >= message.member.roles.highest.position) {
                    message.channel.send(`${member} has a role greater than or equal to you and cannot be muted`);
                    return;
                }

                if (member.roles.cache.has(suspendedRole.id)) {
                    if (bot.suspensions[member.id]) {
                        message.channel.send(member.nickname.concat(' is already suspended. Reply __**Y**__es to overwrite. *This is not recommended if they are suspended by dylanbot'));
                        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
                        collector.on('collect', message => {
                            if (message.content.charAt(0) == 'y') {
                                message.channel.send('Overwriting suspension...');
                                vetBanProcess()
                                collector.stop();
                            } else if (message.content.carAt(0) == 'n') {
                                collector.stop()
                                return;
                            } else {
                                message.channel.send('Response not recognized. Please try suspending again');
                                cont = false;
                                collector.stop();
                            }
                        })
                    } else {
                        message.channel.send(member.nickname.concat(' was not suspended by me. Please try to overwrite through funman'))
                    }
                } else {
                    vetBanProcess()
                }
                async function vetBanProcess() {
                    let embed = new Discord.MessageEmbed()
                        .setColor('#ff0000')
                        .setTitle('Suspension Information')
                        .setDescription(`The ban is for ${parseInt(args[0])} ${timeTypeString}`)
                        .addField(`User Information \`${member.nickname}\``, `<@!${member.id}> (Tag: ${member.user.tag})`, true)
                        .addField(`Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, `<@!${message.author.id}> (Tag: ${message.author.tag})`, true)
                        .addField(`Reason:`, reason)
                        .setFooter(`Unsuspending at `)
                        .setTimestamp(Date.now() + time);
                    messageId = await suspensionLog.send(embed);

                    let userRoles = []
                    member.roles.cache.each(r => {
                        userRoles.push(r.id)
                    })

                    await member.roles.remove(userRoles)
                    setTimeout(() => { member.roles.add(suspendedRole.id); }, 2000)

                    bot.suspensions[member.id] = {
                        guild: message.guild.id,
                        time: Date.now() + time,
                        reason: reason,
                        by: message.author.id,
                        logMessage: messageId.id,
                        roles: userRoles
                    }

                    fs.writeFile('./suspensions.json', JSON.stringify(bot.suspensions, null, 4), function (err) {
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