const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment');
const CachedMessages = {}
const tables = [
    {
        id: '343704644712923138',
        parsecurrentweek: 'currentweekparses',
        parsetotal: 'parses'
    },
    {
        id: '701483950559985705',
        parsecurrentweek: 'currentweekparses',
        parsetotal: 'parses'
    },
    {
        id: '708026927721480254',
        parsecurrentweek: 'o3currentweekparses',
        parsetotal: 'o3parses'
    }
]


module.exports = {
    name: 'parsecurrentweek',
    description: 'Updates the parse current week stats or force starts the next week',
    role: 'developer',
    tables: tables,
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
        let leaderLog = guild.channels.cache.get(settings.channels.pastparseweeks)
        if (!leaderLog) return ErrorLogger.log(new Error('parse previous week not found'), bot)
        let currentweekparsename
        for (let i of tables) if (guild.id == i.id) currentweekparsename = i.parsecurrentweek
        if (!currentweekparsename) return
        await this.sendEmbed(leaderLog, db, bot)
        await db.query(`UPDATE users SET ${currentweekparsename} = 0`)
        this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.get(settings.channels.parsecurrentweek)
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot)
    },
    async sendEmbed(channel, db, bot) {
        let settings = bot.settings[channel.guild.id]
        let currentweekparsename
        for (let i of tables) if (channel.guild.id == i.id) currentweekparsename = i.parsecurrentweek
        if (!currentweekparsename) return
        return new Promise(async function (resolve, reject) {
            db.query(`SELECT * FROM users WHERE ${currentweekparsename} != 0`, async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let parses = 0, nonSecParses = 0
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged parses!')
                    .setDescription('None!')
                await rows.sort((a, b) => (parseInt(a[currentweekparsename]) < parseInt(b[currentweekparsename])) ? 1 : -1)
                let index = 0
                let embeds = []
                if(!bot.settings[channel.guild.id].backend.parseResetBiweekly && !bot.settings[channel.guild.id].backend.parseResetMonthly) {
                    let curtime = moment().unix();
                    let utc_days_till_sunday = 7-((Math.floor(curtime/86400)+4)%7);
                    let utc_close_to_next_sunday = curtime + utc_days_till_sunday*86400;
                    let utc_next_sunday = Math.floor(utc_close_to_next_sunday/86400)*86400;
                    let est_next_sunday = utc_next_sunday+18000;
                    fitStringIntoEmbed(embeds,embed,`Quota reset <t:${est_next_sunday}:R>\n`);
                } else if(bot.settings[channel.guild.id].backend.parseResetBiweekly) {
                    let curtime = moment().unix();
                    const day = 60*60*24;
                    const week = day*7;
                    const two_week = week*2;
                    let utc_biweek = Math.floor((curtime-3*day)/two_week);
                    let utc_next_biweek_sunday = utc_biweek*two_week + 3*day + two_week;
                    let est_next_biweek_sunday = utc_next_biweek_sunday + 18000;
                    fitStringIntoEmbed(embeds,embed,`Quota reset <t:${est_next_biweek_sunday}:R>\n`);
                } else if(bot.settings[channel.guild.id].backend.parseResetMonthly) {
                    let today = new Date();
                    let next_month;
                    if(today.getMonth() == 12) {
                        next_month = new Date(today.getFullYear() + 1, 0, 1);
                    } else {
                        next_month = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                    }
                    let next_month_as_unix = ((next_month.getTime()/1000) - 7200).toFixed(0);
                    fitStringIntoEmbed(embeds,embed,'Quota reset <t:'+next_month_as_unix+':R>\n');
                }
                //Timestamp embed end
                for (let i in rows) {
                    let member = channel.guild.members.cache.get(rows[i].id)
                    if (!member) continue
                    if (!member.roles.cache.has(settings.roles.security) && !member.roles.cache.has(settings.roles.officer)) { nonSecParses += rows[i][currentweekparsename]; continue }
                    let string = `**[${index + 1}]** <@!${rows[i].id}>:\nParses: \`${rows[i][currentweekparsename]}\``
                    parses += rows[i][currentweekparsename]
                    fitStringIntoEmbed(embed, string)
                    logged.push(rows[i].id)
                    index++;
                }
                await channel.guild.members.cache.filter(m => m.roles.cache.has(settings.roles.security)).each(m => {
                    let highest = m.roles.highest
                    if (highest.id == settings.roles.security || highest.id == settings.roles.officer)
                        if (!logged.includes(m.id)) {
                            let string = `<@!${m.id}> has not parsed this week`
                            fitStringIntoEmbed(embed, string)
                        }
                })
                embed.setFooter(`${parses} Total Parses, ${nonSecParses} From Non-Security+`)
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
                if (channel.id == settings.channels.parsecurrentweek) {
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
                                CachedMessages[channel.guild.id][i].edit({ embeds: [embeds[i]] })
                            }
                        }
                    } catch (er) { console.log(er) }
                } else for (let i in embeds) channel.send({ embeds: [embeds[i]] })
                resolve(true)
            })
        })
    }
}
