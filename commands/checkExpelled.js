const Discord = require('discord.js')

module.exports = {
        name: 'checkexpelled',
        role: 'security',
        description: 'Checks expelled list for verified people',
        async execute(message, args, bot, db) {
            let members = await getList(db)
            let toRemove = {}
            for (const m of members) {
                let member = message.guild.members.cache.get(m.id)
                if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(m.id.toLowerCase()));
                if (member && member.roles.cache.get(bot.settings[message.guild.id].roles.raider)) toRemove[member] = [...(toRemove[member] || []), m.id];
            }
            let embed = new Discord.MessageEmbed()
                .setColor(`#706b60`)
                .setTitle(`People to remove from expelled list`)
                .setDescription('None!')
            for (const member in toRemove) {
                fitStringIntoEmbed(embed, `${member}: \`${toRemove[member].join('\` \`')}\``, message.channel)
        }
        message.channel.send(embed)
    }
}

async function getList(db) {
    return new Promise((res, rej) => {
        db.query(`SELECT * FROM veriblacklist`, (err, rows) => {
            if (err) return rej(err)
            res(rows)
        })
    })
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + `\n${string}`.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
            if (embed.length + `\n${string}`.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + `\n${string}`.length >= 6000) {
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