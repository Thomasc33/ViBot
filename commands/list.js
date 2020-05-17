const Discord = require('discord.js')

module.exports = {
    name: 'list',
    description: 'Lists all players with either: Leader on Leave (lol) or Suspected Alts (sa)',
    args: '<lol/sa>',
    role: 'Security',
    async execute(message, args, bot) {
        switch (args[0]) {
            case 'lol':
                let leaderOnLeave = message.guild.roles.cache.find(r => r.name === 'Leader on Leave')
                let lols = ' '
                let embed = new Discord.MessageEmbed()
                    .setTitle('Leaders on Leave')
                    .setColor(leaderOnLeave.hexColor)
                message.guild.members.cache.filter(m => m.roles.cache.has(leaderOnLeave.id))
                    .each(m => {
                        lols = lols.concat(`${m}\n`)
                    })
                embed.setDescription(lols)
                message.channel.send(embed)
                break;
            case 'sa':
                let sa = ' '
                let saembed = new Discord.MessageEmbed()
                message.guild.members.cache.filter(m => m.displayName.charAt(0) == '?')
                    .each(m => {
                        saembed.setTitle(m.displayName.replace(/[^a-z|]/gi, ''))
                            .setDescription(`Suspected Alt: ${m}`)
                            .setColor('#ff0000')
                            .setURL(`https://www.realmeye.com/player/${m.displayName.replace(/[^a-z|]/gi, '')}`)
                        message.channel.send(saembed)
                    })
                break;
            default:
                break;
        }
    }
}