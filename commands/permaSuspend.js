const Discord = require('discord.js')

module.exports = {
    name: 'permasuspend',
    description: 'Permanently suspends a user',
    args: '<user> <reason>',
    requiredArgs: 1,
    alias: ['psuspend'],
    role: 'security',
    async execute(message, args, bot, db) {
        let member = message.guild.findMember(args.shift())
        if (!member) member = message.guild.members.cache.filter(user => user.nickname).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()))
        if (!member) return message.channel.send('User not found')

        const settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const pSuspendRole = message.guild.roles.cache.get(settings.roles.permasuspended)

        const reason = args.join(' ') || 'None'

        if (member.roles.highest.position >= message.member.roles.highest.position) return message.channel.send(`${member} has a role greater than or equal to you and cannot be perma-suspended.`)
        if (member.roles.cache.has(pSuspendRole.id)) return message.channel.send('User is perma suspended already, no need to suspend again')
        if (member.roles.cache.has(suspendedRole.id)) {
            db.query(`SELECT * FROM suspensions WHERE id = '${member.id}' AND suspended = true`, async (err, rows) => {
                if (rows.length == 0) return message.channel.send('Suspension was not made through ViBot. Please attempt to overwrite the suspension through another bot')

                message.channel.send(`${member.nickname} is already suspended. Reply __**Y**__es to overwrite`)
                const collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id, time: 10000 })
                collector.on('collect', message => {
                    if (message.content.charAt(0) == 'y') {
                        db.query(`UPDATE suspensions SET suspended = 0, perma = true WHERE id = '${member.id}'`)
                        message.channel.send('Overwriting suspension...')
                        suspend(true)
                        collector.stop()
                    } else if (message.content.charAt(0) == 'n') {
                        collector.stop()
                    } else {
                        message.channel.send('Response not recognized. Please try suspending again')
                        collector.stop()
                    }
                })
            })
        } else {
            suspend(false)
        }
        async function suspend(overwrite) {
            const embed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Suspension Information')
                .setDescription('The suspension is permanent')
                .addFields([{ name: `User Information \`${member.nickname}\``, value: `<@!${member.id}> (Tag: ${member.user.tag})`, inline: true }])
                .addFields([{ name: `Mod Information \`${message.guild.members.cache.get(message.author.id).nickname}\``, value: `<@!${message.author.id}> (Tag: ${message.author.tag})`, inline: true }])
                .addFields([{ name: 'Reason:', value: reason }])
                .addFields([{ name: 'Roles', value: 'None!' }])
                .setTimestamp(Date.now())
            const userRoles = []
            member.roles.cache.each(r => {
                if (!(r.managed || settings.lists.discordRoles.map(role => settings.roles[role]).includes(r.id))) {
                    userRoles.push(r.id)
                }
                if (embed.data.fields[3].value == 'None!') {
                    embed.data.fields[3].value = `<@&${r.id}>`
                } else {
                    embed.data.fields[3].value += `, <@&${r.id}>`
                }
            })

            await member.roles.remove(userRoles)
            setTimeout(() => { member.roles.add(pSuspendRole.id) }, 1000)
            if (overwrite) db.query(`UPDATE suspensions SET perma = true, uTime = '0', modid = '${message.member.id}' WHERE id = '${member.id}' AND suspended = true`)
            else db.query(`INSERT INTO suspensions (id, guildid, suspended, uTime, reason, modid, roles, logmessage, perma) VALUES ('${member.id}', '${message.guild.id}', true, '0', ${db.escape(reason)}, '${message.author.id}', '${userRoles.join(' ')}', 'n/a', true);`)
            message.channel.send(`${member} has been permanently suspended`)
            message.guild.channels.cache.get(settings.channels.suspendlog).send({ embeds: [embed] })
        }
    }
}
