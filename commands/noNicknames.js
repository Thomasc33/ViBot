const Discord = require('discord.js')
module.exports = {
    name: 'nonicknames',
    description: 'Lists all verified raiders that dont have a nickname',
    role: 'security',
    alias: ['nn'],
    getNotes(guildid, member) {
        return 'Only usable in mod-bot-commands'
    },
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        var users = []
        let noNickname = message.guild.members.cache.filter(m => !m.nickname);// && m.roles.cache.has(message.guild.roles.cache.find(r => r.name === 'Verified Raider'))
        noNickname.each(user => {
            if (user.roles.cache.has(settings.roles.raider)) {
                users.push(user)
            }
        })
        let embed = new Discord.MessageEmbed()
            .setColor('#fefefe')
            .setTitle('No Nicknames')
        if (users.length) {
            var usersString = ''
            for (let i in users) {
                let u = users[i];
                usersString = usersString.concat(`${u}, `)
            }
            embed.addField('Users', usersString)
        } else {
            embed.setDescription(`No users found with ${message.guild.roles.cache.get(settings.roles.raider)} and no nickname`)
        }
        message.channel.send(embed)
    }
}