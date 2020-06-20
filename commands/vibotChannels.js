const Discord = require('discord.js')
const fs = require('fs')
const botSettings = require('../settings.json')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'vibotchannels',
    description: 'update',
    role: 'Developer',
    async execute(message, args, bot, db) {
        if (args[0].toLowerCase() == 'update') this.update(message.guild)
    },
    async update(guild, bot) {
        try {
            await updateChannel(guild.channels.cache.find(c => c.name === botSettings.ActiveRaidingName))
            await updateChannel(guild.channels.cache.find(c => c.name === botSettings.ActiveVetName))
            await updateChannel(guild.channels.cache.find(c => c.name === botSettings.ActiveEventName))
            async function updateChannel(c) {
                if (!c) return;
                let messages = await c.messages.fetch()
                messages.each(async m => {
                    if (m.author.id !== bot.user.id) return;
                    if (m.embeds.length == 0) return;
                    let embed = m.embeds[0]
                    let channel = guild.channels.cache.get(embed.footer.text)
                    if (channel == null) m.delete()
                    let reactionCollector = new Discord.ReactionCollector(m, xFilter)
                    reactionCollector.on('collect', async function (r, u) {
                        for (let i in bot.afkChecks) {
                            if (i == embed.footer.text) {
                                let key = await guild.members.cache.get(bot.afkChecks[i].key)
                                if (key) {
                                    let keyRole = await guild.roles.cache.find(r => r.name === 'Temporary Key Popper')
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
                    })
                })
            }
        } catch (er) { console.log(er) }
    }
}
const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot