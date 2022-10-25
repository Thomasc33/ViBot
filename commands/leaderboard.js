const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

const leaderBoardTypes = require('../data/leaderBoardInfo.json')

module.exports = {
    name: 'leaderboard',
    description: 'Displays leaderboards for different stats on the server',
    alias: ['lb'],
    dms: true,
    dmNeedsGuild: true,
    role: 'raider',
    execute(message, args, bot, db) {
        if (!leaderBoardTypes[message.guild.id]) return message.channel.send('Leaderboards not setup for this server')
        this.leaderBoardModule(message, bot, db, message.guild)
    },
    async dmExecution(message, args, bot, db, guild) {
        if (!leaderBoardTypes[guild.id]) return message.channel.send('Leaderboards not setup for this server')
        this.leaderBoardModule(message, bot, db, guild)
    },
    async leaderBoardModule(message, bot, db, guild) {
        let embed = new Discord.EmbedBuilder()
            .setColor(`#0000ff`)
            .setAuthor({ name: `Select a leaderboard` })
            .setDescription(leaderBoardTypes[guild.id].map(lb => `${lb.name}`).join('\n'))
        if (message.author.avatarURL()) embed.setAuthor({ name: `Select a leaderboard`, iconURL: message.author.avatarURL() })
        await message.channel.send({ embeds: [embed] }).then(async confirmMessage => {
            const choice = await confirmMessage.confirmList(leaderBoardTypes[guild.id].map(lb => `${lb.name}`), message.author.id)
            if (!choice || choice == 'Cancelled') {
                await message.react('✅');
                return confirmMessage.delete();
            }
            confirmMessage.delete();
            let type = getLeaderboardType(choice, guild.id)
            if (!type) return
            db.query(`SELECT * FROM users ORDER BY ${type.dbNames.map(n => n).join(' + ')} DESC LIMIT 25`, (err, rows) => {
                if (err) ErrorLogger.log(err, bot)
                embed.data.author.name = `Top 25 ${type.name}`
                embed.data.description = 'None!'
                for (let i in rows) {
                    let member = guild.members.cache.get(rows[i].id)
                    let desc = `<@!${rows[i].id}>`
                    if (member && member.nickname) desc += ` \`${member.nickname}\``
                    tot = 0
                    for (let j of type.dbNames) tot = tot + parseInt(rows[i][j])
                    desc += `: \`${tot}\` ${type.name}`
                    fitStringIntoEmbed(embed, desc, message.channel)
                }
                message.channel.send({ embeds: [embed] })
            })
        })
    }
}
function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `\n${string}`.length >= 2048) {
        if (!embed.data.fields) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
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

function getLeaderboardType(option, guildId) {
    for (let i in leaderBoardTypes[guildId]) {
        if (option.toLowerCase() == leaderBoardTypes[guildId][i].name.toLowerCase()) return leaderBoardTypes[guildId][i];
    }
}