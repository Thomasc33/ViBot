const Discord = require('discord.js')
module.exports = {
    name: 'vibotchannels',
    description: 'update',
    role: 'Developer',
    async execute(message, args, bot, db) {
        if (args[0].toLowerCase() == 'update') this.update(message.guild)
    },
    async update(guild) {
        try {
            let vibotChannels = guild.channels.cache.find(c => c.name === 'vibot-channels')
            let messages = await vibotChannels.messages.fetch({ limit: 100 })
            messages.each(m => {
                let embed = m.embeds[0]
                let channel = guild.channels.cache.get(embed.footer.text)
                let reactionCollector = new Discord.ReactionCollector(m, xFilter)
                reactionCollector.on('collect', async function (r, u) {
                    await channel.delete()
                    await m.delete()
                })
            })
        } catch (er) { }
    }
}
const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot