const Discord = require('discord.js')
const botSettings = require('../settings.json')

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
                let messages = await c.messages.fetch({ limit: 100 })
                messages.each(m => {
                    if (m.author.id !== bot.user.id) return;
                    if (m.embeds.length == 0) return;
                    let embed = m.embeds[0]
                    let channel = guild.channels.cache.get(embed.footer.text)
                    if (channel == null) m.delete()
                    let reactionCollector = new Discord.ReactionCollector(m, xFilter)
                    reactionCollector.on('collect', async function (r, u) {
                        await channel.delete()
                        await m.delete()
                    })
                })
            }
        } catch (er) { console.log(er) }
    }
}
const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot