const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'falsesuspensions',
    alias: ['falsesuspends', 'fs'],
    role: 'security',
    description: 'Shows all users with temporary suspended role, but no logs of them being suspended',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let suspends = await getSuspends(message.guild, db)
        let suspendsIds = []
        suspends.forEach(s => suspendsIds.push(s.id))
        let suspendedId = settings.roles.tempsuspended
        let falseSuspends = []
        message.guild.members.cache.filter(m => m.roles.cache.has(suspendedId)).each(m => {
            if (!suspendsIds.includes(m.id)) falseSuspends.push(m.id)
        })
        let embed = new Discord.EmbedBuilder()
            .setColor(`#706b60`)
            .setTitle(`False Suspensions`)
            .setDescription(`None!`)
        falseSuspends.forEach(s => fitStringIntoEmbed(embed, `<@!${s}>`, message.channel))
        message.channel.send({ embeds: [embed] })
    }
}

async function getSuspends(guild, db) {
    return new Promise((res, rej) => {
        db.query(`SELECT * FROM suspensions WHERE suspended = true`, (err, rows) => {
            if (err) return rej(err)
            res(rows)
        })
    })
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `\n${string}`.length >= 2048) {
        if (embed.data.fields.length == 0) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
            if (embed.data.length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (embed.data.length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`\n${string}`))
    }
}