const Discord = require('discord.js')
const { settings } = require('../lib/settings');

module.exports = {
    name: 'unverify',
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    description: 'Removes raider role and removes nickname',
    args: '<user> [reason]',
    requiredArgs: 1,
    execute(message, args, bot, db) {
        const { roles, lists: { discordRoles }, backend: { useUnverifiedRole }, channels: { modlogs } } = settings[message.guild.id];
        let memberSearch = args.shift();
        if(!memberSearch) return message.channel.send('Please provide a user to unverify')
        const member = message.guild.findMember(memberSearch);
        if (!member) return message.channel.send(`User \`${memberSearch}\` not found`)

        //check for staff
        if (member.roles.highest.position >= message.guild.roles.cache.get(roles.eventrl).position)
            return message.channel.send('You can not unverify EO+');

        //get role list, ignoring Discord managed roles
        let userRoles = []
        Promise.all(member.roles.cache.each(async r => {
            if (r.managed) return
            if (discordRoles.map(role => roles[role]).includes(r.id)) return
            userRoles.push(r.id)
        }))

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
            .then(() => { if (useUnverifiedRole && !member.roles.cache.has(roles.unverified)) { member.roles.add(roles.unverified) } })
            .then(() => member.setNickname(''))
            .then(async() => { member.send(`You have been unverified from \`${message.guild.name}\`${reason ? ' for: ' + reason : ''}. Please contact ${message.member} \`${message.author.tag}\` to appeal.`); })
            .then(() =>     message.guild.channels.cache.get(modlogs).send({ embeds: [embed] }))
            .then(() => message.react('✅'))
            .catch(er => {
                message.channel.send(`Error: \`${er}\``)
            });
    }
}