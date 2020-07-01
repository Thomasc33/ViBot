const Discord = require('discord.js')
const botSettings = require('../settings.json')

module.exports = {
    name: 'points',
    description: 'Displays how many points a user has',
    role: 'Verified Raider',
    execute(message, args, bot, db) {
        if (message.member.roles.highest.position < message.guild.roles.cache.find(r => r.name === 'Event Organizer')) {
            db.query(`SELECT * FROM users WHERE id = '${message.author.id}'`, (err, rows) => {
                let pointEmbed = new Discord.MessageEmbed()
                .setColor('#015c21')
                .setDescription(`<${botSettings.emote.hallsPortal}> __**Points for ${rows[0].ign} on Pub Halls**__ <${botSettings.emote.hallsPortal}>\n**Points:** ${rows[0].points}`)
            })
        }
    }
}