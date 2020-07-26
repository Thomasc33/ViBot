const Discord = require('discord.js')
const ErrorLogger = require('../logError')
const fs = require('fs')

module.exports = {
    name: 'mute',
    description: 'Gives user the muted role',
    args: '<member> <time> <time type> (Reason)',
    role: 'Security',
    notes: 'Timed feature coming soon:tm:',
    async execute(message, args, bot) {
        if (args.length == 0) return;
        let settings = bot.settings[message.guild.id]
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (member == null) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.member.roles.highest.position) {
            message.channel.send(`${member} has a role greater than or equal to you and cannot be muted`);
            return;
        }
        let muted = message.guild.roles.cache.get(settings.roles.muted)
        if (member.roles.cache.has(muted.id)) {
            message.channel.send(`${member} is already muted`)
            return;
        }
        if (args.length == 1) {
            await member.roles.add(muted.id).catch(er => ErrorLogger.log(er, bot))
            await message.channel.send(`${member} has been muted indefinitely`)
            return;
        }
        let time = parseInt(args[1])
        let timeType = args[2]
        let reason = ''
        for (let i = 3; i < args.length; i++) {
            reason += args[i]
        }
        if (reason == '') reason = 'None Provided'
        switch (timeType.charAt(0).toLowerCase()) {
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
            case 'h':
                time *= 3600000;
                break;
            default:
                message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**h**__our, __**s**__econd, __**w**__eek, __**y**__ear");
                return;
        }
        bot.mutes[member.id] = {
            guild: message.guild.id,
            reason: reason,
            modid: message.author.id,
            time: Date.now() + time
        }
        fs.writeFile('./mutes.json', JSON.stringify(bot.mutes, null, 4), async err => {
            if (err) ErrorLogger.log(err, bot)
            await member.roles.add(muted.id).catch(er => ErrorLogger.log(er, bot))
            await message.channel.send(`${member} has been muted`)
        })
    }
}