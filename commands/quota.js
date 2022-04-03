const Discord = require('discord.js')
const tables = require('../data/currentweekInfo.json').currentweek
const ErrorLogger = require('../lib/logError');
const moment = require('moment')
const quotas = require('../data/quotas.json');
require('../lib/extensions');
const CachedMessages = {}
const excuses = require('./excuse');
const emojiServers = moduleIsAvailable('../data/emojiServers.json') ? require('../data/emojiServers.json') : {}

module.exports = {
        name: 'quota',
        description: 'Updates the current week stats or force starts the next week',
        role: 'developer',
        requiredArgs: 1,
        getNotes(guildid) {
            return `Available Quotas: ${quotas[guildid] && quotas[guildid].quotas.length ? quotas[guildid].quotas.map(q => q.id).join(', ') : 'None'}`;
        },
        async execute(message, args, bot, db) {
            const settings = bot.settings[message.guild.id];
            if (!settings) return;
            const guildQuotas = quotas[message.guild.id];
            if (!guildQuotas) return;
            const quotaList = [];
            do {
                const quotaName = args.shift();
                const list = guildQuotas.quotas.filter(q => q.id == quotaName);
                quotaList.push(...list);
            } while (args.length && guildQuotas.quotas.filter(q => q.id == args[0]).length);
            if (!quotaList.length) {
                return message.channel.send(`Could not find a matching quota`)
            }
            if (!args.length) {
                for (const quota of quotaList)
                    this.sendEmbed(message.channel, db, bot, false, guildQuotas, quota)
                return;
            }
            const cmd = args.shift().toLowerCase();
            for (const quota of quotaList) {
                switch (cmd) {
                    case 'reset':
                        this.newWeek(message.guild, bot, db, settings, guildQuotas, quota);
                        break;
                    case 'update':
                        await this.update(message.guild, db, bot, settings, guildQuotas, quota);
                        message.channel.send(`Current week updated for ${quota.id}`);
                        break;
                    /*case 'fullreset': //DELETE BEFORE
                        this.fullReset(message.guild, db, bot, guildQuotas.quotas);
                        break;
                    case 'test': {
                        let biweekly = false;
                        switch (args.shift().toLowerCase()) {
                            case 'monthly':
                                bot.guilds.cache.each(g => {
                                    if (!emojiServers.includes(g.id)) {
                                        const quotaList = guildQuotas.quotas.filter(q => q.reset == "weekly" || (q.reset == "biweekly" && biweekly));
                                        if (!quotaList.length) return;
                                        for (const q of quotaList)
                                            if (q.reset == "monthly")
                                                this.newWeek(g, bot, bot.dbs[g.id], bot.settings[g.id], guildQuotas, q);
                                    }
                                })
                                break;
                            case 'biweekly':
                                biweekly = !(moment().diff(moment(1413378000), 'week') % 2);
                            case 'weekly':
                                bot.guilds.cache.each(g => {
                                    if (!emojiServers.includes(g.id)) {
                                        const quotaList = guildQuotas.quotas.filter(q => q.reset == "weekly" || (q.reset == "biweekly" && biweekly));
                                        if (!quotaList.length) return;
                        
                                        this.fullReset(g, bot.dbs[g.id], bot, quotaList);
                                    }
                                })
                            break;
                        }
                        break;
                    }*/
                    default:
                        return message.channel.send(`Invalid argument: ${cmd}`);
                }
            }
        },
        async fullReset(guild, db, bot, quotaList) {
            const ignore = await excuses.getIgnore(guild.id, db);
            if (bot.settings[guild.id].backend.sendmissedquota) {
                if (!ignore) {
                    await excuses.calculateMissed(guild, bot, bot.dbs[guild.id], null, true);
                    await excuses.resetExcuses(guild, bot, bot.dbs[guild.id], true);
                }
            }
            for (const quota of quotaList) {
                this.newWeek(guild, bot, bot.dbs[guild.id], bot.settings[guild.id], quotas[guild.id], quota);
            }
            if (ignore)
                db.query(`DELETE FROM ignoreCurrentWeek WHERE guildId = ${guild.id}`)
        },
        async newWeek(guild, bot, db, settings, guildQuotas, quota) {
            const leaderLog = guild.channels.cache.get(settings.channels[quota.pastweeks])
            if (!leaderLog) return console.log('Leader log channel not found');
            await this.sendEmbed(leaderLog, db, bot, true, guildQuotas, quota)
            const rolling = quota.values.filter(v => v.rolling);
            if (rolling.length) {
                const ignore = await excuses.getIgnore(guild.id, db);
                if (ignore)
                    await db.query(`UPDATE users SET ${rolling[0].column} = 0`);
                else {
                    const rlist = quota.roles.map((role, i) => { return { role: guild.roles.cache.get(settings.roles[role]), req: quota.quota[i] } }).sort((a, b) => b.position - a.position)
                    const members_updated = {};
                    for (const { role, req }
                        of rlist) {
                        const ids = [];
                        role.members.forEach(member => {
                            if (members_updated[member.id]) return;
                            members_updated[member.id] = true;
                            ids.push(`'${member.id}'`)
                        })
                        if (ids.length) {
                            const query = `UPDATE users SET ${rolling[0].column} = LEAST(GREATEST(` + quota.values.filter(v => !v.rolling).map(v => `(${v.column}*${v.value})`).join(' + ') + ` - ${req}, 0), ${req}) WHERE id IN (${ids.join(', ')})`;
                            await db.query(query, (err, rows) => { if (err) console.log(err) });
                        }
                    }
                }
            }
            let q = `UPDATE users SET ${quota.values.filter(v => !v.rolling).map(v => `${v.column} = 0`).join(', ')}`
        await db.query(q)
        this.update(guild, db, bot, settings, guildQuotas, quota)
        
    },
    async update(guild, db, bot, settings, guildQuotas, quota) {
        let currentweek = guild.channels.cache.get(settings.channels[quota.currentweek])
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot, false, guildQuotas, quota)
    },
    
    sendEmbed(channel, db, bot, nw, guildQuotas, quota) {
        
        const guild = channel.guild;
        if (!guild) return;
        const settings = bot.settings[guild.id];
        if (!settings) return;
        let csvData = 'Leader ID,Leader Nickname,Currentweek Total,Total\n';
        return new Promise(async (resolve, reject) => {
            let embed = new Discord.MessageEmbed()
                .setColor('#00ff00')
                .setTitle('This weeks current logged runs!')
                .setDescription('None!')
                .setFooter(`##### Total Runs`);
            const embeds = [];
            if (channel.id != settings.channels[quota.pastweeks]) {
                const nextReset = getNextReset(quota.reset);
                if (nextReset)
                    fitStringIntoEmbed(embeds,embed,`Quota reset <t:${nextReset}:R>\n`);
            }
            const combine = quota.values.map(v => `(${v.column}*${v.value})`).join(' + ') + ' as total';
            const unrolled = quota.values.filter(v => !v.rolling).map(v => `(${v.column}*${v.value})`).join(' + ') + ' as unrolled';
            const query = db.query(`SELECT id, ` + quota.values.map(v => v.column).join(', ') + `, ${combine}, ${unrolled} FROM Users WHERE ` + quota.values.map(v => `${v.column} != 0`).join(' OR ') + ` order by total desc`, async (err, rows) => {
                if (err) return reject(err);
                let runCount = 0;
                const roles = quota.roles.map(r => channel.guild.roles.cache.get(settings.roles[r])?.id).filter(r => r);
                const ignore = (guildQuotas.ignoreRoles || []).map(r => settings.roles[r]).filter(r => r);
                for (const idx in rows) {
                    const user = rows[idx];
                    const member = channel.guild.members.cache.get(user.id);
                    if (!member || !member.roles.cache.filter(r => roles.includes(r.id)).size ||
                        member.roles.cache.filter(r => ignore.includes(r.id)).size)
                        continue;
                    csvData += `${user.id},${member?.nickname},${user.unrolled},${user.total}\n`;
                    let result = `**[${parseInt(idx) + 1}]** <@!${user.id}>:\nPoints: \`${user.total}\` (` +
                        quota.values.map(v => `${v.name}: \`${user[v.column]||0}\``).join(', ') + ')';
                    runCount += quota.values.map(v => v.isRun ? user[v.column] : 0).reduce((a, b) => a+b, 0);
                    fitStringIntoEmbed(embeds, embed, result);
                }
                rows = rows.map(r => r.id);
                await channel.guild.members.cache.filter(m => m.roles.cache.filter(r => roles.includes(r.id)).size && !m.roles.cache.filter(r => ignore.includes(r.id)).size).each(m => {
                    if (!rows.includes(m.id)) {
                        csvData += `${m.id},${m.nickname},0,0\n`;
                        fitStringIntoEmbed(embeds, embed, `<@!${m.id}> has not logged any runs or been assisted this week`)
                    }
                })
                embed.setFooter(`${runCount} Total Runs`)
                embeds.push(new Discord.MessageEmbed(embed))

                if (channel.id == settings.channels[quota.currentweek]) {
                    if (!CachedMessages[guild.id]) CachedMessages[guild.id] = [];
                    try {
                        if (CachedMessages[guild.id][quota.id] && CachedMessages[guild.id][quota.id].length > 0) {
                            if (embeds.length !== CachedMessages[guild.id][quota.id].length) resendMessages()
                            else editMessages()
                        } else gatherMessages()
                        async function resendMessages() {
                            try {
                                await channel.bulkDelete(20)
                            } catch (e) {
                                await channel.messages.fetch().then(messages => messages.each(m => m.delete()))
                            }

                            if (CachedMessages[guild.id][quota.id]) CachedMessages[guild.id][quota.id] = []
                            for (let i in embeds) {
                                let m = await channel.send({ embeds: [embeds[i]] })
                                CachedMessages[guild.id][quota.id].shift(m)
                            }
                        }
                        async function gatherMessages() {
                            CachedMessages[guild.id][quota.id] = []
                            
                            let messages = await channel.messages.fetch({ limit: 5 })
                            if (messages.size !== embeds.length) resendMessages()
                            else {
                                messages.forEach(m => CachedMessages[guild.id][quota.id].push(m))
                                editMessages();
                            }
                        }
                        async function editMessages() {
                            for (let i of CachedMessages[guild.id][quota.id]) {
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

function getNextReset(reset) {
    switch (reset) {
        case "weekly": 
            return moment().add(1, 'week').startOf('week').unix();
        case "biweekly":
            if (!(moment().diff(moment(1413378000), 'week') % 2))
                return moment().add(1, 'week').startOf('week').unix();
            return moment().add(2, 'week').startOf('week').unix();
        case "monthly":
            return moment().add(1, 'month').startOf('month').unix();
    }
}

function moduleIsAvailable(path) {
    try {
        require.resolve(path);
        return true;
    } catch (e) {
        return false;
    }
}
