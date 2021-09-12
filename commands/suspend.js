const fs = module.require('fs');
const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'suspend',
    description: 'Suspends user',
    args: '[users] <time> <time type d/m/s/w/y> <reason>',
    requiredArgs: 3,
    role: 'rl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const pSuspendRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        const raiderRole = message.guild.roles.cache.get(settings.roles.raider)
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
                case 'd': time *= 86400000; timeTypeString = 'day(s)'; break;
                case 'm': time *= 60000; timeTypeString = 'minute(s)'; break;
                case 's': time *= 1000; timeTypeString = 'second(s)'; break;
                case 'w': time *= 604800000; timeTypeString = 'week(s)'; break;
                case 'y': time *= 31536000000; timeTypeString = 'year(s)'; break;
                case 'h': time *= 3600000; timeTypeString = 'hour(s)'; break;
                default: return message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**h**__our, __**s**__econd, __**w**__eek, __**y**__ear");
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
                if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be suspended`);
                if (member.roles.cache.has(pSuspendRole.id)) return message.channel.send('User is perma suspended already, no need to suspend again')
                if (member.roles.cache.has(suspendedRole.id)) {
                    db.query(`SELECT * FROM suspensions WHERE id = '${member.id}' AND suspended = true`, async (err, rows) => {
                        if (rows.length != 0) {
                            message.channel.send(member.nickname.concat(' is already suspended. Reply __**Y**__es to overwrite.'));
                            let collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id, time: 10000 });
                            collector.on('collect', message => {
                                if (message.content.charAt(0).toLowerCase() == 'y') {
                                    message.channel.send('Overwriting suspension...');
                                    suspendProcess(true)
                                    collector.stop();
                                } else if (message.content.charAt(0).toLowerCase() == 'n') {
                                    collector.stop()
                                    return;
                                } else {
                                    message.channel.send('Response not recognized. Please try suspending again');
                                    collector.stop();
                                }
                            })
                        } else return message.channel.send('Suspension was not made through ViBot. Please attempt to overwrite the suspension through another bot')
                    })
                } else {
                    suspendProcess(false)
                }
                async function suspendProcess(overwrite) {
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
                    if (overwrite) {
                        db.query(`UPDATE suspensions SET uTime = '${Date.now() + time}' WHERE id = '${member.id}' AND suspended = true`)
                        embed.fields[3].value = `Overwritten suspensions. Roles the same as prior suspension`
                        suspensionLog.send({ embeds: [embed] }).then(member.user.send({ embeds: [embed] }))
                    } else {
                        let userRolesString = '', userRoles = []
                        const roles = [...member.roles.cache.filter(r => !r.managed && r.id != settings.roles.nitro).values()];
                        embed.fields[3].value = roles.join(', ') || 'None!';
                        member.roles.cache.each(r => {
                            if (!r.managed && r.id != settings.roles.nitro) {
                                userRoles.push(r.id)
                                userRolesString = userRolesString.concat(`${r.id} `)
                            }
                        })
                        messageId = await suspensionLog.send({ embeds: [embed] });
                        await member.roles.remove(userRoles)
                        setTimeout(() => { member.roles.add(suspendedRole.id); }, 1000)
                        await member.user.send({ embeds: [embed] })
                        db.query(`INSERT INTO suspensions (id, guildid, suspended, uTime, reason, modid, roles, logmessage) VALUES ('${member.id}', '${message.guild.id}', true, '${Date.now() + time}', ${db.escape(reason)}, '${message.author.id}', '${userRolesString}', '${messageId.id}');`)
                    }
                    message.channel.send(`${member} has been suspended`)
                }

            })  
        } catch (er) {
            ErrorLogger.log(er, bot)
            message.channel.send("Error with command. Please check syntax and try again");
        }
    }
}