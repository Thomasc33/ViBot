const Discord = require('discord.js')
const tables = require('../data/currentweekInfo.json').currentweek

const CachedMessages = {}

module.exports = {
    name: 'currentweek',
    description: 'Updates the current week stats or force starts the next week',
    role: 'developer',
    async execute(message, args, bot, db) {
        if (args.length == 0) {
            this.sendEmbed(message.channel, db, bot)
            return;
        }
        switch (args[0].toLowerCase()) {
            case 'reset':
                this.newWeek(message.guild, bot, db)
                break;
            case 'update':
                this.update(message.guild, db, bot);
                break;
        }
    },
    async newWeek(guild, bot, db) {
        let settings = bot.settings[guild.id]
        let dungeon
        for (let i of tables) if (i.id == guild.id) dungeon = i;
        if (!dungeon) return
        let leaderLog = guild.channels.cache.get(settings.channels.pastweeks)
        if (!leaderLog) return console.log('Channel not found');
        await this.sendEmbed(leaderLog, db, bot)
        let q = `UPDATE users SET ${dungeon.runs.join(' = 0, ')} = 0, ${dungeon.assists.join(' = 0, ')} = 0`
        await db.query(q)
        this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.get(settings.channels.currentweek)
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot)
    },
    async sendEmbed(channel, db, bot) {
        let settings = bot.settings[channel.guild.id]
        let info
        for (let i of tables) {
            if (channel.guild.id == i.id) info = i
        }
        if (!info) return
        return new Promise(async function (resolve, reject) {
            let query1 = `SELECT * FROM users WHERE `
            for (let i of info.runs) query1 += `${i} != 0 OR `
            for (let i of info.assists) query1 += `${i} != 0 OR `
            db.query(query1.substring(0, query1.length - 3), async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let runs = 0
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged runs!')
                    .setDescription('None!')
                    .setFooter(`##### Total Runs`)
                rows.sort((a, b) => {
                    let aTot = 0, bTot = 0;
                    for (let i of info.runs) {
                        aTot += a[i]
                        bTot += b[i]
                    }
                    for (let i of info.assists) {
                        aTot += a[i] / 2
                        bTot += b[i] / 2
                    }
                    return (aTot < bTot) ? 1 : -1
                })
                let index = 0
                let embeds = []
                for (let i of rows) {
                    let runTot = 0
                    for (let j of info.runs) runTot += parseInt(i[j])
                    runs += runTot
                    for (let j of info.assists) runTot += parseInt(i[j]) / 2
                    let string = `**[${index + 1}]** <@!${i.id}>:\nRaids: \`${runTot}\` (`
                    for (let j of info.runs) string += `${cleanString(j)}: \`${i[j]}\`, `
                    for (let j of info.assists) string += `${cleanString(j)}: \`${i[j]}\`, `
                    string = string.substring(0, string.length - 2)
                    string += ')'
                    fitStringIntoEmbed(embed, string)
                    logged.push(i.id)
                    index++;
                }
                await channel.guild.members.cache.filter(m => m.roles.cache.has(settings.roles.almostrl) || m.roles.cache.has(settings.roles.rl)).each(m => {
                    if (!logged.includes(m.id)) {
                        let string = `<@!${m.id}> has not logged any runs or been assisted this week`
                        fitStringIntoEmbed(embed, string)
                    }
                })
                embed.setFooter(`${runs} Total Runs`)
                embeds.push(new Discord.MessageEmbed(embed))
                function fitStringIntoEmbed(embed, string) {
                    if (embed.description == 'None!') embed.setDescription(string)
                    else if (embed.description.length + `\n${string}`.length >= 2048) {//change to 2048
                        if (embed.fields.length == 0) embed.addField('-', string)
                        else if (embed.fields[embed.fields.length - 1].value.length + `\n${string}`.length >= 1024) { //change to 1024
                            if (embed.length + `\n${string}`.length >= 6000) {//change back to 6k
                                embeds.push(new Discord.MessageEmbed(embed))
                                embed.setDescription('None!')
                                embed.fields = []
                            } else embed.addField('-', string)
                        } else {
                            if (embed.length + `\n${string}`.length >= 6000) { //change back to 6k
                                embeds.push(new Discord.MessageEmbed(embed))
                                embed.setDescription('None!')
                                embed.fields = []
                            } else embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
                        }
                    } else embed.setDescription(embed.description.concat(`\n${string}`))
                }
                if (channel.id == settings.channels.currentweek) {
                    try {
                        if (CachedMessages[channel.guild.id] && CachedMessages[channel.guild.id].length > 0) {
                            if (embeds.length !== CachedMessages[channel.guild.id].length) resendMessages()
                            else editMessages()
                        } else gatherMessages()
                        async function resendMessages() {
                            try {
                                await channel.bulkDelete(20)
                            } catch (e) {
                                await channel.messages.fetch().then(messages => messages.each(m => m.delete()))
                            }
                            if (CachedMessages[channel.guild.id]) CachedMessages[channel.guild.id] = []
                            for (let i in embeds) {
                                let m = await channel.send({ embeds: [embeds[i]] })
                                CachedMessages[channel.guild.id].shift(m)
                            }
                        }
                        async function gatherMessages() {
                            CachedMessages[channel.guild.id] = []
                            let messages = await channel.messages.fetch({ limit: 5 })
                            if (messages.size !== embeds.length) resendMessages()
                            else {
                                messages.forEach(m => CachedMessages[channel.guild.id].push(m))
                                editMessages();
                            }
                        }
                        async function editMessages() {
                            for (let i of CachedMessages[channel.guild.id]) {
                                if (embeds.length == 0) {
                                    i.delete()
                                    delete i
                                }
                                i.edit({ embeds: [embeds.pop()] })
                            }
                        }
                    } catch (er) { console.log(er) }
                } else for (let i in embeds) channel.send({ embeds: [embeds[i]] })
                resolve(true)
            })
        })
    }
}


function cleanString(str) {
    switch (str) {
        case 'currentweekCult': return 'Cults'
        case 'currentweekVoid': return 'Voids'
        case 'currentweekAssists': return 'Assists'
        case 'currentweekFeedback': return 'Feedback'
        case 'currentweeko3': return 'Oryx Runs'
        case 'currentweeko3Feedback': return 'Feedback'
        case 'currentweekAssistso3': return 'Assists'
        default: return str.replace('currentweek', '')
    }
}