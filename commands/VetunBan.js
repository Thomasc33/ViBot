const fs = require('fs')
const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'vetunban',
    description: 'Removes the banned veteran raider role manually',
    args: '<user in game name> (reason)',
    requiredArgs: 1,
    role: 'veteventrl',
    execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var raider = args.shift();
        var reason = '';
        for (i = 0; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' ';
        }
        let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(raider.toLowerCase()));
        if (!member) return message.channel.send("User not found, please try again");
        if (!member.roles.cache.has(settings.roles.vetban)) return message.channel.send(`${member} is not vetbanned`)
        db.query(`SELECT * FROM vetbans WHERE id = ${member.id} AND suspended = true`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (rows.length != 0) {
                const proofLogID = rows[0].logmessage;
                member.roles.remove(settings.roles.vetban)
                    .then(member.roles.add(settings.roles.vetraider));
                db.query(`UPDATE vetbans SET suspended = false WHERE id = '${member.id}'`)
                let logMessage = await message.guild.channels.cache.get(settings.channels.suspendlog).messages.fetch(proofLogID)
                if (logMessage) {
                    let embed = logMessage.embeds.shift();
                    embed.setColor('#00ff00')
                        .setDescription(embed.description.concat(`\nUn-vet-banned automatically`))
                        .setFooter('Unsuspended at')
                        .setTimestamp(Date.now())
                    logMessage.edit({ embeds: [embed] });
                } else {
                    message.guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[0].id}> has been un-vet-banned automatically`)
                }
                message.channel.send("User unbanned successfully");
            } else {
                message.channel.send(`This user was not vet banned by ${bot.user}. Would you still like to unban then? Y/N`)
                let collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id, time: 10000 });
                collector.on('collect', m => {
                    collector.stop()
                    try {
                        if (m.content.toLowerCase().charAt(0) == 'y') {
                            member.roles.remove(settings.roles.vetban)
                                .then(member.roles.add(settings.roles.vetraider));
                            message.channel.send("User unbanned successfully");
                        }
                    } catch (er) {
                        ErrorLogger.log(er, bot)
                    }
                });
            }
        })
    }
}