const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const fs = require('fs')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'mute',
    description: 'Gives user the muted role',
    args: '<member> <time> <time type s/m/h/d/w/y> <Reason>',
    role: 'security',
    varargs: true,
    requiredArgs: 4,
    args: [
        slashArg(SlashArgType.User, 'member', {
            description: "Member in the Server"
        }),
        slashArg(SlashArgType.Integer, 'time', {
            required: false,
            description: "Quantity of Time"
        }),
        slashArg(SlashArgType.String, 'timetype', {
            required: false,
            description: "Time Type[s/m/h/d/w/y]"
        }),
        slashArg(SlashArgType.String, 'reason', {
            required: false,
            description: "Reason for mute"
        }),
    ],
    getSlashCommandData(guild) {
        return slashCommandJSON(this, guild)
    },
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const memberSearch = args.shift();
        let member = message.guild.members.cache.get(memberSearch);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()));
        if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D/gi, ''))
        if (!member) { message.reply('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.member.roles.highest.position) return message.reply(`${member} has a role greater than or equal to you and cannot be muted`);
        let muted = settings.roles.muted
        if (member.roles.cache.has(muted)) return message.reply(`${member} is already muted`)
        if (args.length == 1) {
            await member.roles.add(muted).catch(er => ErrorLogger.log(er, bot, message.guild))
            await message.reply(`${member} has been muted indefinitely`)
            return;
        }
        let time = parseInt(args.shift())
        let timeType = args.shift()
        if (!timeType) return message.channel.send("Please enter a valid time type __**d**__ay, __**m**__inute, __**h**__our, __**s**__econd, __**w**__eek, __**y**__ear");
        let reason = args.join(' ');
        switch (timeType.charAt(0).toLowerCase()) {
            case 's': millisecondTime = time * 1000; timeDuration = 'second(s)'; break;
            case 'm': millisecondTime = time * 60000; timeDuration = 'minute(s)'; break;
            case 'h': millisecondTime = time * 3600000; timeDuration = 'hour(s)'; break;
            case 'd': millisecondTime = time * 86400000; timeDuration = 'day(s)'; break;
            case 'w': millisecondTime = time * 604800000; timeDuration = 'week(s)'; break;
            case 'y': millisecondTime = time * 31536000000; timeDuration = 'year(s)'; break;
            default: return message.channel.send("Please enter a valid time type __**s**__econd, __**m**__inute, __**h**__our, __**d**__ay, __**w**__eek, __**y**__ear");
        }
        async function muteProcess(overwrite) {
            const modlogs = message.guild.channels.cache.get(settings.channels.modlogs);
            let embed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Mute Information')
                .setDescription(`You have been muted in the ${message.guild.name} discord. The mute is for ${time} ${timeDuration} until <t:${(((Date.now() + millisecondTime) / 1000)).toFixed(0)}:f>`)
                .addFields([{name: `User Information \`${member.nickname}\``, value: `<@!${member.id}> `, inline: true}])
                .addFields([{name: `Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, value: `<@!${message.author.id}> `, inline: true}])
                .addFields([{name: `Reason:`, value: reason}])
                .setFooter({ text: `Unmuting at ` })
                .setTimestamp(Date.now() + millisecondTime);
                (member.user.send({ embeds: [embed] }).catch(() => {}));
            } 
        async function muteProcesslog(overwrite) {
            const modlogs = message.guild.channels.cache.get(settings.channels.modlogs);
            let embed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Mute Information')
                .setDescription(`The mute is for ${time} ${timeDuration} until <t:${(((Date.now() + millisecondTime) / 1000)).toFixed(0)}:f>`)
                .addFields([{name: `User Information \`${member.nickname}\``, value: `<@!${member.id}> `, inline: true}])
                .addFields([{name: `Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, value: `<@!${message.author.id}> `, inline: true}])
                .addFields([{name: `Reason:`, value: reason}])
                .setFooter({ text: `Unmuting at ` })
                .setTimestamp(Date.now() + millisecondTime);
            modlogs.send({ embeds: [embed] });
            }           
        db.query(`INSERT INTO mutes (id, guildid, muted, reason, modid, uTime) VALUES ('${member.id}', '${message.guild.id}', true, '${reason || 'None Provided'}','${message.author.id}', '${Date.now() + millisecondTime}')`, err => {
            member.roles.add(muted).catch(er => ErrorLogger.log(er, bot, message.guild))
            message.reply(`${member} has been muted`);
            muteProcess();
            muteProcesslog();
            
        })
    }
}
