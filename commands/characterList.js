const realmEyeScrape = require('../lib/realmEyeScrape')
const Discord = require('discord.js')

module.exports = {
    name: 'characterlist',
    args: '<ign>',
    alias: ['cl'],
    description: 'Gives character information for a user',
    role: 'almostrl',
    dms: true,
    async execute(message, args, bot) {
        const ign = args[0]
        if (!ign || ign.replace(/[^a-zA-Z]/g, '') !== ign || ign.length > 10) return message.channel.send('Username invalid')
        const embed = await this.getEmbed(ign, bot).catch(er => { message.channel.send('User is either not found, or their profile is private') })
        if (!embed) return
        message.channel.send({ embeds: [embed] })
    },
    async dmExecution(message, args, bot) {
        const ign = args[0]
        if (!ign || ign.replace(/[^a-zA-Z]/g, '') !== ign || ign.length > 10) return message.channel.send('Username invalid')
        const embed = await this.getEmbed(ign, bot).catch(er => { message.channel.send('User is either not found, or their profile is private') })
        if (!embed) return
        message.channel.send({ embeds: [embed] })
    },
    async getEmbed(ign, bot) {
        const charInfo = await realmEyeScrape.getUserInfo(ign)
        if (!charInfo) throw new Error('error')
        const embed = new Discord.EmbedBuilder()
            .setColor('#0000ff')
            .setTitle(`Character List for ${ign}`)
        for (const current of charInfo.characters) {
            const characterEmote = bot.emojis.cache.find(e => e.name == current.class)
            let weaponEmoji, abilityEmoji, armorEmoji, ringEmoji
            if (current.weapon) weaponEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.weapon.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
            else weaponEmoji = 'None'
            if (current.ability) abilityEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.ability.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
            else abilityEmoji = 'None'
            if (current.armor) armorEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.armor.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
            else armorEmoji = 'None'
            if (current.ring) ringEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.ring.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
            else ringEmoji = 'None'
            embed.addFields({ name: current.class, value: `${characterEmote} | LVL: \`${current.level}\` | Fame: \`${current.fame}\` | Stats: \`${current.stats}\` | ${weaponEmoji} ${abilityEmoji} ${armorEmoji} ${ringEmoji}` })
        }
        return embed
    }
}
