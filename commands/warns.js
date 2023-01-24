const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')

module.exports = {
    name: 'warns',
    description: 'Displays all warns for all inputted users',
    role: 'eventrl',
    requiredArgs: 1,
    args: '[Users]',
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const securityRole = message.guild.roles.cache.get(settings.roles.security)
        var usersNotFound = []
        for (let i in args) {
            let user = args[i]
            let member = message.guild.findMember(user)
            if (!member) { usersNotFound.push(user); continue; }

            let embed = new Discord.EmbedBuilder()
                .setColor('#F04747')
                .setTitle(`Warnings for ${member.nickname}`)
                .setFooter({ text: member.user.id })
            let partneredServer = bot.fetchPartneredServer(message.guild.id)
            db.query(`SELECT * FROM warns WHERE id = '${member.user.id}'`, async function (err, rows) {
                if (err) ErrorLogger.log(err, bot, message.guild)
                for (let i in rows) { let index = parseInt(i); rows[i].index = index}
                let warningsServer = []
                let warningsPartnered = []
                let warningsNull = []
                for (let i in rows) {
                    let row = rows[i]
                    if (row.guildid == message.guild.id) warningsServer.push(row)
                    else if (row.guildid == partneredServer.id) warningsPartnered.push(row)
                    else if (row.guildid == null) warningsNull.push(row)
                }
                if (warningsServer.length > 0) {
                    for (let i in warningsServer) { let index = parseInt(i); warningsServer[i].index = index}
                    embed.addFields({ name: `${message.guild.name}'s Section`, value: warningsServer.map(warning => `${warning.index+1}. By <@!${warning.modid}> ${moment().to(new Date(parseInt(warning.time)))}\`\`\`${warning.reason}\`\`\``).join('\n'), inline: false })
                }
                if (message.member.roles.highest.position >= securityRole.position || bot.adminUsers.includes(message.member.id)) {
                    if (warningsPartnered.length > 0) {
                        for (let i in warningsPartnered) { let index = parseInt(i); warningsPartnered[i].index = index}
                        embed.addFields({ name: `${partneredServer.name}'s Section`, value: warningsPartnered.map(warning => `${warning.index+1}. By <@!${warning.modid}> ${moment().to(new Date(parseInt(warning.time)))}\`\`\`${warning.reason}\`\`\``).join('\n'), inline: false })
                    }
                    if (warningsNull.length > 0) {
                        for (let i in warningsNull) { let index = parseInt(i); warningsNull[i].index = index}
                        embed.addFields({ name: 'Unknown Server', value: warningsNull.map(warning => `${warning.index+1}. By <@!${warning.modid}> ${moment().to(new Date(parseInt(warning.time)))}\`\`\`${warning.reason}\`\`\``).join('\n'), inline: false })
                    }
                }
                if (!embed.data.fields || embed.data.fields.length == 0) {
                    embed.setDescription(`No warnings have been issued for ${member}`)
                }
                await message.channel.send({ embeds: [embed] })
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