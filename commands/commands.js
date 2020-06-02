const Discord = require('discord.js');
const ErrorLogger = require('../logError')

module.exports = {
    name: 'commands',
    description: 'Gives list of commands available or the specifics of a command',
    args: '(Command Name)',
    alias: 'help',
    role: 'Verified Raider',
    execute(message, args, bot) {
        if (args.length != 0) {
            if (!bot.commands.has(args[0].toLowerCase())) {
                message.channel.send('Command doesnt exist, check \`commands\` and try again');
                return;
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.find(r => r.name === bot.commands.get(command).role).position && message.author.id !== '277636691227836419') {
                message.channel.send('Command doesnt exist, check \`commands\` and try again');
                return;
            }
            var commandPanel = new Discord.MessageEmbed()
                .setTitle(bot.commands.get(args[0].toLowerCase()).name)
                .setColor('#ff0000')
                .setDescription(bot.commands.get(args[0].toLowerCase()).description)
                .setFooter('<Required> (Optional) [Item1, Item2, Item3]');
            if (bot.commands.get(args[0].toLowerCase()).alias != null) {
                commandPanel.addField('Aliases', bot.commands.get(args[0].toLowerCase()).alias)
            } if (bot.commands.get(args[0].toLowerCase()).args != null) {
                commandPanel.addField('Args', bot.commands.get(args[0].toLowerCase()).args)
            } if (bot.commands.get(args[0].toLowerCase()).notes != null) {
                commandPanel.addField('Special Notes', bot.commands.get(args[0].toLowerCase()).notes)
            }
            var minimumRole = message.guild.roles.cache.find(r => r.name === bot.commands.get(args[0].toLowerCase()).role);
            commandPanel.addField('Minimum Role', minimumRole);
            message.channel.send(commandPanel);
        } else {
            var commandPanel = new Discord.MessageEmbed()
                .setTitle('Commands')
                .setColor('#ff0000')
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Verified Raider").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Verified Raider') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Verified Raider+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Event Organizer").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Event Organizer') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Event Organizer+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Almost Raid Leader') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Almost Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Raid Leader").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Raid Leader') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Veteran Raid Leader").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Veteran Raid Leader') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Veteran Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Security").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Security') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Security+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Head Raid Leader").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Head Raid Leader') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Head Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Officer").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Officer') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Officer+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position >= message.guild.roles.cache.find(r => r.name === "Moderator").position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'Moderator') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Moderator+', `\`\`\`css\n${line}\`\`\``)
            }
            message.channel.send(commandPanel);
        }
    },
};