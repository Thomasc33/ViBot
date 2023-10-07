const patreonInfo = require('../data/PatreonInfo.json')
const Discord = require('discord.js')

let ControlServer

/**
 *
 * @param {Discord.User} user
 * @param {Discord.Client} bot
 * @param {*} db
 */
async function getTier(user, bot, db) {
    // control server
    if (!ControlServer) ControlServer = bot.guilds.cache.get(patreonInfo.guild)
    if (!ControlServer) return -1

    // member
    const member = ControlServer.members.cache.get(user.id)
    if (!member) return -1

    if (member.roles.cache.has(patreonInfo.simp)) return 3
    if (member.roles.cache.has(patreonInfo.tierThree)) return 0
    if (member.roles.cache.has(patreonInfo.tierTwo)) return 1
    if (member.roles.cache.has(patreonInfo.tierOne)) return 2
}

module.exports = {
    getTier
}
