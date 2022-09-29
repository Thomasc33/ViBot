const ErrorLogger = require('../lib/logError')
const Discord = require('discord.js')

module.exports = {
    name: 'redeem',
    description: 'wip',
    args: '<token>',
    role: 'raider',
    dms: true,
    async execute(message, args, bot, db, tokenDB) {
        message.delete()
        this.redeemToken(message, args, bot, tokenDB)
    },
    async dmExecution(message, args, bot, db, guild, tokenDB) {
        this.redeemToken(message, args, bot, tokenDB)
    },
    async redeemToken(message, args, bot, db) {
        //check args 0
        if (!args[0]) return message.channel.send(`<@!${message.author.id}> Please provide a code`)
        if (args[0].replace(/[^a-z0-9:]/gi, '') != args[0]) return message.channel.send(`Invalid token. Please try again`)
        if (args[0].length !== 64) return message.channel.send(`Invalid token. Please try again.`)
        db.query(`SELECT * FROM tokens WHERE token = '${args[0]}'`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            //rows == 0
            if (!rows || rows.length == 0) return message.channel.send(`Token was not found. Please try again`)
            //token already redeemded
            if (rows.user) return message.channel.send(`Token has already been redeemed`)
            //if not, add this user
            db.query(`UPDATE tokens SET user = '${message.author.id}', redeemedOn = '${Date.now()}', active = true WHERE token = '${args[0]}'`, err => {
                if (err) ErrorLogger.log(err, bot)
                let confirmEmbed = new Discord.EmbedBuilder()
                    .setAuthor({ name: message.author.tag })
                    .setDescription(`Token has been redeemed. Thank you for supporting ViBot`)
                    .setFooter({ text: `Time will expire at` })
                    .setTimestamp(new Date(parseInt(rows[0].duration) + parseInt(Date.now())))
                if (message.author.avatarURL()) confirmEmbed.setAuthor({ name: message.author.tag , iconURL: message.author.avatarURL() })
                if (rows[0].hasCooldown) confirmEmbed.data.description += `\nCooldown time: \`1 hour\``
                else confirmEmbed.data.description += `\nCooldown time: \`None :)\``
                message.author.send({ embeds: [confirmEmbed] })
            })
        })
    }
}