const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')

module.exports = {
    name: 'warnremove',
    alias: ['removewarn'],
    description: 'Removes warn from user',
    args: '<user>',
    requiredArgs: 1,
    role: 'security',
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const member = message.guild.findMember(args[0])
        if (!member) return message.channel.send('Member not found. Please try again')
        db.query(`SELECT * FROM warns WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot, message.guild)
            for (const i in rows) { const index = parseInt(i); rows[i].index = index }
            const embed = new Discord.EmbedBuilder()
                .setColor('#F04747')
                .setTitle('Confirm Action')
                .setDescription(rows.map(warning => `${warning.index + 1}. By <@!${warning.modid}> <t:${(parseInt(warning.time) / 1000).toFixed(0)}:R> at <t:${(parseInt(warning.time) / 1000).toFixed(0)}:f>\`\`\`${warning.reason}\`\`\``).join('\n'))
            const confirmMessage = await message.channel.send({ embeds: [embed] })
            const choice = await confirmMessage.confirmNumber(rows.length, message.member.id)
            if (!choice || isNaN(choice) || choice == 'Cancelled') return await confirmMessage.delete()
            const removeWarning = rows[choice - 1]
            await confirmMessage.delete()

            let response = ''
            const responseEmbed = new Discord.EmbedBuilder()
                .setDescription(`__What's the reason for removing ${member.nickname}'s warning?__`)
            const responseEmbedMessage = await message.channel.send({ embeds: [responseEmbed] })
            const responseCollector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id })
            const responsePromise = await new Promise(async (resolve) => {
                responseCollector.on('collect', async (mes) => {
                    response = mes.content.trim()
                    await mes.delete()
                    responseCollector.stop()
                    responseEmbed.setDescription(`__Are you sure you want to remove the following warning?__\n${removeWarning.reason}`)
                    await responseEmbedMessage.edit({ embeds: [responseEmbed] }).then(async confirmMessage => {
                        if (await confirmMessage.confirmButton(message.author.id)) {
                            await responseEmbedMessage.delete()
                            resolve(true)
                        }
                    })
                    await responseEmbedMessage.delete()
                    resolve(false)
                })
            })
            if (!responsePromise) return
            db.query(`DELETE FROM warns WHERE warn_id = ${removeWarning.warn_id} AND modid = '${removeWarning.modid}'`)
            await message.react('✅')

            const modlogs = message.guild.channels.cache.get(settings.channels.modlogs)
            const removeembed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Warn Remove Information')
                .setDescription(`The warning removed from \`\`${member.nickname}\`\` | <@!${member.id}>  was issued <t:${(parseInt(removeWarning.time) / 1000).toFixed(0)}:R> \n\`\`\`${removeWarning.reason}\`\`\``)
                .addFields([{ name: 'Removed by', value: `\`${message.guild.members.cache.get(message.author.id).nickname}\` | ${message.guild.members.cache.get(message.author.id)}`, inline: true },
                    { name: 'Original warning issued by', value: ` \`${message.guild.members.cache.get(removeWarning.modid).nickname}\` | <@${removeWarning.modid}>`, inline: true },
                    { name: 'Reason for removal', value: response, inline: false }])
            modlogs.send({ embeds: [removeembed] })
        })
    }
}
