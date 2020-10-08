const Discord = require('discord.js')
const realmeyescrape = require('../realmEyeScrape')
const points = require('./points')
module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'developer',
    async execute(message, args, bot, db) {
        return;
        console.log(message.attachments.first())
        let embed = new Discord.MessageEmbed()
        .setAuthor(message.member, message.author.avatarURL())
        .addField('attachments', )
        message.channel.send(embed)
    }
}