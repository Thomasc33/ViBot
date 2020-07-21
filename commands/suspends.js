const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'suspends',
    description: 'Shows all suspends that the bot is currently tracking',
    role: 'Security',
    args: '(user)',
    alias: ['suspensions'],
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (args.length > 0) {
            let member = message.mentions.members.first()
            if (member == null) member = message.guild.members.cache.get(args[0])
            if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
            if (member == null) { message.channel.send('User not found'); return; }

            db.query(`SELECT * FROM suspensions WHERE id = '${member.id}'`, async (err, rows) => {
                if (rows.length == 0) return message.channel.send('User has no suspends logged under me')
                if (err) ErrorLogger.log(err, bot)
                let suspension = rows[0]
                let embed = new Discord.MessageEmbed()
                    .setDescription('None!')
                for (let i in rows) {
                    let string = `__Suspension ${parseInt(i) + 1} case for ${member}__\`${member.nickname}\`\nReason: \`${suspension.reason.trim()}\`\nSuspended by: <@!${suspension.modid}>`
                    fitStringIntoEmbed(embed, string, message.channel)
                }
                message.channel.send(embed)
            })

        } else {
            let embed = new Discord.MessageEmbed()
                .setColor(message.guild.roles.cache.find(r => r.name === settings.tempsuspend).hexColor)
                .setTitle('Current Logged Suspensions')
                .setDescription('None')
            for (let i in bot.suspensions) {
                let sus = bot.suspensions[i]
                let guild = bot.guilds.cache.get(sus.guild)
                let member = guild.members.cache.get(i)
                let desc = (`__Suspension case for ${member}__\`${member.nickname}\`\nReason: \`${sus.reason.trim()}\`\nSuspended by: <@!${sus.by}>\n`)
                console.log(desc)
                if (embed.description == 'None') { embed.setDescription(desc) }
                else {
                    if (embed.description.length + desc.length > 2048) {
                        message.channel.send(embed)
                        embed.setDescription('')
                    }
                    embed.setDescription(desc)
                }
            }
            message.channel.send(embed)
        }
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + string.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + string.length >= 1024) {
            if (embed.length + string.length + 1 >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + string.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`\n${string}`))
    }
}