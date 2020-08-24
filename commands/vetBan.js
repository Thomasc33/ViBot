const fs = require('fs');
const Discord = require('discord.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'vetban',
    description: 'Gives user vet banned role',
    args: '[in-game names] <time> <time type d/m/s/w/y> <reason>',
    requiredArgs: 3,
    role: 'vetrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const vetBanRole = message.guild.roles.cache.get(settings.roles.vetban)
        const vetRaiderRole = message.guild.roles.cache.get(settings.roles.vetraider);
        const suspensionLog = message.guild.channels.cache.get(settings.channels.suspendlog)
        let toBan = [];
        if (args.length < 3) {
            message.channel.send("Expected at least 4 arguments, but recieved " + args.length)
            return;
        }
        for (i = 0; i < args.length; i++) {
            var arg = args[0];
            if (arg.replace(/^\d{1,2}$/, '') == '') {
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
            return message.channel.send("Invalid time given. Please try again");
        }
        try {
            var reason = "";
            for (i = 2; i < args.length; i++) {
                reason = reason.concat(args[i]) + ' ';
            }
            if (reason == "") reason = "None"
            reason = reason.replace(`'`, '`')
            toBan.forEach(u => {
                let member = message.guild.members.cache.get(u)
                if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()));
                if (!member) member = message.guild.members.cache.get(u.replace(/[<>@!]/gi, ''))
                if (!member) return message.channel.send(`${u} not found, please try again`);
                if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be vetbanned`);
                if (member.roles.cache.has(settings.roles.vetraider)) return message.channel.send(`${member} is does not have veteran raider role`)
                if (member.roles.cache.has(vetBanRole.id)) {
                    db.query(`SELECT * FROM vetbans WHERE id = '${member.id}' AND suspended = true`, async (err, rows) => {
                        if (rows.length != 0) {
                            message.channel.send(member.nickname.concat(' is already vetbanned. Reply __**Y**__es to overwrite.'));
                            let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
                            collector.on('collect', message => {
                                if (message.content.charAt(0) == 'y') {
                                    db.query(`UPDATE vetbans SET suspended = 0 WHERE id = '${member.id}'`)
                                    message.channel.send('Overwriting suspension...');
                                    vetBanProcess()
                                    collector.stop();
                                } else if (message.content.charAt(0) == 'n') {
                                    return collector.stop()
                                } else {
                                    message.channel.send('Response not recognized. Please try banning again');
                                    collector.stop();
                                }
                            })
                        } else return message.channel.send(`${member} is already vet banned, and I dont have any record of them being banned`)
                    })
                } else {
                    vetBanProcess()
                }
                async function vetBanProcess() {
                    let embed = new Discord.MessageEmbed()
                        .setColor('#ff0000')
                        .setTitle('Vet Ban Information')
                        .setDescription(`The ban is for ${parseInt(args[0])} ${timeTypeString}`)
                        .addField(`User Information \`${member.nickname}\``, `<@!${member.id}> (Tag: ${member.user.tag})`, true)
                        .addField(`Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, `<@!${message.author.id}> (Tag: ${message.author.tag})`, true)
                        .addField(`Reason:`, reason)
                        .setFooter(`Unsuspending at `)
                        .setTimestamp(Date.now() + time);
                    messageId = await suspensionLog.send(embed);
                    await member.user.send(embed)
                    db.query(`INSERT INTO vetbans (id, guildid, suspended, uTime, reason, modid, logmessage) VALUES ('${member.id}', '${message.guild.id}', true, '${Date.now() + time}', '${reason}', '${message.author.id}', '${messageId.id}');`, err => { if (err) console.log(err) })
                    await member.roles.remove(settings.roles.vetraider)
                    setTimeout(() => { member.roles.add(settings.roles.vetban); }, 1000)
                    message.channel.send(`${member} has been vet banned`)
                }
            })
        } catch (er) {
            ErrorLogger.log(er, bot)
            message.channel.send("Error with command. Please check syntax and try again");
        }
    }
}