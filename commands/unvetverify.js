module.exports = {
    name: 'unvetverify',
    description: 'Removes veteran raider role',
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    args: '<user>',
    async execute(message, args, bot, db) {
        //member
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')

        //check for staff
        if (member.roles.highest.position >= message.guild.roles.cache.get(bot.settings[message.guild.id].roles.eventrl).position) return message.channel.send('You can not unvetverify EO+')

        //unverify
        member.roles.remove(bot.settings[message.guild.id].roles.vetraider)
            .then(message.react('✅'))
            .catch(er => {
                message.channel.send(`Error: \`${er}\``)
            });
    }
}