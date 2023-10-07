const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')

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
        db.query(`SELECT * FROM suspensions WHERE id = '${member.user.id}'`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot, message.guild)
            for (const i in rows) { if (rows[i].suspended == true) { rows.splice(i, 1) } }
            for (const i in rows) { rows[i].index = parseInt(i) }
            const embed = new Discord.EmbedBuilder()
                .setTitle('Confirm Action')
                .setColor('#F04747')
                .setDescription(rows.map(sus => `${sus.index + 1}. By <@!${sus.modid}> ended <t:${(parseInt(sus.uTime) / 1000).toFixed(0)}:R> at <t:${(parseInt(sus.uTime) / 1000).toFixed(0)}:f>\`\`\`${sus.reason}\`\`\``).join('\n'))
            const confirmMessage = await message.channel.send({ embeds: [embed] })
            const choice = await confirmMessage.confirmNumber(rows.length, message.member.id)
            if (!choice || isNaN(choice) || choice == 'Cancelled') return await confirmMessage.delete()
            const removeSuspension = rows[choice - 1]
            db.query(`DELETE FROM suspensions WHERE (id, guildid, suspended, reason, modid, uTime, botid) = ('${removeSuspension.id}', '${removeSuspension.guildid}', '${removeSuspension.suspended}', '${removeSuspension.reason}', '${removeSuspension.modid}', '${removeSuspension.uTime}', '${removeSuspension.botid}')`)
            await confirmMessage.delete()
        })
    }
}
