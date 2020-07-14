const Discord = require('discord.js')
const fs = require('fs')
const botSettings = require('../settings.json')
const ErrorLogger = require('../logError')
const vibotChannel = require('./vibotChannels.js')
var watchedMessages = []

module.exports = {
    name: 'vibotchannels',
    description: 'update',
    role: 'Developer',
    async execute(message, args, bot, db) {
        if (args[0].toLowerCase() == 'update') this.update(message.guild)
    },
    async update(guild, bot) {
        let settings = bot.settings[guild.id]
        await updateChannel(guild.channels.cache.find(c => c.name === settings.activechannels))
        await updateChannel(guild.channels.cache.find(c => c.name === settings.vetchannels))
        await updateChannel(guild.channels.cache.find(c => c.name === settings.eventchannels))
        async function updateChannel(c) {
            if (!c) return;
            let messages = await c.messages.fetch()
            messages.each(async m => {
                if (m.author.id !== bot.user.id) return;
                if (m.embeds.length == 0) return;
                let embed = m.embeds[0]
                if (!watchedMessages.includes(embed.footer.text)) module.exports.watchMessage(m, bot, settings)
            })
        }
        for (let i in bot.afkChecks) {
            if (!guild.channels.cache.get(i)) delete bot.afkChecks[i]
        }
        fs.writeFile('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
            if (err) ErrorLogger.log(err, bot)
        })
    },
    async watchMessage(message, bot, settings) {
        let m = message
        let embed = m.embeds[0]
        watchedMessages.push(embed.footer)
        let channel = message.guild.channels.cache.get(embed.footer.text)
        if (channel == null) m.delete()
        let reactionCollector = new Discord.ReactionCollector(m, xFilter)
        reactionCollector.on('collect', async (r, u) => {
            if (u.id == m.mentions.members.first().id) remove()
            else {
                await m.reactions.removeAll()
                reactionCollector.stop()
                await m.react('✅')
                await m.react('❌')
                let confirmReactionCollector = new Discord.ReactionCollector(m, (r, uu) => (r.emoji.name === '✅' || r.emoji.name === '❌') && u.id == uu.id)
                confirmReactionCollector.on('collect', async (r, u) => {
                    if (r.emoji.name == '❌') {
                        await m.reactions.removeAll()
                        confirmReactionCollector.stop()
                        await m.react('❌')
                    } else remove()
                })
            }
            async function remove() {
                for (let i in bot.afkChecks) {
                    if (i == embed.footer.text) {
                        let key = await message.guild.members.cache.get(bot.afkChecks[i].key)
                        if (key) {
                            let keyRole = await message.guild.roles.cache.find(r => r.name === settings.tempkey)
                            await key.roles.remove(keyRole.id).catch(r => ErrorLogger.log(r, bot))
                        }
                        delete bot.afkChecks[i];
                        fs.writeFile('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
                            if (err) ErrorLogger.log(err, bot)
                        })
                    }
                }
                await channel.delete()
                await m.delete()
            }

        })
    }
}
const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot