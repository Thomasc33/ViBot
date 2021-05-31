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
            if (!message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role])) return message.channel.send('Permissions not setup for that commands role')
            if ((message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role]).position && message.author.id !== '277636691227836419') || !bot.settings[message.guild.id].commands[command.name])
                return message.channel.send('Command doesnt exist, check \`commands\` and try again');
            var commandPanel = new Discord.MessageEmbed()
                .setTitle(command.name)
                .setColor('#ff0000')
                .setDescription(command.description)
                .setFooter('<Required> (Optional) [Item1, Item2, Item3]');
            if (command.alias != null) {
                commandPanel.addField('Aliases', command.alias)
            } if (command.args != null) {
                commandPanel.addField('Args', command.args)
            } if (command.getNotes && command.getNotes(message.guild.id, message.member)) {
                commandPanel.addField('Special Notes', command.getNotes(message.guild.id, message.member))
            }
            var minimumRole = message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role])
            commandPanel.addField('Minimum Role', minimumRole);
            message.channel.send(commandPanel);
        } else {
            var commandPanel = new Discord.MessageEmbed()
                .setTitle('Commands')
                .setColor('#ff0000')
            if (message.guild.roles.cache.get(settings.roles.raider) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.raider).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'raider' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Verified Raider+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.eventrl) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.eventrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'eventrl' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Event Organizer+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.almostrl) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'almostrl' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Almost Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.rl) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.rl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'rl' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.fullskip) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.fullskip).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'fullskip' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Full-Skip+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.vetrl) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.vetrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'vetrl' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Veteran Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.security) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.security).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'security' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Security+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.headeventrl) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.headeventrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'headeventrl' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Head Event Organizer+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.headrl) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.headrl).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'headrl' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Head Raid Leader+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.officer) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.officer).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'officer' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Officer+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.guild.roles.cache.get(settings.roles.moderator) && message.member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.moderator).position) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'moderator' && bot.settings[message.guild.id].commands[c.name]) {
                        line = line.concat(`;${c.name} `)
                    }
                })
                if (line == '') line = 'No role specific commands'
                commandPanel.addField('Moderator+', `\`\`\`css\n${line}\`\`\``)
            }
            if (message.member.roles.cache.has(settings.roles.developer)) {
                let line = ''
                bot.commands.each(c => {
                    if (c.role == 'developer' && bot.settings[message.guild.id].commands[c.name]) {
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