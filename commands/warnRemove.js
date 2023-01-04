const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment');

module.exports = {
    name: 'warnremove',
    alias: ['removewarn'],
    description: 'Removes warn from user',
    args: '<user>',
    requiredArgs: 1,
    role: 'security',
    async execute(message, args, bot, db) {
        let member = message.guild.findMember(args[0])
        if (!member) return message.channel.send('Member not found. Please try again')
        db.query(`SELECT * FROM warns WHERE id = '${member.user.id}' AND guildid = '${message.guild.id}'`, async function (err, rows) {
            if (err) ErrorLogger.log(err, bot)
            for (let i in rows) { let index = parseInt(i); rows[i].index = index}
            let embed = new Discord.EmbedBuilder()
                .setColor('#F04747')
                .setTitle('Confirm Action')
                .setDescription(rows.map(warning => `${warning.index+1}. By <@!${warning.modid}> ${moment().to(new Date(parseInt(warning.time)))}\`\`\`${warning.reason}\`\`\``).join('\n'))
            let confirmMessage = await message.channel.send({ embeds: [embed] })
            const choice = await confirmMessage.confirmNumber(rows.length, message.member.id);
            if (!choice || isNaN(choice) || choice == 'Cancelled') return await confirmMessage.delete();
            let removeWarning = rows[choice - 1]
            db.query(`DELETE FROM warns WHERE warn_id = ${removeWarning.warn_id} AND modid = '${removeWarning.modid}'`)
            await confirmMessage.delete()
        })
    }
}