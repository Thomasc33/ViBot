const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'commands',
    description: 'Gives list of commands available or the specifics of a command',
    args: '(Command Name)',
    alias: ['help'],
    role: 'raider',
    /**
     * 
     * @param {Discord.Message} message 
     * @param {*} args 
     * @param {*} bot 
     * @returns 
     */
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        const override = userOverride(message.author.id);

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
            if (!command) return message.channel.send('Command doesnt exist, check \`commands\` and try again');

            if (!message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role])) return message.channel.send('Permissions not setup for that commands role')
            if ((message.guild.members.cache.get(message.author.id).roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role]).position
                && !override) || !bot.settings[message.guild.id].commands[command.name])
                return message.channel.send('Command doesnt exist, check \`commands\` and try again');
            var commandPanel = new Discord.EmbedBuilder()
                .setTitle(command.name)
                .setColor('#ff0000')
                .setDescription(command.description || 'No description...')
                .setFooter({ text: '<Required> (Optional) [Item1, Item2, Item3]' });
            if (command.alias) commandPanel.addFields({ name: 'Aliases', value: command.alias.map(a => a).join(', ') })
            if (command.args) commandPanel.addFields({ name: 'Args', value: command.args })
            if (command.getNotes && command.getNotes(message.guild.id, message.member)) commandPanel.addFields({ name: 'Special Notes', value: command.getNotes(message.guild.id, message.member) })

            var roleOverride
            if (command.roleOverride && command.roleOverride[message.guildId]) roleOverride = message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.roleOverride[message.guildId]])
            var minimumRole = message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role])
            if (roleOverride) commandPanel.addFields({ name: 'Minimum Role', value: roleOverride.toString() });
            else if (minimumRole) commandPanel.addFields({ name: 'Minimum Role', value: minimumRole.toString() });
            else commandPanel.addFields({ name: 'Minimum Role', value: 'Role not set up' });
            message.channel.send({ embeds: [commandPanel] });
        } else {
            var commandPanel = new Discord.EmbedBuilder()
                .setTitle('Commands')
                .setColor('#ff0000')

            const fields = {};
            for (const roleName in settings.roles) {
                const roleID = settings.roles[roleName];
                if (isNaN(roleID) || roleID == null) continue;
                const role = message.guild.roles.cache.get(roleID);
                if (!role) continue;
                if (message.member.roles.highest.position < role.position && !override) continue;
                if (!fields[role.name]) fields[role.name] = { position: role.position, commands: [] };
                bot.commands.each(c => {
                    if (c.roleOverride && c.roleOverride[message.guildId] && bot.settings[message.guild.id].commands[c.name]) {
                        if (c.roleOverride[message.guildId] == roleName) fields[role.name].commands.push(';' + c.name);
                    }
                    else if (c.role == roleName && bot.settings[message.guild.id].commands[c.name])
                        fields[role.name].commands.push(';' + c.name);
                })
            }
            for (const name of Object.keys(fields).sort((a, b) => fields[a].position - fields[b].position))
                if (fields[name].commands.length)
                    commandPanel.addFields({ name: name + '+', value: '```css\n' + fields[name].commands.join(' ') + '```' });
            message.channel.send({ embeds: [commandPanel] });
        }
    },
};

function userOverride(id) {
    return ['277636691227836419', '258286481167220738'].includes(id);
}