const Discord = require('discord.js')
const Suspend = require('./suspend')

module.exports = {
    name: 'seppuku',
    role: 'eventrl',
    description: '死ぬ',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let suspendedRole = settings.roles.tempsuspended
        message.channel.send(`死ぬ!`)
        let time = 300000 // 5 min
        let reason = 'seppuku'
        let userRolesString = '', userRoles = []
        message.member.roles.cache.each(r => {
            if (!r.managed) return
            if (settings.lists.discordRoles.map(role => settings.roles[role]).includes(r.id)) return
            userRoles.push(r.id)
            userRolesString = userRolesString.concat(`${r.id} `)
        })
        await message.member.roles.remove(userRoles)
        setTimeout(() => { message.member.roles.add(suspendedRole); }, 1000)
        db.query(`INSERT INTO suspensions (id, guildid, suspended, uTime, reason, modid, roles, logmessage) VALUES ('${message.member.id}', '${message.guild.id}', true, '${Date.now() + time}', ${db.escape(reason)}, '${message.author.id}', '${userRolesString}', '${message.id}');`)
    }
}
