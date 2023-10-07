const Discord = require('discord.js');
const logs = require('../data/logInfo.json');
const quotas = require('../data/quotas.json');

module.exports = {
    name: 'currentweek',
    description: 'Check user\'s currentweek quota.',
    args: '[users]',
    alias: ['cw'],
    role: 'eventrl',
    getNotes(guild, member, bot) {
        return `Types: ${logs[guild.id].main.map(log => log.key + ' (' + log.name + ')').join(', ')}`
    },
    async execute(message, args, bot, db) {
        //get member
        let members = []
        if (args.length == 0) members.push(message.member)
        for (let i in args) {
            let member = message.guild.findMember(args[i])
            if (!member) continue
            members.push(member)
        }
        if (members.length == 0) return message.reply('Could not find any user')

        if (!quotas.hasOwnProperty(message.guild.id)) return message.reply('Current week is not set up for this server')
        members.map(async member => {
            const rows = await returnRows(member, db)
            if (!rows) return
            const embed = new Discord.EmbedBuilder()
                .setTitle('Current Week')
                .setDescription(`${member} \`\`${member.displayName}\`\``)
                .setColor('#FF0000')
            await quotas[message.guild.id].quotas.map(quota => {
                const values = quota.values.map(value => `${value.emoji ? `${value.emoji}` : `${value.name}`}: \`${rows[value.column]}\``)
                const chunks = values.reduce((result, substring) => {
                    if (!result.length || (`${result[result.length - 1]} , ${substring}`).length > 1024) {
                        result.push(substring);
                    } else {
                        result[result.length - 1] += `, ${substring}`
                    }
                    return result
                }, [])
                chunks.map(chunk => embed.addFields({ name: `${quota.name}`, value: chunk, inline: false}))
            })
            await message.channel.send({ embeds: [embed] })
        })
    }
}

async function returnRows(member, db) {
    return new Promise(async (res, rej) => {
        db.query(`SELECT * FROM users WHERE id = '${member.id}'`, (err, rows) => {
            if (err) return rej(err)
            if (rows.length == 0) {
                res(undefined)
            } else {
                res(rows[0])
            }
        })
    })
}