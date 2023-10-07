const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'list',
    description: 'Displays a list of all users with the specified role.',
    role: 'security',
    args: '<role name/ID>',
    requiredArgs: 1,
    alias: ['roleinfo', 'ri'],
    /**
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     */
    async execute(message, args, bot) {
        const roles = args.join(' ').toLowerCase().split('|')
        for (const i in roles) { roles[i] = roles[i].trim() }
        if (roles.length == 1) { module.exports.normalList(message, args, bot, roles[0]) } else module.exports.combinedList(message, args, bot, roles)
    },
    async normalList(message, args, bot, role) {
        // Search for role in guild
        const guildRole = message.guild.findRole(role)
        if (!guildRole) return message.channel.send(`No role found for: \`${role}\``)
        const memberList = message.guild.roles.cache.get(guildRole.id).members.map(member => member)
        const d = { highest: message.guild.findUsersWithRoleAsHighest(guildRole.id), higher: message.guild.findUsersWithRoleNotAsHighest(guildRole.id) }
        // List of users where given role is highest position
        let highestString = ''
        for (const member of d.highest) {
            if (highestString.length < 950) highestString += `${member} `
            else {
                highestString += 'and ' + (d.highest.length - d.highest.indexOf(member)) + ' others...'
                break
            }
        }
        // List of users with a higher position role
        let higherString = ''
        for (const member of d.higher) {
            if (higherString.length < 950) higherString += `${member} `
            else {
                higherString += 'and ' + (d.higher.length - d.higher.indexOf(member)) + ' others...'
                break
            }
        }
        const roleCheckEmbed = new Discord.EmbedBuilder()
            .setColor(guildRole.hexColor)
            .setTitle(`Role Info for ${guildRole.name}`)
            .setDescription(`**Role:** ${guildRole} | **Role Color:** \`${guildRole.hexColor}\``)
            .setFooter({ text: `There are ${memberList.length} members in the ${guildRole.name} role` })
            .setTimestamp()
            .addFields(
                { name: `${d.higher.length} members with a higher role than \`${guildRole.name}\``, value: d.higher.length > 0 ? higherString : 'None' },
                { name: `${d.highest.length} members with \`${guildRole.name}\` as their highest role`, value: d.highest.length > 0 ? highestString : 'None' }
            )
        message.channel.send({ embeds: [roleCheckEmbed] }).catch(err => ErrorLogger.log(err, bot, message.guild))
    },
    async combinedList(message, args, bot, roles) {
        roles = roles.map(role => message.guild.findRole(role))
        const roleObjects = {}
        for (const i in roles) {
            roleObjects[roles[i]] = message.guild.findUsersWithRole(roles[i].id).map(member => member.id)
        }
        const memberList = Object.values(roleObjects).reduce((acc, array) => acc.filter(id => array.includes(id)))
        let memberString = ''
        for (const member of memberList) {
            if (memberString.length < 950) memberString += `<@!${member}> `
            else {
                memberString += 'and ' + (memberList.length - memberList.indexOf(member)) + ' others...'
                break
            }
        }
        const embed = new Discord.EmbedBuilder()
            .setTitle('Combined List')
            .setDescription(`**Roles: ${roles.map(role => role).join(' | ')}**`)
            .setColor(roles[0].hexColor)
        embed.addFields({
            name: 'These users have all of the roles combined',
            value: memberString
        })
        embed.setFooter({ text: `There are ${memberList.length} users who have all of the roles combined` })
        await message.channel.send({ embeds: [embed] })
    }
}
