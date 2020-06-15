const Discord = require('discord.js')

module.exports = {
    name: 'suspends',
    description: 'Shows all suspends that the bot is currently tracking',
    role: 'Security',
    args: '(user)',
    alias: ['suspensions'],
    async execute(message, args, bot) {
        if (args.length > 0) {
            let member = message.mentions.members.first()
            if (member == null) member = message.guild.members.cache.get(args[0])
            if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
            if (member == null) { message.channel.send('User not found'); return; }

            if (!bot.suspensions[member.id]) { message.channel.send('User was not suspended by me'); return; }

            let suspension = bot.suspensions[member.id]

            let embed = new Discord.MessageEmbed()
                .setDescription(`__Suspension case for ${member}__\`${member.nickname}\`
                Reason: \`${suspension.reason.trim()}\`
                Suspended by: <@!${suspension.by}>`)
                .setFooter(`Unsuspending at`)
                .setTimestamp(suspension.time)
            message.channel.send(embed)
        } else {
            let embed = new Discord.MessageEmbed()
                .setColor(message.guild.roles.cache.find(r => r.name === 'Suspended but Verified').hexColor)
                .setTitle('Current Logged Suspensions')
                .setDescription('None')
            for (let i in bot.suspensions) {
                let sus = bot.suspensions[i]
                let guild = bot.guilds.cache.get(sus.guild)
                let member = guild.members.cache.get(i)
                let desc = (`__Suspension case for ${member}__\`${member.nickname}\`\nReason: \`${sus.reason.trim()}\`\nSuspended by: <@!${sus.by}>\n`)
                console.log(desc)
                if (embed.description == 'None') { embed.setDescription(desc) }
                else {
                    if (embed.description.length + desc.length > 2048) {
                        message.channel.send(embed)
                        embed.setDescription('')
                    }
                    embed.setDescription(desc)
                }
            }
            message.channel.send(embed)
        }
    }
}