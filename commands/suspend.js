const fs = module.require('fs');
const Discord = require('discord.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'suspend',
    description: 'Suspends user',
    args: '[in-game names] <time> <time type d/m/s/w/y> <reason>',
    role: 'Raid Leader',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.find(r => r.name === settings.tempsuspend);
        const pSuspendRole = message.guild.roles.cache.find(r => r.name === settings.psuspended)
        const raiderRole = message.guild.roles.cache.find(r => r.name === settings.raider);
        const suspensionLog = message.guild.channels.cache.find(c => c.name === settings.suspendlog);
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
                case 'h':
                    time *= 3600000;
                    timeTypeString = 'hour(s)';
                    break;
                default:
                    message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**h**__our, __**s**__econd, __**w**__eek, __**y**__ear");
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

                if (member == null) return message.channel.send(`${u} not found, please try again`);

                if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be muted`);

                if (member.roles.cache.has(pSuspendRole.id)) return message.channel.send('User is perma suspended already, no need to suspend again')

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
                        .setDescription(`The suspension is for ${parseInt(args[0])} ${timeTypeString}`)
                        .addField(`User Information \`${member.nickname}\``, `<@!${member.id}> (Tag: ${member.user.tag})`, true)
                        .addField(`Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, `<@!${message.author.id}> (Tag: ${message.author.tag})`, true)
                        .addField(`Reason:`, reason)
                        .addField(`Roles`, 'None!')
                        .setFooter(`Unsuspending at `)
                        .setTimestamp(Date.now() + time);


                    let userRolesString = '', userRoles = []
                    member.roles.cache.each(r => {
                        if (!r.managed) {
                            userRoles.push(r.id)
                            userRolesString = userRolesString.concat(`${r.id} `)
                        }
                        if (embed.fields[3].value == 'None!') {
                            embed.fields[3].value = `<@&${r.id}>`
                        } else {
                            embed.fields[3].value += `, <@&${r.id}>`
                        }
                    })
                    messageId = await suspensionLog.send(embed);
                    await member.roles.remove(userRoles)
                    setTimeout(() => { member.roles.add(suspendedRole.id); }, 2000)

                    db.query(`INSERT INTO suspensions (id, guildid, suspended, uTime, reason, modid, roles, logmessage) VALUES ('${member.id}', '${message.guild.id}', true, '${Date.now() + time}', '${reason}', '${message.author.id}', '${userRolesString}', '${messageId.id}');`)

                    message.channel.send(`${member} has been suspended`)

                    /*
                    bot.suspensions[member.id] = {
                        guild: message.guild.id,
                        time: Date.now() + time,
                        reason: reason,
                        by: message.author.id,
                        logMessage: messageId.id,
                        roles: userRoles
                    }
                    fs.writeFile('./suspensions.json', JSON.stringify(bot.suspensions, null, 4), err => {
                        if (err) return ErrorLogger.log(err, bot);
                        message.channel.send(`${member.nickname} has been suspended`);
                    });
                    */
                }

            })
        } catch (er) {
            ErrorLogger.log(er, bot)
            message.channel.send("Error with command. Please check syntax and try again");
        }
    }
}