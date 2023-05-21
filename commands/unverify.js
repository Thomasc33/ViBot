const Discord = require('discord.js')
module.exports = {
    name: 'unverify',
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    description: 'Removes raider role and removes nickname',
    args: '<user> [reason]',
    execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]

        let memberSearch = args.shift();
        if(!memberSearch) return message.channel.send('Please provide a user to unverify')
        let member = message.guild.members.cache.get(memberSearch);
        if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D/g, ''));
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()));
        if (!member) return message.channel.send(`User \`${memberSearch}\` not found`)

        //check for staff
        if (member.roles.highest.position >= message.guild.roles.cache.get(bot.settings[message.guild.id].roles.eventrl).position)
            return message.channel.send('You can not unverify EO+');

        //get role list, ignoring Discord managed roles
        let userRoles = []
        member.roles.cache.each(r => {
            if (r.managed) return
            if (settings.lists.discordRoles.map(role => settings.roles[role]).includes(r.id)) return
            userRoles.push(r.id)
        })

        const reason = args.join(' ');
        //unverify
        let embed = new Discord.EmbedBuilder()
            .setTitle('Unverify')
            .setDescription(`${member} \`${member.user.tag}\``)
            .addFields([{name: 'Nickname', value: member.nickname || 'None!', inline: true}])
            .addFields([{name: 'Unverified By', value: `<@!${message.author.id}>`, inline: true}])
            .addFields([{name: 'Reason', value: reason || 'None!'}])
            .setTimestamp(Date.now());
        member.roles.remove(userRoles)
            .then(() => member.setNickname(''))
            .then(async() => { member.send(`You have been unverified from \`${message.guild.name}\`${reason ? ' for: ' + reason : ''}. Please contact ${message.member} \`${message.author.tag}\` to appeal.`); })
            .then(() =>     message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] }))
            .then(() => message.react('✅'))
            .catch(er => {
                message.channel.send(`Error: \`${er}\``)
            });
    }
}