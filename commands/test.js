const Discord = require('discord.js')
const realmeyescrape = require('../realmEyeScrape')
const points = require('./points')
module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'developer',
    async execute(message, args, bot, db) {
        let embed = new Discord.MessageEmbed()
        .setAuthor(message.member, message.author.avatarURL())
        .setFooter('4️⃣')
        message.channel.send(embed)
    }
}