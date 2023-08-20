const Discord = require('discord.js');
const logs = require('../data/logInfo.json');
const quotas = require('../data/quotas.json');

module.exports = {
    name: 'currentweek',
    description: 'Check user\'s currentweek quota.',
    args: '[users]',
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
            let rows = await returnRows(member, db)
            if (!rows) return
            let embed = new Discord.EmbedBuilder()
                .setTitle('Current Week')
                .setDescription(`${member} \`\`${member.displayName}\`\``)
                .setColor('#FF0000')
             await quotas[message.guild.id].quotas.map(quota => {
                embed.addFields({
                    name: `${quota.name}`,
                    value: `(${quota.values.map(value => `${value.emoji ? `${value.emoji}` : `${value.name}`}: \`${rows[value.column]}\``).join(', ')})`,
                    inline: false
                })
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