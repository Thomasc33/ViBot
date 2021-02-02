module.exports = {
    name: 'unverify',
    role: 'security',
    description: 'Removes raider role and removes nickname',
    args: '<user> [reason]',
    execute(message, args, bot, db) {
        let memberSearch = args.shift();
        let member = message.guild.members.cache.get(memberSearch);
        if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D/g, ''));
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()));
        if (!member) return message.channel.send(`User \`${memberSearch}\` not found`)

        //check for staff
        if (member.roles.highest.position >= message.guild.roles.cache.get(bot.settings[message.guild.id].roles.eventrl).position)
            return message.channel.send('You can not unverify EO+');

        const reason = args.join(' ');
        //unverify
        member.roles.set([])
            .then(() => member.setNickname(''))
            .then(async() => { member.send(`You have been unverified${reason ? ': ' + reason : ''}. Please contact ${message.author} \`${message.author.tag}\` to appeal.`); })
            .then(() => message.react('✅'))
            .catch(er => {
                message.channel.send(`Error: \`${er}\``)
            });
    }
}