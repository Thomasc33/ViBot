const Discord = require('discord.js')
const logs = require('../data/logInfo.json')

module.exports = {
    name: 'currentweek',
    description: 'Check user\'s currentweek quota.',
    args: '(user)',
    role: 'eventrl',
    getNotes(guildid, member) {
        return `Types: ${logs[guildid].main.map(log => log.key + ' (' + log.name + ')').join(', ')}`
    },
    async execute(message, args, bot, db) {
        //get member
        if (args.length == 0) var member = message.member;
        else var member = message.mentions.members.first();
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));

        //get log info
        let guildInfo = logs[message.guild.id];
        if (!guildInfo) return message.channel.send('Logging isn\'t setup on this server yet');
        let raids = getRunInfo(guildInfo, 'v');
        if (message.guild.id == '708026927721480254') raids = getRunInfo(guildInfo, 'o')
        if (!raids) return message.channel.send('Run Type not recognized\n' + this.getNotes(message.guild.id));

        db.query(`SELECT * FROM users WHERE id = ${member.id}`, (err, rows) => {
            if (err) { res(null); return message.channel.send(`Error: ${err}`); }
            if (!rows || rows.length == 0) return message.channel.send(`User not found: \`${member.id}\``);
            const quotaEmbed = new Discord.EmbedBuilder()
                .setColor(raids.color)
                .setDescription(`**Current Week Quota for ${member}**`)
                .setFooter({ text: `Quota for ${member.displayName} as of` })
                .setTimestamp()
                .addFields(
                    { name: 'Raiding', value: raids.toDisplay.map(c => ` \`${rows[0][c]}\` ${c.replace('currentweek', '').replace('rollingQuota', 'Rollover')}`).join('\n'), inline: true }
                );
            if (message.guild.id == '343704644712923138' || message.guild.id == '701483950559985705') quotaEmbed.addFields({ name: 'Security', value: `\`${rows[0].currentweekparses}\` Parses`, inline: true })
            if (message.guild.id == '708026927721480254' || message.guild.id == '701483950559985705') quotaEmbed.addFields({ name: 'Parsing', value: `\`${rows[0].o3currentweekparses + rows[0].rollingsecurityquotao3}\` Total\n\`${rows[0].o3currentweekparses}\` Parses\n\`${rows[0].rollingsecurityquotao3}\` Rollover`, inline: true })
            message.channel.send({ embeds: [quotaEmbed] });
        })
    }
};

function getRunInfo(guildInfo, key) {
    for (let i of guildInfo.main) {
        if (key.toLowerCase() == i.key.toLowerCase()) return i;
        if (i.alias.includes(key.toLowerCase())) return i;
    }
    return null;
}