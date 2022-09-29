const Discord = require('discord.js')
const CachedMessages = {}
const tables = require('../data/currentweekInfo.json').eventcurrentweek
const moment = require('moment');

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
                this.newWeek(message.guild, bot, db, true)
                break;
            case 'update':
                this.update(message.guild, db, bot);
                break;
        }
    },
    async newWeek(guild, bot, db, override) {
        let settings = bot.settings[guild.id]
        let leaderLog = guild.channels.cache.get(settings.channels.eventpastweeks)
        if (!leaderLog) return console.log('Channel not found')
        let table = getTable(guild.id)
        if (!table) return
        await this.sendEmbed(leaderLog, db, bot)
        if (override || !table.dontReset) {
            let query = `UPDATE users SET ${table.eventcurrentweek} = 0`;
            if (table.exaltcurrentweek)
                query += `, ${table.exaltcurrentweek} = 0`
            if (table.exaltfeedbackcurrentweek)
                query += `, ${table.exaltfeedbackcurrentweek} = 0`
            await db.query(query)
        }
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
            let query = `SELECT * FROM users WHERE ${table.eventcurrentweek} != 0`
            if (table.exaltcurrentweek)
                query += ` OR ${table.exaltcurrentweek} != 0`
            if (table.exaltfeedbackcurrentweek)
                query += ` OR ${table.exaltfeedbackcurrentweek} != 0`
            db.query(query, async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let embed = new Discord.EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged runs!')
                    .setDescription('None!')
                rows.sort((a, b) => {
                    if (settings.backend.exaltedEvents) {
                        let atot = parseInt(a[table.eventcurrentweek]) + (parseInt(a[table.exaltcurrentweek]) * 1.5) + (parseInt(a[table.exaltfeedbackcurrentweek]) * 1)
                        let btot = parseInt(b[table.eventcurrentweek]) + (parseInt(b[table.exaltcurrentweek]) * 1.5) + (parseInt(b[table.exaltfeedbackcurrentweek]) * 1)
                        if (atot < btot) return 1
                        else return -1
                    } else {
                        if (parseInt(a[table.eventcurrentweek]) < parseInt(b[table.eventcurrentweek])) return 1
                        else return -1
                    }
                })
                let index = 0
                let embeds = []
                if(!bot.settings[channel.guild.id].backend.eventResetBiweekly && !bot.settings[channel.guild.id].backend.eventResetMonthly) {
                    let curtime = moment().unix();
                    let utc_days_till_sunday = 7-((Math.floor(curtime/86400)+4)%7);
                    let utc_close_to_next_sunday = curtime + utc_days_till_sunday*86400;
                    let utc_next_sunday = Math.floor(utc_close_to_next_sunday/86400)*86400;
                    let est_next_sunday = utc_next_sunday+18000;
                    fitStringIntoEmbed(embed,`Quota reset <t:${est_next_sunday}:R>\n`);
                } else if(bot.settings[channel.guild.id].backend.eventResetBiweekly) {
                    let curtime = moment().unix();
                    const day = 60*60*24;
                    const week = day*7;
                    const two_week = week*2;
                    let utc_biweek = Math.floor((curtime-18000-3*day-week)/two_week);
                    let utc_next_biweek_sunday = utc_biweek*two_week + 3*day + week + two_week;
                    let est_next_biweek_sunday = utc_next_biweek_sunday + 18000 - 60*60;
                    fitStringIntoEmbed(embed,`Quota reset <t:${est_next_biweek_sunday}:R>\n`);
                } else if(bot.settings[channel.guild.id].backend.eventResetMonthly) {
                    let today = new Date();
                    let next_month;
                    if(today.getMonth() == 12) {
                        next_month = new Date(today.getFullYear() + 1, 0, 1);
                    } else {
                        next_month = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                    }
                    let next_month_as_unix = ((next_month.getTime()/1000) - 7200).toFixed(0);
                    fitStringIntoEmbed(embed,'Quota reset <t:'+next_month_as_unix+':R>\n');
                }
                //Timestamp embed end
                for (let i of rows) {
                    let string
                    if (settings.backend.exaltedEvents) string = `**[${index + 1}]** <@!${i.id}>: Points: **${parseInt(i[table.eventcurrentweek]) + (parseInt(i[table.exaltcurrentweek]) * 1.5) + parseInt(i[table.exaltfeedbackcurrentweek]) * 1}**\nMinutes Lead: \`${parseInt(i[table.eventcurrentweek]) * 10}\`, Exalts Lead: \`${i[table.exaltcurrentweek]}\`, Exalt Feedback: \`${i[table.exaltfeedbackcurrentweek]}\``
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
                embeds.push(new Discord.EmbedBuilder(embed))
                function fitStringIntoEmbed(embed, string) {
                    if (embed.data.description == 'None!') embed.setDescription(string)
                    else if (embed.data.description.length + `\n${string}`.length >= 2048) {//change to 2048
                        if (!embed.data.fields) embed.addFields({ name: '-', value: string })
                        else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) { //change to 1024
                            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {//change back to 6k
                                embeds.push(new Discord.EmbedBuilder(embed))
                                embed.setDescription('None!')
                                embed.data.fields = []
                            } else embed.addFields({ name: '-', value: string })
                        } else {
                            if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) { //change back to 6k
                                embeds.push(new Discord.EmbedBuilder(embed))
                                embed.setDescription('None!')
                                embed.data.fields = []
                            } else embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
                        }
                    } else embed.setDescription(embed.data.description.concat(`\n${string}`))
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
