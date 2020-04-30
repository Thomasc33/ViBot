const fs = module.require('fs');
const Discord = require('discord.js');

module.exports = {
    name: 'vetban',
    description: 'Gives user vet banned role',
    async execute(message, args, bot) {
        message.channel.send("Feature not implemented yet, try again later");
        return;
        console.log(args)
        const vetBanRole = message.guild.roles.cache.find(r => r.name === 'Banned Veteran Raider');
        const vetRaiderRole = message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        const suspensionLog = message.guild.channels.cache.find(c => c.name === 'suspend-log');
        if (!message.channel.name === 'veteran-bot-commands') {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        let vRaidLeaderRole = message.guild.roles.cache.find(r => r.name === "Veteran Raid Leader");
        let securityRole = message.guild.roles.cache.find(r => r.name === "Security");
        if (!(message.member.roles.cache.has(vRaidLeaderRole.id) || message.member.roles.cache.has(securityRole.id))) return;
        let toBan = [];

        for (i = 0; i < args.length; i++) {
            let arg = args[i];
            console.log(arg);
            console.log(parseInt(arg))
            if (parseInt(arg) > 0) {
                console.log(arg + "is number")
                break;
            } else {
                toBan.push(args.shift());
            }
        }

        console.log(toBan);
        console.log(args);
        let time = parseInt(args[0]);
        let timeType = args[1];

        switch (timeType.toLowerCase()) {
            case 'd':
                time *= 86400000;
                break;
            case 'm':
                time *= 60000;
                break;
            case 's':
                time *= 1000;
                break;
            case 'w':
                time *= 604800000;
                break;
            case 'y':
                time *= 31536000000;
                break;
            default:
                message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**s**__econd, __**w**__eek, __**y**__ear");
                return;
        }
        var reason = "";
        for (i = 2; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' ';
        }
        toBan.forEach(u => {

            let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z]/gi, '').toLowerCase() === u.toLowerCase());

            if (member == null) {
                message.channel.send(`${u} not found, please try again`);
                return;
            }
            console.log(member.nickname);

            bot.vetBans[member.id] = {
                guild: message.guild.id,
                time: Date.now() + time,
                reason: reason,
                by: message.author.id
            }

            fs.writeFile('../vetBans.json', JSON.stringify(bot.vetBans, null, 6), err => {
                if (err) throw err;

                let embed = new Discord.MessageEmbed()
                    .setColor('#ff0000')
                    .setTitle('Suspension Information')
                    .setDescription('test');
                suspensionLog.send(embed);

                message.channel.send(`${member.nickname} will be suspended`);
            })
        })
    }
}