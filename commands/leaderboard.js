const Discord = require('discord.js')
const leaderBoardTypes = ['keypops', 'eventpops', 'runs', 'runs lead', 'vialUsed', 'solocult', 'runesused', 'points']
const ErrorLogger = require('../lib/logError')

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
            .setDescription(`1️⃣ Key Pops\n2️⃣ Other Key Pops\n3️⃣ Total Runs\n4️⃣ Runs Lead\n5️⃣ Vials Popped\n6️⃣ Solo Cults\n7️⃣ Runes Used\n8️⃣ Points`)
        if (message.author.avatarURL()) embed.author.iconURL = message.author.avatarURL()
        let embedMessage = await message.channel.send(embed)
        let reacted = false
        let reactionCollector = new Discord.ReactionCollector(embedMessage, (r, u) => !u.bot)
        reactionCollector.on('collect', async (r, u) => {
            switch (r.emoji.name) {
                case '1️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY ${leaderBoardTypes[0]} DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 Key Pops`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].keypops}\` Keys Popped`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                case '2️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY ${leaderBoardTypes[1]} DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 Other Key Pops`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].eventpops}\` Other Key Pops`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                case '3️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY cultRuns + voidRuns DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 Total Runs`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].cultRuns + rows[i].voidRuns}\` Total Runs (\`${rows[i].voidRuns}\` voids, \`${rows[i].cultRuns}\` cults)`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                case '4️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY cultsLead + voidsLead DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 Total Runs Lead`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].cultsLead + rows[i].voidsLead}\` Total Runs (\`${rows[i].voidsLead}\` voids, \`${rows[i].cultsLead}\` cults)`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                case '5️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY ${leaderBoardTypes[4]} DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 Vials Used`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].vialUsed}\` Vials Used`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                case '6️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY ${leaderBoardTypes[5]} DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 Solo Culters`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].solocult}\` Solo Cults`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                case '7️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY ${leaderBoardTypes[6]} DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 Rune Poppers`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].runesused}\` Runes Used`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                case '8️⃣':
                    reactionCollector.stop();
                    reacted = true;
                    db.query(`SELECT * FROM users ORDER BY ${leaderBoardTypes[7]} DESC LIMIT 25`, (err, rows) => {
                        if (err) ErrorLogger.log(err, bot)
                        embed.author.name = `Top 25 in Points`
                        embed.description = 'None!'
                        for (let i in rows) {
                            let member = guild.members.cache.get(rows[i].id)
                            let desc = `<@!${rows[i].id}>`
                            if (member && member.nickname) desc += ` \`${member.nickname}\``
                            desc += `: \`${rows[i].points}\` Points`
                            fitStringIntoEmbed(embed, desc, message.channel)
                        }
                        message.channel.send(embed)
                        embedMessage.delete()
                    })
                    break;
                //case '9️⃣': reactionCollector.stop(); break;
                //case '🔟': reactionCollector.stop(); break;
                case '❌': await embedMessage.delete(); reactionCollector.stop(); break;
                default:
                    let retryMessage = await message.channel.send('There was an issue with the reaction. Please try again');
                    setTimeout(() => { retryMessage.delete() }, 5000)
            }
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