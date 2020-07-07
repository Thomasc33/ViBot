const fs = module.require('fs')
const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'unsuspend',
    description: 'Manually unsuspends user',
    args: '<ign> (reason)',
    role: 'Raid Leader',
    execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var raider = args.shift();
        var reason = '';
        for (i = 0; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' ';
        }
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(raider)
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(raider.toLowerCase()));
        if (reason == '') { reason = 'None provided' }
        if (member == null) {
            message.channel.send("User not found, please try again");
            return;
        }
        if (!member.roles.cache.has(message.guild.roles.cache.find(r => r.name == settings.tempsuspend).id)) {
            message.channel.send("User is not suspended")
            return;
        }

        db.query(`SELECT * FROM suspensions WHERE id = '${member.id}' AND suspended = '1'`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (rows && rows.length == 0) {
                message.channel.send(`This user was not suspended by ${bot.user}. Would you still like to unsuspend them (removes suspended and gives raider role back)? Y/N`)
                let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
                collector.on('collect', m => {
                    try {
                        if (m.content.toLowerCase().charAt(0) == 'y') {
                            const suspendedRole = message.guild.roles.cache.find(r => r.name === settings.tempsuspend);
                            const raiderRole = message.guild.roles.cache.find(r => r.name === settings.raider);
                            member.roles.remove(suspendedRole)
                                .then(member.roles.add(raiderRole));
                            message.channel.send("User unsuspended successfully");
                        }
                    } catch (er) {
                        ErrorLogger.log(er, bot)
                    }
                });
            } else {
                const guildId = rows[0].guildid;
                const proofLogID = rows[0].logmessage;
                const rolesString = rows[0].roles;
                let roles = []
                const guild = bot.guilds.cache.get(guildId);
                const member = guild.members.cache.get(rows[0].id);
                const reason = rows[0].reason
                rolesString.split(' ').forEach(r => { if (r != '') roles.push(r) })
                try {
                    await member.edit({
                        roles: roles
                    })
                    try {
                        let embed = bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === settings.suspendlog).messages.cache.get(proofLogID).embeds.shift();
                        embed.setColor('#00ff00')
                            .setDescription(embed.description.concat(`\nUnsuspended manually by <@!${message.author.id}>`))
                            .setFooter('Unsuspended at')
                            .setTimestamp(Date.now())
                            .addField('Reason for unsuspension', reason)
                        let messages = await bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === settings.suspendlog).messages.fetch({ limit: 100 })
                        messages.filter(m => m.id == proofLogID && m.author.id == bot.user.id).first().edit(embed)
                    }
                    catch (er) { bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === settings.suspendlog).send(`${member} has been unsuspended by ${message.member}`) }
                    db.query(`UPDATE suspensions SET suspended = 0 WHERE id = '${member.id}'`)
                    message.channel.send(`${member} has been unsuspended`)
                } catch (er) {
                    ErrorLogger.log(er, bot)
                }
            }
        })
        /*
               let found = false;
               for (let i in bot.suspensions) {
                   if (i == member.id) {
                       found = true;
                       const time = bot.suspensions[i].time;
                       const guildId = bot.suspensions[i].guild;
                       const proofLogID = bot.suspensions[i].logMessage;
                       const roles = bot.suspensions[i].roles;
                       const guild = bot.guilds.cache.get(guildId);
                       const member = guild.members.cache.get(i);
                       const suspendedRole = guild.roles.cache.find(r => r.name === 'Suspended but Verified');
                       try {
                           unsuspend()
                           async function unsuspend() {
                               await member.edit({
                                   roles: roles
                               })
                               setTimeout(() => {
                                   delete bot.suspensions[i];
                                   fs.writeFile('./suspensions.json', JSON.stringify(bot.suspensions, null, 4), async function (err) {
                                       if (err) throw err;
       
                                       try {
                                           let embed = bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.cache.get(proofLogID).embeds.shift();
                                           embed.setColor('#00ff00')
                                               .setDescription(embed.description.concat(`\nUnsuspended manually by <@!${message.author.id}>`))
                                               .setFooter('Unsuspended at')
                                               .setTimestamp(Date.now())
                                               .addField('Reason for unsuspension', reason)
                                           let messages = await bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.fetch({ limit: 100 })
                                           messages.filter(m => m.id == proofLogID && m.author.id == bot.user.id).first().edit(embed)
                                       }
                                       catch (er) { bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').send(`${member} has been unsuspended by ${message.member}`) }
       
                                       message.channel.send(`${member} has been unsuspended`)
                                   })
                               }, 2000)
                           }
                       } catch (er) {
                           ErrorLogger.log(er, bot)
                           continue;
                       }
                   }
               }
               if (!found) {
            message.channel.send(`This user was not suspended by ${bot.user}. Would you still like to unsuspend then? Y/N`)
            let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
            collector.on('collect', m => {
                try {
                    if (m.content.toLowerCase().charAt(0) == 'y') {
                        const suspendedRole = message.guild.roles.cache.find(r => r.name === 'Suspended but Verified');
                        const raiderRole = message.guild.roles.cache.find(r => r.name === 'Verified Raider');
                        member.roles.remove(suspendedRole)
                            .then(member.roles.add(raiderRole));
                        message.channel.send("User unsuspended successfully");
                    }
                } catch (er) {
                    ErrorLogger.log(er, bot)
                }
            });
               }
               */
    }
}