const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'commands',
    description: 'Gives list of commands available or the specifics of a command',
    args: '(Command Name)',
    alias: ['help'],
    role: 'raider',
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length != 0) {
            bot.commands.get(args[0].toLowerCase())
            let command = bot.commands.get(args[0].toLowerCase())
            if (!command) bot.commands.each(c => {
                if (c.alias) {
                    if (c.alias.includes(args[0].toLowerCase())) {
                        command = c
                    }
                }
            })
            if (!command) {
                message.channel.send('Command doesnt exist, check \`commands\` and try again');
                return;
            }
            if (message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role]).position && message.author.id !== '277636691227836419') {
                message.channel.send('Command doesnt exist, check \`commands\` and try again');
                return;
            }
            var commandPanel = new Discord.MessageEmbed()
                .setTitle(command.name)
                .setColor('#ff0000')
                .setDescription(command.description)
                .setFooter('<Required> (Optional) [Item1, Item2, Item3]');
            if (command.alias != null) {
                commandPanel.addField('Aliases', command.alias)
            } if (command.args != null) {
                commandPanel.addField('Args', command.args)
            } if (command.notes != null) {
                commandPanel.addField('Special Notes', command.notes)
            }
            var minimumRole = message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role])
            commandPanel.addField('Minimum Role', minimumRole);
            message.channel.send(commandPanel);
        } else {
            var commandPanel = new Discord.MessageEmbed()
                .setTitle('Commands')
                .setColor('#ff0000')
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.raider).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'raider') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Verified Raider+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.eventrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'eventrl') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Event Organizer+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'almostrl') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Almost Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.rl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'rl') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.vetrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'vetrl') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Veteran Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.security).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'security') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Security+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.headrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'headrl') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Head Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.officer).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'officer') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Officer+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.moderator).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'moderator') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Moderator+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.cache.has(message.guild.roles.cache.get(settings.roles.developer))) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'developer') {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Developer', `\`\`\`css\n${line}\`\`\``)
            }
            message.channel.send(commandPanel);
        }
    },
};