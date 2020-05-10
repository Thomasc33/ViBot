const fs = module.require('fs')

module.exports = {
    name: 'vetunban',
    description: 'Removes the banned veteran raider role manually',
    args: '<user in game name> (reason)',
    role: 'Veteran Raid Leader',
    execute(message, args, bot) {
        if (!message.channel.name === 'veteran-bot-commands') {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === "Veteran Raid Leader").position) return;
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
                const reason = bot.vetBans[i].reason;
                const banBy = bot.vetBans[i].by;
                const proofLogID = bot.vetBans[i].logMessage;
                const guild = bot.guilds.cache.get(guildId);
                const member = guild.members.cache.get(i);
                const vetBanRole = guild.roles.cache.find(r => r.name === 'Banned Veteran Raider');
                const vetRaiderRole = guild.roles.cache.find(r => r.name === 'Veteran Raider');
                try {
                    member.roles.remove(vetBanRole)
                        .then(member.roles.add(vetRaiderRole));
                    delete bot.vetBans[i];
                    fs.writeFile('./vetBans.json', JSON.stringify(bot.vetBans, null, 7), function (err) {
                        if (err) throw err;

                        let embed = bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.cache.get(proofLogID).embeds.shift();
                        embed.setColor('#00ff00')
                            .setDescription(embed.description.concat(`\nUnsuspended manually by <@!${message.author.id}>`))
                            .setFooter('Unsuspended at')
                            .setTimestamp(Date.now())
                            .addField('Reason for unsuspension', reason)
                        bot.guilds.cache.get(guildId).channels.cache.find(c => c.name === 'suspend-log').messages.cache.get(proofLogID).edit(embed);

                        message.channel.send("User unbanned successfully");
                    })

                } catch (er) {
                    message.channel.send("There was an issue removing the suspension. Try again.")
                    console.log("Error removing a vet suspension. See below")
                    console.log(er);
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
                        member.roles.remove(vetBanRole)
                            .then(member.roles.add(vetRaiderRole));
                        message.channel.send("User unbanned successfully");
                    }
                } catch (er) {
                    console.log(er)
                }
            });
        }
    }
}