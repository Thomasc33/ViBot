const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'list',
    description: 'Lists all suspected alts, or members with a specific role',
    args: '<sa/role>',
    requiredArgs: 1,
    role: 'security',
    async execute(message, args, bot) {
        switch (args[0]) {
            case 'sa':
                let sa = ' '
                let saembed = new Discord.EmbedBuilder()
                message.guild.members.cache.filter(m => m.displayName.charAt(0) == '?')
                    .each(m => {
                        saembed.setTitle(m.displayName.replace(/[^a-z|]/gi, ''))
                            .setDescription(`Suspected Alt: ${m}`)
                            .setColor('#ff0000')
                            .setURL(`https://www.realmeye.com/player/${m.displayName.replace(/[^a-z|]/gi, '')}`)
                        message.channel.send({ embeds: [saembed] })
                    })
                break;
            default:
                let roleN = '';
                for (i = 0; i < args.length; i++) {
                    roleN = roleN.concat(args[i]) + ' ';
                }
                roleN = roleN.trim().toLowerCase();
                if (roleN == 'verified raider') { message.channel.send('Yeah, lets not do that'); return; }
                let role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleN)
                if (role == undefined) { message.channel.send('Role not found'); return; }
                var embed = new Discord.EmbedBuilder()
                    .setTitle(role.name)
                    .setColor(role.hexColor)
                    .setDescription('None!')
                let members = message.guild.members.cache.filter(m => m.roles.cache.has(role.id))
                members.each(m => {
                    fitStringIntoEmbed(embed, `<@!${m.id}>`, message.channel)
                })
                embed.setFooter({ text: `${members.size} users with role` })
                message.channel.send({ embeds: [embed] }).catch(er => ErrorLogger.log(er, bot))
                break;
        }
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `, ${string}`.length >= 2048) {
        if (embed.data.fields.length == 0) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `, ${string}`.length >= 1024) {
            if (embed.data.length + `, ${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (embed.data.length + `, ${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`, ${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`, ${string}`))
    }
}