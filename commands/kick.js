const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'kick',
    description: 'Kicks user from server and logs it',
    args: '<id/mention> <reason>',
    role: 'Security',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length == 0) return;
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.eventrl).position) {
            return message.channel.send(`You may not kick other staff members (eo+)`);
        }
        var reason = ' ';
        for (i = 1; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' ';
        }
        message.channel.send(`Are you sure you want to kick ${member.displayName}? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', async m => {
            if (m.author != message.author) return;
            try {
                if (m.content.toLowerCase().charAt(0) == 'y') {
                    await message.channel.send(`Kicking now`);
                    await member.send(`You have been kicked from ${message.guild.name} for:\n${reason}`)
                    await member.kick(reason).catch(er => { ErrorLogger.log(er, bot); message.channel.send(`Could not kick because: \`${er.message}\``); return; })
                    let embed = new Discord.MessageEmbed()
                        .setTitle('User Kicked')
                        .setDescription(member)
                        .addField('User', member.displayName, true)
                        .addField('Kicked By', `<@!${m.author.id}>`, true)
                        .setTimestamp(Date.now());
                    await message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
                    if (proof != ' ') {
                        await message.guild.channels.cache.get(settings.channels.modlogs).send(proof);
                    }
                    await message.react("✅")
                }
            } catch (er) {
                message.channel.send("Error kicking user. Please try again")
                return;
            }
        })
    }
}
