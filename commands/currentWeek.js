const Discord = require('discord.js')
const tables = require('../data/currentweekInfo.json').currentweek
const ErrorLogger = require('../lib/logError');
const quotas = require('../data/quotas.json');
require('../lib/extensions');
const CachedMessages = {}
const excuses = require('./excuse');
module.exports = {
    name: 'currentweek',
    description: 'Updates the current week stats or force starts the next week',
    role: 'developer',
    async execute(message, args, bot, db) {
        if (args.length == 0) {
            this.sendEmbed(message.channel, db, bot)
            return;
        }
        switch (args.shift().toLowerCase()) {
            case 'reset':
                this.newWeek(message.guild, bot, db)
                break;
            case 'update':
                this.update(message.guild, db, bot);
                break;
            case 'fullreset':
                this.fullReset(message.guild, db, bot, true);
                break;
        }
    },
    async fullReset(guild, db, bot, doNewWeek) {
        const ignore = await excuses.getIgnore(guild.id, db);
        if (bot.settings[guild.id].backend.sendmissedquota) {
            if (!ignore) {
                await excuses.calculateMissed(guild, bot, bot.dbs[guild.id], null, true);
                await excuses.resetExcuses(guild, bot, bot.dbs[guild.id], true);
            } 
        }
        if (doNewWeek)
            this.newWeek(guild, bot, bot.dbs[guild.id]);
        if (ignore)
            db.query(`DELETE FROM ignoreCurrentWeek WHERE guildId = ${guild.id}`)

    },
    async newWeek(guild, bot, db) {
        const settings = bot.settings[guild.id];
        if (!settings) return;
        const guildQuotas = quotas[guild.id];
        if (!guildQuotas) return;
        const raidingQuotas = guildQuotas.quotas.filter(q => q.id == "raiding");
        if (!raidingQuotas.length) return;
        const quota = raidingQuotas[0];
        let leaderLog = guild.channels.cache.get(settings.channels.pastweeks)
        if (!leaderLog) return console.log('Channel not found');
        await this.sendEmbed(leaderLog, db, bot, true)
        const rolling = quota.values.filter(v => v.rolling);
        if (rolling.length)
        {
            const ignore = await excuses.getIgnore(guild.id, db);
            
            const query = `UPDATE users SET ${rolling[0].column} = GREATEST(` + quota.values.filter(v => !v.rolling).map(v => `(${v.column}*${v.value})`).join(' + ') + ' - ' + quota.quota + ', 0)';
            
            await db.query(ignore ? `UPDATE users SET ${rolling[0].column} = 0` : query ,(err, rows) => { console.log(err) });
        }
        let q = `UPDATE users SET ${quota.values.filter(v => !v.rolling).map(v => `${v.column} = 0`).join(', ')}`
        await db.query(q)
        this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.get(settings.channels.currentweek)
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot)
    },
    sendEmbed(channel, db, bot, nw) {
        const guild = channel.guild;
        if (!guild) return;
        const settings = bot.settings[guild.id];
        if (!settings) return;
        const guildQuotas = quotas[guild.id];
        if (!guildQuotas) return;
        const raidingQuotas = guildQuotas.quotas.filter(q => q.id == "raiding");
        if (!raidingQuotas.length) return;

        const quota = raidingQuotas[0];
        let csvData = 'Leader ID,Leader Nickname,Total\n';
        return new Promise(async (resolve, reject) => {
            let embed = new Discord.MessageEmbed()
                .setColor('#00ff00')
                .setTitle('This weeks current logged runs!')
                .setDescription('None!')
                .setFooter(`##### Total Runs`);
            const embeds = [];
            const combine = quota.values.map(v => `(${v.column}*${v.value})`).join(' + ') + ' as total';
            const query = db.query(`SELECT id, ` + quota.values.map(v => v.column).join(', ') + `, ${combine} FROM Users WHERE ` + quota.values.map(v => `${v.column} != 0`).join(' OR ') + ` order by total desc`, async (err, rows) => {
                if (err) return reject(err);
                let runCount = 0;
                for (const idx in rows) {
                    const user = rows[idx];
                    csvData += `${user.id},${channel.guild.members.cache.get(user.id)?.nickname},${user.total}\n`;
                    let result = `**[${parseInt(idx) + 1}]** <@!${user.id}>:\nRaids: \`${user.total}\` (` +
                        quota.values.map(v => `${v.name}: \`${user[v.column]||0}\``).join(', ') + ')';
                    runCount += quota.values.map(v => v.isRun ? user[v.column] : 0).reduce((a, b) => a+b, 0);
                    fitStringIntoEmbed(embeds, embed, result);
                }

                rows = rows.map(r => r.id);
                await channel.guild.members.cache.filter(m => m.roles.cache.has(settings.roles.almostrl) || m.roles.cache.has(settings.roles.rl)).each(m => {
                    if (!rows.includes(m.id)) {
                        csvData += `${m.id},${m.nickname},0\n`;
                        fitStringIntoEmbed(embeds, embed, `<@!${m.id}> has not logged any runs or been assisted this week`)
                    }
                })
                embed.setFooter(`${runCount} Total Runs`)
                embeds.push(new Discord.MessageEmbed(embed))

                if (channel.id == settings.channels.currentweek) {
                    try {
                        if (CachedMessages[guild.id] && CachedMessages[guild.id].length > 0) {
                            if (embeds.length !== CachedMessages[guild.id].length) resendMessages()
                            else editMessages()
                        } else gatherMessages()
                        async function resendMessages() {
                            try {
                                await channel.bulkDelete(20)
                            } catch (e) {
                                await channel.messages.fetch().then(messages => messages.each(m => m.delete()))
                            }
                            if (CachedMessages[guild.id]) CachedMessages[guild.id] = []
                            for (let i in embeds) {
                                let m = await channel.send({ embeds: [embeds[i]] })
                                CachedMessages[guild.id].shift(m)
                            }
                        }
                        async function gatherMessages() {
                            CachedMessages[guild.id] = []
                            let messages = await channel.messages.fetch({ limit: 5 })
                            if (messages.size !== embeds.length) resendMessages()
                            else {
                                messages.forEach(m => CachedMessages[guild.id].push(m))
                                editMessages();
                            }
                        }
                        async function editMessages() {
                            for (let i of CachedMessages[guild.id]) {
                                if (embeds.length == 0) {
                                    i.delete()
                                    delete i
                                }
                                i.edit({ embeds: [embeds.pop()] })
                            }
                        }
                    } catch (er) { console.log(er) }
                } else for (let i in embeds) channel.send({ embeds: [embeds[i]] })
                if (nw) 
                    channel.send({ files: [new Discord.MessageAttachment(Buffer.from(csvData, "utf-8"),"currentweekResetData.csv")] })
                resolve(true);
            });
        });
    }
}

function fitStringIntoEmbed(embeds, embed, string) {
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

function cleanString(str) {
    switch (str) {
        case 'currentweekCult': return 'Cults'
        case 'currentweekVoid': return 'Voids'
        case 'currentweekAssists': return 'Assists'
        case 'currentweekFeedback': return 'Feedback'
        case 'currentweeko3': return 'Oryx Runs'
        case 'currentweeko3Feedback': return 'Feedback'
        case 'currentweekAssistso3': return 'Assists'
        default:
            return str.replace('currentweek', '')
    }
}