module.exports = {
    name: 'unverify',
    role: 'security',
    description: 'Removes raider role and removes nickname',
    args: '<user>',
    execute(message, args, bot, db) {
        //member
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')

        //check for staff
        if (member.roles.highest.position >= message.guild.roles.cache.get(bot.settings[message.guild.id].roles.eventrl).position) return message.channel.send('You can not unverify EO+')

        //unverify
        member.roles.set([])
            .then(member.setNickname(''))
            .then(message.react('✅'))
            .catch(er => {
                message.channel.send(`Error: \`${er}\``)
            });
    }
}