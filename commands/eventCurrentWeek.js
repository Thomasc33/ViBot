const Discord = require('discord.js')
const CachedMessages = {}
const tables = require('../data/currentweekInfo.json').eventcurrentweek

module.exports = {
    name: 'eventcurrentweek',
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
        let leaderLog = guild.channels.cache.get(settings.channels.eventpastweeks)
        if (!leaderLog) return console.log('Channel not found')
        let table = getTable(guild.id)
        if (!table) return
        await this.sendEmbed(leaderLog, db, bot)
        if (!table.dontReset) await db.query(`UPDATE users SET ${table.eventcurrentweek} = 0`)
        this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.get(settings.channels.eventcurrentweek)
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot)
    },
    async sendEmbed(channel, db, bot) {
        let settings = bot.settings[channel.guild.id]
        let table = getTable(channel.guild.id)
        return new Promise(async function (resolve, reject) {
            db.query(`SELECT * FROM users WHERE ${table.eventcurrentweek} != 0`, async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged runs!')
                    .setDescription('None!')
                rows.sort((a, b) => {
                    if (settings.backend.exaltedEvents) {
                        let atot = parseInt(a[table.eventcurrentweek]) + (parseInt(a[table.exaltcurrentweek]) * 2) + (parseInt(a[table.exaltfeedbackcurrentweek]) * 2)
                        let btot = parseInt(b[table.eventcurrentweek]) + (parseInt(b[table.exaltcurrentweek]) * 2) + (parseInt(b[table.exaltfeedbackcurrentweek]) * 2)
                        if (atot < btot) return 1
                        else return -1
                    } else {
                        if (parseInt(a[table.eventcurrentweek]) < parseInt(b[table.eventcurrentweek])) return 1
                        else return -1
                    }
                })
                let index = 0
                let embeds = []
                for (let i of rows) {
                    let string
                    if (settings.backend.exaltedEvents) string = `**[${index + 1}]** <@!${i.id}>: Points: **${parseInt(i[table.eventcurrentweek]) + (parseInt(i[table.exaltcurrentweek]) * 2) + parseInt(i[table.exaltfeedbackcurrentweek]) * 2}**\nMinutes Lead: \`${parseInt(i[table.eventcurrentweek]) * 10}\`, Exalts Lead: \`${i[table.exaltcurrentweek]}\`, Exalt Feedback: \`${i[table.exaltfeedbackcurrentweek]}\``
                    else string = `**[${index + 1}]** <@!${i.id}>:\nMinutes Lead: \`${parseInt(i[table.eventcurrentweek]) * 10}\``
                    fitStringIntoEmbed(embed, string)
                    logged.push(i.id)
                    index++;
                }

                await channel.guild.members.cache.filter(m => m.roles.cache.has(settings.roles.eventrl)).each(m => {
                    if (settings.backend.eventcurrentweekdisplaysalleventrl) {
                        if (!logged.includes(m.id)) fitStringIntoEmbed(embed, `<@!${m.id}> has not logged any runs or been assisted this week`)
                    }
                    else if (m.roles.highest.id == settings.roles.eventrl) {
                        if (!logged.includes(m.id)) fitStringIntoEmbed(embed, `<@!${m.id}> has not logged any runs or been assisted this week`)
                    }
                })
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
                if (channel.id == settings.channels.eventcurrentweek) {
                    try {
                        if (CachedMessages[channel.guild.id] && CachedMessages[channel.guild.id].length > 0) {
                            if (embeds.length !== CachedMessages[channel.guild.id].length) resendMessages()
                            else editMessages()
                        } else gatherMessages()
                        async function resendMessages() {
                            await channel.bulkDelete(20)
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
                            for (let i in CachedMessages[channel.guild.id]) {
                                let t = await CachedMessages[channel.guild.id][i].edit({ embeds: [embeds[i]] }).catch(er => { return { isErrored: true } })
                                if (t.isErrored) { resendMessages(); break; }
                            }
                        }
                    } catch (er) { console.log(er) }
                } else for (let i in embeds) channel.send({ embeds: [embeds[i]] })
                resolve(true)
            })
        })
    }
}

/**
 * 
 * @param {String} guildid 
 */
function getTable(guildid) {
    for (let i of tables) if (i.id == guildid) return i
    return null
}