const fs = require('fs')
const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'vetunban',
    description: 'Removes the banned veteran raider role manually',
    args: '<user in game name> (reason)',
    role: 'Veteran Raid Leader',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === settings.vrl).position) return;
        var raider = args.shift();
        var reason = '';
        for (i = 0; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' ';
        }
        let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(raider.toLowerCase()));

        if (member == null) {
            message.channel.send("User not found, please try again");
            return;
        }
        let found = false;
        for (let i in bot.vetBans) {
            if (i == member.id) {
                found = true;
                const time = bot.vetBans[i].time;
                const guildId = bot.vetBans[i].guild;
                const Initialreason = bot.vetBans[i].reason;
                const banBy = bot.vetBans[i].by;
                const proofLogID = bot.vetBans[i].logMessage;
                const guild = bot.guilds.cache.get(guildId);
                const member = guild.members.cache.get(i);
                const vetBanRole = guild.roles.cache.find(r => r.name === settings.vetban);
                const vetRaiderRole = guild.roles.cache.find(r => r.name === settings.vetraider);
                try {
                    unban()
                    async function unban() {
                        member.roles.remove(vetBanRole)
                            .then(member.roles.add(vetRaiderRole));
                        delete bot.vetBans[i];
                        fs.writeFileSync('./vetBans.json', JSON.stringify(bot.vetBans, null, 7), function (err) {
                            if (err) throw err;

                            let embed = bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === settings.suspendlog).messages.cache.get(proofLogID).embeds.shift();
                            embed.setColor('#00ff00')
                                .setDescription(embed.description.concat(`\nUnsuspended manually by <@!${message.author.id}>`))
                                .setFooter('Unsuspended at')
                                .setTimestamp(Date.now())
                                .addField('Reason for unsuspension', reason)
                            bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === settings.suspendlog).messages.cache.get(proofLogID).edit(embed);

                            message.channel.send("User unbanned successfully");
                        })
                    }
                } catch (er) {
                    message.channel.send("There was an issue removing the suspension. Try again.")
                    ErrorLogger.log(er, bot)
                    continue;
                }
            }
        }
        if (!found) {
            message.channel.send(`This user was not vet banned by ${bot.user}. Would you still like to unban then? Y/N`)
            let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
            collector.on('collect', m => {
                try {
                    if (m.content.toLowerCase().charAt(0) == 'y') {
                        const vetBanRole = message.guild.roles.cache.find(r => r.name === settings.vetban);
                        const vetRaiderRole = message.guild.roles.cache.find(r => r.name === settings.vetraider);
                        member.roles.remove(vetBanRole)
                            .then(member.roles.add(vetRaiderRole));
                        message.channel.send("User unbanned successfully");
                    }
                } catch (er) {
                    ErrorLogger.log(er, bot)
                }
            });
        }
    }
}