const Discord = require('discord.js')
module.exports = {
    name: 'unverify',
    role: 'security',
    description: 'Removes raider role and removes nickname',
    args: '<user> [reason]',
    execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]

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
        let embed = new Discord.MessageEmbed()
            .setTitle('Unverify')
            .setDescription(`${member} \`${member.user.tag}\``)
            .addField('Nickname', member.nickname || 'None!', true)
            .addField('Unverified By', `<@!${message.author.id}>`, true)
            .addField('Reason', reason || 'None!')
            .setTimestamp(Date.now());
        member.roles.set([])
            .then(() => member.setNickname(''))
            .then(async() => { member.send(`You have been unverified${reason ? ': ' + reason : ''}. Please contact ${message.author} \`${message.author.tag}\` to appeal.`); })
            .then(() =>     message.guild.channels.cache.get(settings.channels.modlogs).send(embed))
            .then(() => message.react('✅'))
            .catch(er => {
                message.channel.send(`Error: \`${er}\``)
            });
    }
}