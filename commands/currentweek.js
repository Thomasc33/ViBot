const Discord = require('discord.js')
const logs = require('../data/logInfo.json')
const quotas = require('../data/quotas.json')

module.exports = {
    name: 'currentweek',
    description: 'Check user\'s currentweek quota.',
    args: '[users]',
    alias: ['cw'],
    role: 'eventrl',
    getNotes(guild) {
        return `Types: ${logs[guild.id].main.map(log => log.key + ' (' + log.name + ')').join(', ')}`
    },
    async execute(message, args, bot, db) {
        // get member
        if (args.length == 0) members.push(message.member)

        const members = args.map(arg => message.guild.findMember(arg)).filter(m => m)
        if (members.length == 0) return message.reply('Could not find any user')

        if (!Object.hasOwn(quotas, message.guild.id)) return message.reply('Current week is not set up for this server')
        members.map(async member => {
            const rows = await returnRows(member, db)
            if (!rows) return
            const embed = new Discord.EmbedBuilder()
                .setTitle('Current Week')
                .setDescription(`${member} \`\`${member.displayName}\`\``)
                .setColor('#FF0000')
            quotas[message.guild.id].quotas.forEach(quota => {
                const values = quota.values.map(value => `${value.emoji ? `${value.emoji}` : `${value.name}`}: \`${rows[value.column]}\``)
                const chunks = values.reduce((result, substring) => {
                    if (!result.length || (`${result[result.length - 1]} , ${substring}`).length > 1024) {
                        result.push(substring)
                    } else {
                        result[result.length - 1] += `, ${substring}`
                    }
                    return result
                }, [])
                chunks.map(chunk => embed.addFields({ name: `${quota.name}`, value: chunk, inline: false }))
            })
            message.channel.send({ embeds: [embed] })
        })
    }
}

async function returnRows(member, db) {
    const [rows] = db.promise().query('SELECT * FROM users WHERE id = ?', [member.id])
    return rows[0]
}
