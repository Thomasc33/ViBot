const Discord = require('discord.js')
const ErrorLogger = require('../logError')
const fs = require('fs')

module.exports = {
    name: 'mute',
    description: 'Gives user the muted role',
    args: '<member> <time> <time type> (Reason)',
    role: 'security',
    requiredArgs: 1,
    notes: 'Timed feature here:tm:',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) member = message.guild.members.cache.get(u.replace(/[<>@!]/gi, ''))
        if (!member) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be muted`);
        let muted = settings.roles.muted
        if (member.roles.cache.has(muted)) return message.channel.send(`${member} is already muted`)
        if (args.length == 1) {
            await member.roles.add(muted).catch(er => ErrorLogger.log(er, bot))
            await message.channel.send(`${member} has been muted indefinitely`)
            return;
        }
        let time = parseInt(args[1])
        let timeType = args[2]
        let reason = ''
        for (let i = 3; i < args.length; i++) { reason += args[i] }
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
        db.query(`INSERT INTO mutes (id, guildid, muted, reason, modid, uTime) VALUES ('${member.id}', '${message.guild.id}', true, '${reason}','${message.author.id}', '${Date.now() + time}')`, err => {
            member.roles.add(muted).catch(er => ErrorLogger.log(er, bot))
            message.channel.send(`${member} has been muted`)
            member.user.send(`You have been muted on \`${message.guild.name}\` by <@!${message.author.id}> \`${message.author.tag}\``)
        })
    }
}