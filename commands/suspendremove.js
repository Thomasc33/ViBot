const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const moment = require('moment');

module.exports = {
    name: 'suspendremove',
    alias: ['removesuspend'],
    description: 'Removes a suspension from a given user',
    args: '<user>',
    requiredArgs: 1,
    role: 'officer',
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const member = message.guild.findMember(args[0])
        if (!member) return message.channel.send('Member not found. Please try again')
        db.query(`SELECT * FROM suspensions WHERE id = ? AND suspended = 0`, [member.id], async function (err, rows) {
            if (err) ErrorLogger.log(err, bot, message.guild)
            for (let i in rows) { rows[i].index = parseInt(i) }
            if (rows.length == 0) return message.channel.send('There are no expired suspensions found for the user. Please unsuspend them and try again.')
            let embed = new Discord.EmbedBuilder()
                .setTitle(`Confirm Action`)
                .setColor('#F04747')
                .setDescription(rows.map(sus => `${sus.index + 1}. By <@!${sus.modid}> was set to end <t:${(parseInt(sus.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(sus.uTime)/1000).toFixed(0)}:f>\`\`\`${sus.reason}\`\`\``).join('\n'))
            let confirmMessage = await message.channel.send({ embeds: [embed] })
            const choice = await confirmMessage.confirmNumber(rows.length, message.member.id);
            if (!choice || isNaN(choice) || choice == 'Cancelled') return await confirmMessage.delete();
            let removeSuspension = rows[choice - 1]
            await confirmMessage.delete()

            let response = ''
            let responseEmbed = new Discord.EmbedBuilder()
                .setDescription(`__What's the reason for removing ${member.nickname}'s suspension?__`)
                .addFields(
                    { name: 'Mod', value: `<@${removeSuspension.modid}>`, inline: true },
                    { name: 'When', value: removeSuspension.unixTimestamp ? `<t:${Math.floor(removeSuspension.unixTimestamp/1000)}:t>` : 'Unknown', inline: true },
                    { name: 'Ends', value: `<t:${Math.floor(removeSuspension.uTime/1000)}:f>`, inline: true },
                    { name: 'Suspension Reason', value: removeSuspension.reason || 'No Reason' }
                )
            let responseEmbedMessage = await message.channel.send({ embeds: [responseEmbed] })
            let responseCollector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id })
            let responsePromise = await new Promise(async (resolve) => {
                responseCollector.on('collect', async function (mes) {
                    response = mes.content.trim()
                    await mes.delete()
                    responseEmbed.addFields({ name: 'Removal Reason', value: response || 'No Reason Provided' })
                    responseCollector.stop()
                    responseEmbed.setDescription(`__Are you sure you want to remove the following suspension?__\n${removeSuspension.reason}`)
                    await responseEmbedMessage.edit({ embeds: [responseEmbed] }).then(async confirmMessage => {
                        if (await confirmMessage.confirmButton(message.author.id)) {
                            await responseEmbedMessage.delete()
                            resolve(true);
                        }
                    })
                    await responseEmbedMessage.delete()
                    resolve(false);
                })
            })
            if (!responsePromise) return
            db.query('DELETE FROM suspensions WHERE id = ? AND modid = ? AND uTime = ?', [removeSuspension.id, removeSuspension.modid, removeSuspension.uTime])
            await message.react('✅')

            const modlogs = message.guild.channels.cache.get(settings.channels.modlogs);
            let removeembed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Suspend Remove Information')
                .setDescription(`The following suspension was removed from \`\`${member.nickname}\`\` | <@!${member.id}>  and was set to end <t:${(parseInt(removeSuspension.uTime) / 1000).toFixed(0)}:R> \n\`\`\`${removeSuspension.reason}\`\`\``)
                .addFields([{ name: `Removed by`, value:`\`${message.guild.members.cache.get(message.author.id).nickname}\` | ${message.guild.members.cache.get(message.author.id)}`, inline: true },
                { name: `Original suspension issued by`, value: ` \`${message.guild.members.cache.get(removeSuspension.modid).nickname}\` | <@${removeSuspension.modid}>`, inline: true },
                { name: `Reason for removal`, value: response, inline: false }])
            modlogs.send({ embeds: [removeembed] });
        })
    }
}