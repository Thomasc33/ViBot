const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { commands } = require('../lib/commands');

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
        const override = userOverride(message.author.id, bot);

        if (args.length != 0) {
            commands.get(args[0].toLowerCase())
            let command = commands.get(args[0].toLowerCase())
            if (!command) commands.each(c => {
                if (c.alias) {
                    if (c.alias.includes(args[0].toLowerCase())) {
                        command = c
                    }
                }
            })
            if (!command) return message.channel.send('Command doesnt exist, check \`commands\` and try again');

            let member = message.guild.members.cache.get(message.author.id)
            let memberPosition = member.roles.highest.position;
            let roleCache = message.guild.roles.cache
            if (!message.guild.roles.cache.get(settings.roles[command.role])) return message.channel.send('Permissions not setup for that commands role')
            if ((memberPosition < roleCache.get(settings.roles[command.role]).position && !override) || !settings.commands[command.name]) {
                if (!settings.commandsRolePermissions[command.name]) {
                    return message.channel.send('Command doesnt exist, check \`commands\` and try again');
                } else if (memberPosition < roleCache.get(settings.roles[settings.commandsRolePermissions[command.name]]).position) {
                    return message.channel.send('Command doesnt exist, check \`commands\` and try again');
                }
            }
            var commandPanel = new Discord.EmbedBuilder()
                .setTitle(command.name)
                .setColor('#ff0000')
                .setDescription(command.description || 'No description...')
                .setFooter({ text: '<Required> (Optional) [Item1, Item2, Item3]' });
            if (command.alias) commandPanel.addFields({ name: 'Aliases', value: command.alias.map(a => a).join(', ') })
            if (command.args) commandPanel.addFields({ name: 'Args', value: this.argString(command.args) })
            if (command.getNotes) {
                const notes = command.getNotes(message.guild, message.member, bot)
                if (notes) commandPanel.addFields({ name: notes.title ?? 'Special Notes', value: notes.value ?? notes })
            }

            var roleOverride
            var minimumRole
            if (settings.commandsRolePermissions[command.name]) roleOverride = message.guild.roles.cache.get(settings.roles[settings.commandsRolePermissions[command.name]])
            if (settings.roles[command.role]) minimumRole = message.guild.roles.cache.get(bot.settings[message.guild.id].roles[command.role])
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
                commands.each(command => {
                    /*if (c.roleOverride && c.roleOverride[message.guildId] && bot.settings[message.guild.id].commands[c.name]) {
                        if (c.roleOverride[message.guildId] == roleName) fields[role.name].commands.push(';' + c.name);
                    }
                    else if (c.role == roleName && bot.settings[message.guild.id].commands[c.name])
                        fields[role.name].commands.push(';' + c.name);*/
                    if (!settings.commands[command.name]) { return }
                    let minimumRole = settings.commandsRolePermissions[command.name]
                    if (minimumRole && minimumRole == roleName) {
                        fields[role.name].commands.push(';' + command.name)
                    } else if (!minimumRole && command.role == roleName) {
                        fields[role.name].commands.push(';' + command.name)
                    }
                })
            }
            for (const name of Object.keys(fields).sort((a, b) => fields[a].position - fields[b].position))
                if (fields[name].commands.length)
                    commandPanel.addFields({ name: name + '+', value: '```css\n' + fields[name].commands.join(' ') + '```' });
            message.channel.send({ embeds: [commandPanel] });
        }
    },
    argString(args) {
        if (typeof(args) === 'string') {
            return args
        } else {
            return args.map((arg) => {
                if (arg.type == SlashArgType.Subcommand) {
                    return `(${arg.name} ${module.exports.argString(arg.options)})`
                } else if (arg.choices && arg.choices.length != 0) {
                    const choices = arg.choices.map((c) => c.value).join('|')
                    return arg.required ? `<${arg.name}:${choices}>` : `(${arg.name}:${choices})`
                } else {
                    return arg.required ? `<${arg.name}>` : `(${arg.name})`
                }
            }).join(' ')
        }
    }
};

function userOverride(id, bot) {
    return bot.adminUsers.includes(id);
}
