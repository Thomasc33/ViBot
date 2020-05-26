const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'list',
    description: 'Lists all suspected alts, or members with a specific role',
    args: '<sa/role>',
    role: 'Security',
    async execute(message, args, bot) {
        if (args.length == 0) return;
        switch (args[0]) {
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
                let roleN = '';
                for (i = 0; i < args.length; i++) {
                    roleN = roleN.concat(args[i]) + ' ';
                }
                roleN = roleN.trim().toLowerCase();
                if (roleN == 'verified raider') { message.channel.send('Yeah, lets not do that'); return; }
                let role = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleN)
                if (role == undefined) { message.channel.send('Role not found'); return; }
                let members = ' '
                var embed = new Discord.MessageEmbed()
                    .setTitle(role.name)
                    .setColor(role.hexColor)
                message.guild.members.cache.filter(m => m.roles.cache.has(role.id))
                    .each(m => {
                        if (members.length >= 1024) {
                            embed.setDescription(members)
                            message.channel.send(embed).catch(er => ErrorLogger.log(er, bot))
                            members = ''
                        }
                        members = members.concat(`${m}\n`)
                    })
                embed.setDescription(members)
                message.channel.send(embed).catch(er => ErrorLogger.log(er, bot))
                break;
        }
    }
}