const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const fs = require('fs')

module.exports = {
    name: 'mute',
    description: 'Gives user the muted role',
    args: '<member> <time> <time type> (Reason)',
    role: 'security',
    requiredArgs: 1,
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const memberSearch = args.shift();
        let member = message.guild.members.cache.get(memberSearch);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()));
        if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D/gi, ''))
        if (!member) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be muted`);
        let muted = settings.roles.muted
        if (member.roles.cache.has(muted)) return message.channel.send(`${member} is already muted`)
        if (args.length == 1) {
            await member.roles.add(muted).catch(er => ErrorLogger.log(er, bot, message.guild))
            await message.channel.send(`${member} has been muted indefinitely`)
            return;
        }
        let time = parseInt(args.shift())
        let timeType = args.shift()
        if (!timeType) return message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**h**__our, __**s**__econd, __**w**__eek, __**y**__ear");
        let reason = args.join(' ');
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
                return message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**h**__our, __**s**__econd, __**w**__eek, __**y**__ear");
        }
        db.query(`INSERT INTO mutes (id, guildid, muted, reason, modid, uTime) VALUES ('${member.id}', '${message.guild.id}', true, '${reason || 'None Provided'}','${message.author.id}', '${Date.now() + time}')`, err => {
            member.roles.add(muted).catch(er => ErrorLogger.log(er, bot, message.guild))
            message.channel.send(`${member} has been muted`)
            member.user.send(`You have been muted on \`${message.guild.name}\` by <@!${message.author.id}> \`${message.author.tag}\`${reason ? ': ' + reason : 'No reason provided'}.`);
        })
    }
}