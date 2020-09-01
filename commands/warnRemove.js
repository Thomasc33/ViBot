const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'warnremove',
    alias: ['removewarn'],
    description: 'Removes warn from user',
    args: '<user> <warn number>',
    requiredArgs: 1,
    role: 'security',
    async execute(message, args, bot, db) {
        if (args.length < 2) message.channel.send('Command Entered incorrectly. Please try again')
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('Member not found. Please try again')
        let toRemove = parseInt(args[1])
        db.query(`SELECT * FROM warns WHERE id = '${member.user.id}'`, async function (err, rows) {
            if (err) ErrorLogger.log(err, bot)
            let warn = rows[toRemove - 1]
            if (!warn) return message.channel.send(`Warn number ${toRemove} was not found. Please try again`)
            let confirmEmbed = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setTitle('Please Confirm')
                .setDescription(`__Warn for user:__ ${member} (${member.nickname})\n__Reason:__${warn.reason}\n__Warn by:__ <@!${warn.modid}>`)
            let confirmMessage = await message.channel.send(confirmEmbed)
            let confirmReactionCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
            await confirmMessage.react('✅')
            await confirmMessage.react('❌')
            confirmReactionCollector.on('collect', async function (r, u) {
                await confirmMessage.reactions.removeAll()
                if (r.emoji.name === '✅') {
                    db.query(`DELETE FROM warns WHERE reason = '${warn.reason}' AND modid = '${warn.modid}'`)
                    confirmReactionCollector.stop()
                    confirmEmbed.setTitle('Warn Removed')
                    confirmMessage.edit(confirmEmbed)
                }
                else {
                    confirmReactionCollector.stop()
                    confirmMessage.delete()
                }
            })
        })
    }
}