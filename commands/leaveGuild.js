const Discord = require('discord.js')

module.exports = {
    name: 'leaveguild',
    role: 'moderator',
    async execute(message, args, bot) {
        if (!['277636691227836419', '258286481167220738'].includes(message.author.id)) return message.channel.send('vi only')
        const guild = bot.guilds.cache.get(args[0])
        const fancyEmbed = new Discord.EmbedBuilder()
            .setDescription(`Are you sure you want bot to leave ${guild.name}?`)
        const m = await message.channel.send({ embeds: [fancyEmbed] })
        const reactionCollector = new Discord.ReactionCollector(m, { filter: (r, u) => !u.bot })
        reactionCollector.on('collect', async r => {
            if (r.emoji.name == '✅') {
                await m.delete()
                guild.leave()
            }
            if (r.emoji.name == '❌') m.delete()
        })
        await m.react('✅')
        await m.react('❌')
        guild.leave()
    }
}
