const Discord = require('discord.js')

module.exports = {
    name: 'leaveguild',
    role: 'moderator',
    async execute(message, args, bot) {
        if(message.author.id !== '277636691227836419') return message.channel.send('vi only')
        let guild = bot.guilds.cache.get(args[0])
        let fancyEmbed = new Discord.MessageEmbed()
            .setDescription(`Are you sure you want bot to leave ${guild.name}?`)
        let m = await message.channel.send(fancyEmbed)
        let reactionCollector = new Discord.ReactionCollector(m, (r, u) => !u.bot)
        reactionCollector.on('collect', async (r, u) => {
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