const Discord = require('discord.js')
const botSettings = require('../settings.json')
module.exports = {
    name: 'stats',
    description: 'Gives users stats',
    args: '(user)',
    role: 'Verified Raider',
    execute(message, args, bot, db) {
        if (args.length == 0) {
            var member = message.member.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|')[0]
            var guildMember = message.member
        } else {
            var member = args[0]
            var guildMember = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(member.toLowerCase()));
        }
        db.query(`SELECT * FROM users WHERE ign = '${member}'`, (err, rows) => {
            if (err) { message.channel.send('User not found'); return; }
            if (rows[0] == undefined) { message.channel.send('User is not logged. User database is updated every 24-48 hours for new raiders'); return; }
            let embed = new Discord.MessageEmbed()
                .setColor('#015c21')
                .setDescription(`<${botSettings.emote.hallsPortal}> __**Stats for ${rows[0].ign} on Pub Halls**__ <${botSettings.emote.hallsPortal}>
                
                <${botSettings.emote.LostHallsKey}> __**Keys Popped**__ <${botSettings.emote.LostHallsKey}>
                Halls: ${rows[0].keypops}
                Other: ${rows[0].eventpops}
                
                <${botSettings.emote.hallsPortal}>__**Runs Done**__<${botSettings.emote.hallsPortal}>
                Cult: ${rows[0].cultRuns}
                Void: ${rows[0].voidRuns}
                Solo cults: ${rows[0].solocult}
                Other: ${rows[0].eventruns}
                
                <${botSettings.emote.hallsPortal}>__**Runs Led**__<${botSettings.emote.hallsPortal}>
                Cult: ${rows[0].cultsLead}
                Void: ${rows[0].voidsLead}
                Assists: ${rows[0].assists}
                
                <${botSettings.emote.Vial}>__**Vials**__<${botSettings.emote.Vial}>
                Stored: ${rows[0].vialStored}
                Used: ${rows[0].vialUsed}`)
            if (guildMember) embed.setThumbnail(guildMember.user.avatarURL())
            message.author.send(embed)
            message.react('✅')
        })
    }
}