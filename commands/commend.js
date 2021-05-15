const Discord = require('discord.js')
const commendations = require('../data/commends.json')
module.exports = {
    name: 'commend',
    role: 'rl',
    args: '<user> <role *see below*>',
    getNotes(guildid, member) {
        return commendations ? `Role List: ${commendations[guildid].map(r => { r.roleName }).join(', ')}` : 'no roles found for this guild'
    },
    requiredArgs: 2,
    description: 'Gives user a role',
    /**
     * 
     * @param {Discord.Message} message 
     * @param {Array} args 
     * @param {Discord.Client} bot 
     * @param {*} db 
     * @returns 
     */
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let commendationInfo = commendations[message.guild.id]
        if (!commendationInfo) return message.channel.send('Commendations not setup for this server')

        //check args length
        if (args.length < 2) return

        //args 0
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')

        //args 1
        let type = args[1].charAt(0).toLowerCase()

        //give role and log
        let found = false
        for (let i of commendationInfo) {
            if (i.roleName == type.toLowerCase()) {
                found = true
                if (i.minimumRole) {
                    let minRole = message.guild.roles.cache.get(settings.roles[i.minimumRole])
                    if (minRole && message.member.roles.highest.position < minRole.position) return message.channel.send(`The minimum role to commend this role is \`${minRole.name}\``)
                }
                let role = message.guild.roles.cache.get(settings.roles[i.roleSetupName])
                if (!role) return message.channels.send(`\`${i.roleSetupName}\` not found in setup`)
                if (member.roles.cache.has(role.id)) return message.channel.send(`${member} already has \`${role.name}\``)
                let modlog = message.guild.channels.cache.get(settings.channels.modlogs)
                if (modlog) await modlog.send(`\`${role.name}\` added to ${member} per the request of ${message.member}`)
                member.roles.add(role.id)
                if (i.dbName) db.query(`UPDATE users SET ${i.dbName} = true WHERE id = '${member.id}'`)
            }
        }

        //give confirmation
        message.react('✅')
    }
}