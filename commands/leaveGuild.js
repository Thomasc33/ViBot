const Discord = require('discord.js')

module.exports = {
    name: 'leaveguild',
    role: '(Admin)',
    async execute(message, args, bot) {
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