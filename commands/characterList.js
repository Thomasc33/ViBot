const realmEyeScrape = require('../lib/realmEyeScrape')
const Discord = require('discord.js')

module.exports = {
    name: 'characterlist',
    args: '<ign>',
    alias: ['cl'],
    description: 'Gives character information for a user',
    role: 'almostrl',
    dms: true,
    async execute(message, args, bot, db) {
        let ign = args[0]
        if (!ign || ign.replace(/[^a-zA-Z]/g, '') !== ign || ign.length > 10) return message.channel.send('Username invalid')
        let embed = await this.getEmbed(ign, bot).catch(er => { message.channel.send(`User is either not found, or their profile is private`) })
        if (!embed) return;
        message.channel.send({ embeds: [embed] })
    },
    async dmExecution(message, args, bot, db, guild) {
        let ign = args[0]
        if (!ign || ign.replace(/[^a-zA-Z]/g, '') !== ign || ign.length > 10) return message.channel.send('Username invalid')
        let embed = await this.getEmbed(ign, bot).catch(er => { message.channel.send(`User is either not found, or their profile is private`) })
        if (!embed) return;
        message.channel.send({ embeds: [embed] })
    },
    async getEmbed(ign, bot) {
        return new Promise(async function (resolve, reject) {
            let charInfo = await realmEyeScrape.getUserInfo(ign)
                .catch(er => {
                    return reject(er)
                })
            if (!charInfo) return reject('error')
            let embed = new Discord.EmbedBuilder()
                .setColor('#0000ff')
                .setTitle(`Character List for ${ign}`)
            for (let i in charInfo.characters) {
                let current = charInfo.characters[i]
                let characterEmote = bot.emojis.cache.find(e => e.name == current.class)
                let weaponEmoji, abilityEmoji, armorEmoji, ringEmoji
                if (!current.weapon) weaponEmoji = 'None'
                else weaponEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.weapon.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                if (!current.ability) abilityEmoji = 'None'
                else abilityEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.ability.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                if (!current.armor) armorEmoji = 'None'
                else armorEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.armor.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                if (!current.ring) ringEmoji = 'None'
                else ringEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(current.ring.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                embed.addFields({ name: current.class, value: `${characterEmote} | LVL: \`${current.level}\` | Fame: \`${current.fame}\` | Stats: \`${current.stats}\` | ${weaponEmoji} ${abilityEmoji} ${armorEmoji} ${ringEmoji}` })
            }
            resolve(embed)
        })
    }
}