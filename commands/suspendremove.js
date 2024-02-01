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
        db.query(`SELECT * FROM suspensions WHERE id = ? AND suspended = 0`, member.user.id, async function (err, rows) {
            if (err) ErrorLogger.log(err, bot, message.guild)
            for (let i in rows) { rows[i].index = parseInt(i) }
            //Performs a check to see if the raider is currently suspended, if they are, you will not be allowed to continue and the raider stays suspended
            if (rows.length == 0) return message.channel.send('There are no expired suspensions found for the user. Please unsuspend them and try again.')
            let embed = new Discord.EmbedBuilder()
                .setTitle(`Confirm Action`)
                .setColor('#F04747')
                .setDescription(rows.map(sus => `${sus.index + 1}. By <@!${sus.modid}> was set to end <t:${(parseInt(sus.uTime)/1000).toFixed(0)}:R> at <t:${(parseInt(sus.uTime)/1000).toFixed(0)}:f>\`\`\`${sus.reason}\`\`\``).join('\n'))
            let confirmMessage = await message.channel.send({ embeds: [embed] })
            let choice
            try {
                 choice = await confirmMessage.confirmNumber(rows.length, message.member.id);
                } catch (e) {
                    await confirmMessage.delete()
                    return await message.reply("Your request has timed out.")
                }
            
            if (!choice || isNaN(choice) || choice == 'Cancelled') return await confirmMessage.delete();
            let removeSuspension = rows[choice - 1]
            await confirmMessage.delete()

            const responseEmbed = new Discord.EmbedBuilder()
                .setDescription(`__What's the reason for removing ${member.nickname}'s suspension?__`)
            const responseEmbedMessage = await message.channel.send({ embeds: [responseEmbed] })
            const responseCollector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id })
            const responsePromise = await new Promise(async (resolve) => {
                responseCollector.on('collect', async function (mes) {
                    response = mes.content.trim()
                    await mes.delete()
                    responseCollector.stop()
                    responseEmbed.setDescription(`__Are you sure you want to remove the following suspension?__\n${removeSuspension.reason}`)
                    await responseEmbedMessage.edit({ embeds: [responseEmbed] }).then(async confirmMessage => {
                        if (await confirmMessage.confirmButton(message.author.id)) {
                            await responseEmbedMessage.delete()
                            resolve(response);
                        }
                    })
                    await responseEmbedMessage.delete()
                    resolve(null);
                })
            })
            if (!responsePromise) return
            await db.promise().query('DELETE FROM suspensions WHERE id = ? AND modid = ? AND uTime = ?', [removeSuspension.id, removeSuspension.modid, removeSuspension.uTime])
            await message.react('✅')

            const removeembed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Suspend Remove Information')
                .setDescription(`The following suspension was removed from \`\`${member.nickname}\`\` | <@!${member.id}>  and was set to end <t:${(parseInt(removeSuspension.uTime) / 1000).toFixed(0)}:R> \n\`\`\`${removeSuspension.reason}\`\`\``)
                .addFields([{ name: `Removed by`, value:`\`${message.guild.members.cache.get(message.author.id).nickname}\` | ${message.guild.members.cache.get(message.author.id)}`, inline: true },
                { name: `Original suspension issued by`, value: ` \`${message.guild.members.cache.get(removeSuspension.modid).nickname}\` | <@${removeSuspension.modid}>`, inline: true },
                { name: `Reason for removal`, value: responsePromise, inline: false }])
            const modlogs = message.guild.channels.cache.get(settings.channels.modlogs);
            await modlogs.send({ embeds: [removeembed] });
        })
    }
}