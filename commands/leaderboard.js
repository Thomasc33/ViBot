const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

const leaderBoardTypes = {
    "343704644712923138": [
        {
            "index": 0,
            "dbNames": ["keypops"],
            "name": "Key Pops"
        },
        {
            "index": 1,
            "dbNames": ["eventpops"],
            "name": "Event Key Pops"
        },
        {
            "index": 2,
            "dbNames": ["cultRuns", "voidRuns"],
            "name": "Total Runs"
        },
        {
            "index": 3,
            "dbNames": ["cultsLead", "voidsLead"],
            "name": "Total Runs Lead"
        },
        {
            "index": 4,
            "dbNames": ["vialUsed"],
            "name": "Vials Used"
        },
        {
            "index": 5,
            "dbNames": ["points"],
            "name": "Points"
        }
    ]
}

module.exports = {
    name: 'leaderboard',
    description: 'Displays leaderboards for different stats on the server',
    alias: ['lb'],
    dms: true,
    dmNeedsGuild: true,
    role: 'raider',
    execute(message, args, bot, db) {
        this.leaderBoardModule(message, bot, db, message.guild)
    },
    async dmExecution(message, args, bot, db, guild) {
        this.leaderBoardModule(message, bot, db, guild)
    },
    async leaderBoardModule(message, bot, db, guild) {
        let embed = new Discord.MessageEmbed()
            .setColor(`#0000ff`)
            .setAuthor(`Select a leaderboard`)
            .setDescription(leaderBoardTypes[guild.id].map(lb => `${numberToEmote(lb.index)} ${lb.name}`).join('\n'))
        if (message.author.avatarURL()) embed.author.iconURL = message.author.avatarURL()
        let embedMessage = await message.channel.send(embed)
        let reacted = false
        let reactionCollector = new Discord.ReactionCollector(embedMessage, (r, u) => u.id == message.author.id && ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '❌'])
        reactionCollector.on('collect', async (r, u) => {
            if (r.emoji.name == '❌') {
                reactionCollector.stop()
                embedMessage.delete()
                return
            }
            let type = leaderBoardTypes[guild.id][emoteToIndex(r.emoji.name)]
            if (!type) return
            reactionCollector.stop();
            reacted = true;
            db.query(`SELECT * FROM users ORDER BY ${type.dbNames.map(n => n).join(' + ')} DESC LIMIT 25`, (err, rows) => {
                if (err) ErrorLogger.log(err, bot)
                embed.author.name = `Top 25 ${type.name}`
                embed.description = 'None!'
                for (let i in rows) {
                    let member = guild.members.cache.get(rows[i].id)
                    let desc = `<@!${rows[i].id}>`
                    if (member && member.nickname) desc += ` \`${member.nickname}\``
                    tot = 0
                    for (let j of rows[i].dbNames) tot = tot + parseInt(rows[i][j])
                    desc += `: \`${tot}\` ${type.name}`
                    fitStringIntoEmbed(embed, desc, message.channel)
                }
                message.channel.send(embed)
                embedMessage.delete()
            })
            for (let i = 0; i < leaderBoardTypes.length; i++) {
                if (reacted) break;
                switch (i) {
                    case 0: await embedMessage.react('1️⃣').catch(er => { }); break;
                    case 1: await embedMessage.react('2️⃣').catch(er => { }); break;
                    case 2: await embedMessage.react('3️⃣').catch(er => { }); break;
                    case 3: await embedMessage.react('4️⃣').catch(er => { }); break;
                    case 4: await embedMessage.react('5️⃣').catch(er => { }); break;
                    case 5: await embedMessage.react('6️⃣').catch(er => { }); break;
                    case 6: await embedMessage.react('7️⃣').catch(er => { }); break;
                    case 7: await embedMessage.react('8️⃣').catch(er => { }); break;
                    case 8: await embedMessage.react('9️⃣').catch(er => { }); break;
                    case 9: await embedMessage.react('🔟').catch(er => { }); break;
                }
            }
            if (!reacted) embedMessage.react('❌').catch(er => { });
        })
    }
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

function numberToEmote(i) {
    switch (i) {
        case 0: return '1️⃣'
        case 1: return '2️⃣'
        case 2: return '3️⃣'
        case 3: return '4️⃣'
        case 4: return '5️⃣'
        case 5: return '6️⃣'
        case 6: return '7️⃣'
        case 7: return '8️⃣'
        case 8: return '9️⃣'
        case 9: return '🔟'
        default: return null
    }
}

function emoteToIndex(emote) {
    switch (emote) {
        case '1️⃣': return 0
        case '2️⃣': return 1
        case '3️⃣': return 2
        case '4️⃣': return 3
        case '5️⃣': return 4
        case '6️⃣': return 5
        case '7️⃣': return 6
        case '8️⃣': return 7
        case '9️⃣': return 8
        case '🔟': return 9
        default: return null
    }
}