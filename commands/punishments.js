const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const moment = require('moment');

module.exports = {
    role: 'security',
    name: 'punishments',
    args: '[users]',
    aliases: ['backgroundcheck'],
    requiredArgs: 1,
    description: 'Displays all mutes, warnings or suspensions any user has',
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        var usersNotFound = [];
        for (let i in args) {
            let user = args[i]
            let member = message.guild.findMember(user)
            if (!member) { usersNotFound.push(user); continue; }
            let embed = new Discord.EmbedBuilder()
                .setTitle(`Punishments for ${member.nickname}`)
                .setColor('#F04747')
            db.query(`SELECT * FROM warns WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async function (err, warnings) {
                if (err) ErrorLogger.log(err, bot)
                db.query(`SELECT * FROM suspensions WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async function (err, suspensions) {
                    if (err) ErrorLogger.log(err, bot)
                    db.query(`SELECT * FROM mutes WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async function (err, mutes) {
                        if (err) ErrorLogger.log(err, bot)
                        if (warnings.length > 0) {
                            for (let i in warnings) { let index = parseInt(i); warnings[i].index = index}
                            embed.addFields({ name: `Warnings`, value: warnings.map(warning => `${warning.index+1}. By <@!${warning.modid}> ${moment().to(new Date(parseInt(warning.time)))}\`\`\`${warning.reason}\`\`\``).join('\n'), inline: false })
                        }
                        if (suspensions.length > 0) {
                            for (let i in suspensions) { let index = parseInt(i); suspensions[i].index = index}
                            embed.addFields({ name: `Suspensions`, value: suspensions.map(warning => `${warning.index+1}. By <@!${warning.modid}> ${warning.suspended ? 'Ends in' : 'Ended'} ${moment().to(new Date(parseInt(warning.uTime)))}\`\`\`${warning.reason}\`\`\``).join('\n'), inline: false })
                        }
                        if (mutes.length > 0) {
                            for (let i in mutes) { let index = parseInt(i); mutes[i].index = index}
                            embed.addFields({ name: `Mutes`, value: mutes.map(warning => `${warning.index+1}. By <@!${warning.modid}> ${warning.muted ? 'Ends in' : 'Ended'} ${moment().to(new Date(parseInt(warning.uTime)))}\`\`\`${warning.reason}\`\`\``).join('\n'), inline: false })
                        }
                        if (!embed.data.fields || embed.data.fields.length == 0) {
                            embed.setDescription(`No punishments have been issued for ${member}`)
                        }
                        await message.channel.send({ embeds: [embed] })
                    })
                })
            })
        }
        if (usersNotFound.length > 0) {
            let embedNotFound = new Discord.EmbedBuilder()
                .setTitle('Users not found')
                .setColor('#fAA61A')
                .setDescription(usersNotFound.join(', '))
            await message.channel.send({ embeds: [embedNotFound] })
        }
    }
}