const Discord = require('discord.js');

module.exports = {
    name: 'commands',
    description: 'Gives list of commands available or the specifics of a command',
    args: '(Command Name)',
    role: 'Almost Raid Leader',
    execute(message, args, bot) {
        if (args.length != 0) {
            if (!bot.commands.has(args[0].toLowerCase())) {
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
                .addFields(
                    { name: 'Raiding', value: '\`\`\`css\n;afk ;lock ;unlock ;clean ;location ;allowrun ;parsemembers\`\`\`' },
                    { name: 'Moderation', value: '\`\`\`css\n;find ;vetban ;vetunban ;addalt ;kick ;changename\`\`\`' }
                )
            message.channel.send(commandPanel);
        }
    },
};