const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'vetunban',
    description: 'Removes the banned veteran raider role manually',
    args: '<user in game name> (reason)',
    requiredArgs: 1,
    role: 'veteventrl',
    execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const raider = args.shift()
        let reason = ''
        for (let i = 0; i < args.length; i++) {
            reason = reason.concat(args[i]) + ' '
        }
        const member = message.guild.members.cache.filter(user => user.nickname !== null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(raider.toLowerCase()))
        if (!member) return message.channel.send('User not found, please try again')
        if (!member.roles.cache.has(settings.roles.vetban)) return message.channel.send(`${member} is not vetbanned`)
        db.query('SELECT * FROM vetbans WHERE id = ? AND suspended = true', [member.id], async (err, rows) => {
            if (err) { ErrorLogger.log(err, bot, message.guild) }
            // eslint-disable-next-line no-negated-condition
            if (rows.length != 0) {
                const proofLogID = rows[0].logmessage
                member.roles.remove(settings.roles.vetban)
                    .then(member.roles.add(settings.roles.vetraider))
                if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) await member.roles.remove(settings.roles.unverified)
                db.query('UPDATE vetbans SET suspended = false WHERE id = ?', [member.id])
                const logMessage = await message.guild.channels.cache.get(settings.channels.suspendlog).messages.fetch(proofLogID)
                if (logMessage) {
                    const embed = logMessage.embeds.shift()
                    embed.setColor('#00ff00')
                        .setDescription(embed.data.description.concat('\nUn-vet-banned automatically'))
                        .setFooter({ text: 'Unsuspended at' })
                        .setTimestamp(Date.now())
                    logMessage.edit({ embeds: [embed] })
                } else {
                    message.guild.channels.cache.get(settings.channels.suspendlog).send(`<@!${rows[0].id}> has been un-vet-banned automatically`)
                }
                message.channel.send('User unbanned successfully')
            } else {
                message.channel.send(`This user was not vet banned by ${bot.user}. Would you still like to unban then? Y/N`)
                const collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id, time: 10000 })
                collector.on('collect', m => {
                    collector.stop()
                    try {
                        if (m.content.toLowerCase().charAt(0) == 'y') {
                            member.roles.remove(settings.roles.vetban)
                                .then(member.roles.add(settings.roles.vetraider))
                            if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) member.roles.remove(settings.roles.unverified)
                            message.channel.send('User unbanned successfully')
                        }
                    } catch (er) {
                        ErrorLogger.log(er, bot, message.guild)
                    }
                })
            }
        })
    }
}
