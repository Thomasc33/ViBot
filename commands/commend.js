module.exports = {
    name: 'commend',
    role: 'rl',
    args: '<user> <rusher/mapmarker>',
    notes: 'rusher',
    requiredArgs: 2,
    description: 'Gives user a role',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        //check args length
        if (args.length < 2) return

        //args 0
        let member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0])
        if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (member == null) return message.channel.send('User not found')

        //args 1
        let type = args[1].charAt(0).toLowerCase()

        //give role and log
        switch (type) {
            case 'r':
            case 'm':
                let rusher = message.guild.roles.cache.get(settings.roles.rusher)
                if (member.roles.cache.has(rusher.id)) return message.channel.send(`${member} already has \`${rusher.name}\``)
                let modlog = message.guild.channels.cache.get(settings.channels.modlogs)
                await modlog.send(`\`${rusher.name}\` added to ${member} per the request of ${message.member}`)
                member.roles.add(rusher.id)
                if (type == 'r') db.query(`UPDATE users SET isRusher = true WHERE id = '${member.id}'`)
                break;
            default:
                return message.channel.send(`${args[1]} is not a valid commendation type. Check \`;commands commend\` for a list of roles`)
        }

        //give confirmation
        message.react('✅')
    }
}