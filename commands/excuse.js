const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const quotas = require('../data/quotas.json');
const { handler } = require('../lib/realmEyeScrape');
import ('../lib/types.js')
module.exports = {
    name: 'excuse',
    role: 'headrl',
    description: `\`list [names/ids...]\` - List excuses for mentioned names. If no names mentioned, lists everyone with an excuse for this week.
                  \`add <name/id> [reason] [image]\` - Add an excuse for a staff member.
                  \`remove <names/ids...>\` - Removes the listed members' excuses.
                  \`display\` - Forces the display of missed quota embeds into the activity log channel. This will not reset them.
                  \`resetall\` - Resets all excuses. This will not change the time they reset at weekly and will not archive the excuses removed.`,
    requiredArgs: 1,
    guildSpecific: true,
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const action = args.shift().toLowerCase();
        switch (action) {
            case 'list':
                if (!args.length)
                    this.listAll(message, args, bot, db);
                else
                    this.listUsers(message, args, bot, db);
                break;
            case 'add':
                this.addExcuse(message, args, bot, db);
                break;
            case 'remove':
                this.removeExcuse(message, args, bot, db);
                break;
            case 'display':
                this.calculateMissed(message.guild, bot, db, message.channel);
                break;
            case 'resetall':
                this.resetExcuses(message.guild, bot, db, true);
                break;
            case 'ignore':
                this.ignore(message, args, bot, db);
                break;
            case 'unignore':
                this.unignore(message, args, bot, db);
                break;
            case 'isignored':
                this.isignored(message, args, bot, db);
                break;
            default:
                return message.channel.send('Invalid arguments: `;excuse <list/remove> [names/ids] | <add> <name/id> <reason> [image]`');
        }
    },
    async getIgnore(guildId, db) {
        return new Promise(res => {
            db.query(`SELECT * FROM ignoreCurrentWeek WHERE guildId = '${guildId}'`, (err, rows) => {
                res(rows && rows.length ? rows[0] : null);
            })
        })
    },
    async isignored(message, args, bot, db) {
        const ignore = await this.getIgnore(message.guild.id, db);
        let embed = new Discord.MessageEmbed()
            .setAuthor(`Ignore Current Week`)
            .setTitle(ignore ? `Currently Ignored` : `Currently Active`)
            .setDescription(ignore ? ignore.reason : `To ignore the current week, use \`;excuse ignore [reason]\`.`);
        message.channel.send({ embeds: [embed] });
    },
    async ignore(message, args, bot, db) {
        const ignore = await this.getIgnore(message.guild.id, db);
        let embed = new Discord.MessageEmbed()
            .setAuthor(`Ignore Current Week`);
        if (ignore) {
            embed.setDescription(`Current week is already ignored: \`\`\`${ignore.reason}\`\`\``)
        } else {
            await db.query(`INSERT INTO ignoreCurrentWeek (guildId, reason) VALUES ('${message.guild.id}', ?)`, [args.join(' ')]);
            embed.setDescription(`Current week has been ignored for the following reason: \`\`\`${args.join(' ')}\`\`\``)
                .setColor("#00FF00");
        }

        message.channel.send({ embeds: [embed] })
    },
    async unignore(message, args, bot, db) {
        const ignore = await this.getIgnore(message.guild.id, db);
        let embed = new Discord.MessageEmbed()
            .setAuthor(`Ignore Current Week`);
        if (!ignore) {
            embed.setDescription(`Current week is not currently ignored.`)
        } else {
            await db.query(`DELETE FROM ignoreCurrentWeek WHERE guildId = '${message.guild.id}'`);
            embed.setDescription(`Current week has been unignored. It was previously ignored for the following reason: \`\`\`${ignore.reason}\`\`\``)
                .setColor("#00FF00");
        }
        message.channel.send({ embeds: [embed] })

    },
    async listAll(message, args, bot, db) {
        db.query(`SELECT * FROM excuses where guildid = '${message.guild.id}''`, async(err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            let embed = new Discord.MessageEmbed()
                .setTitle(`Excused Staff`)
                .setDescription('None!')
            for (let i in rows) {
                fitStringIntoEmbed(embed, `<@${rows[i].id}>`, message.channel, ', ')
            }
            message.channel.send({ embeds: [embed] })
        });
    },
    async listUsers(message, args, bot, db) {
        const unfound = [];
        let members = args.map(a => {
            const member = message.guild.findMember(a);
            if (!member) unfound.push(a);
            return member;
        }).filter(m => m).map(m => m.id);
        db.query(`SELECT * FROM excuses WHERE id IN (${members.map(a => "'" + a + "'").join(', ')}) AND guildid = '${message.guild.id}'`, async(err, rows) => {
            if (err) ErrorLogger.log(err, bot);
            let embed = new Discord.MessageEmbed()
                .setTitle(`Excused Staff`);
            if (!rows || !rows.length)
                message.channel.send({ embeds: [embed.setDescription('None!')] });
            const guild = bot.guilds.cache.get(message.guild.id);
            for (const row of rows) {
                const member = guild.members.cache.get(row.id);
                if (!member)
                    continue;
                const modmember = guild.members.cache.get(row.modid);
                embed.fields = [];
                embed.addField("Staff Member", `<@${row.id}> \`${member.nickname || member.user.tag}\``)
                    .addField("Excused By", `<@${row.modid}> \`${modmember.nickname || modmember.user.tag}\``)
                    .addField("Reason", row.reason ? row.reason : "None");
                if (row.image)
                    embed.setImage(row.image);
                message.channel.send({ embeds: [embed] });
            }
            rows.forEach(row => members = members.filter(m => m != row.id));
            if (members.length) {
                message.channel.send({
                    embeds: [
                        new Discord.MessageEmbed()
                        .setTitle("Excuse List")
                        .setDescription(`The following members did not have excuses:\n${members.map(m => "<@" + m + ">").join(', ')}`)
                    ]
                })
            }
            if (unfound.length) {
                message.channel.send({
                    embeds: [
                        new Discord.MessageEmbed()
                        .setTitle("Excuse List")
                        .setDescription(`Could not find the following members:\`\`\`\n${unfound.join(', ')}\`\`\``)
                    ]
                })
            }
        })
    },
    async addExcuse(message, args, bot, db) {
        if (!args.length) return message.channel.send(`Please specify a user`)
        const id = args.shift();
        const member = message.guild.findMember(id);
        if (!member)
            return message.channel.send(`Could not find member: \`${id}\``)
        const img = message.attachments.size ? `'${message.attachments.first().proxyURL}'` : null;
        db.query(`INSERT INTO excuses (id, modid, guildid, reason, image) 
                  VALUES (${db.escape(member.id)}, '${message.author.id}', '${message.guild.id}', ${db.escape(args.join(' ') || 'No reason provided.')}, ${img}) 
                  as e(id, modid, reason, guildid, image)
                  on duplicate key update modid = e.modid, reason = e.reason, image = e.image`, (err) => {
            if (err) {
                ErrorLogger.log(err, bot);
                message.channel.send(`Error adding excuse for \`${id}\`: ${err.message}`);
            } else
                message.react('✅');
        });
    },
    async removeExcuse(message, args, bot, db) {
        if (!args.length) return message.channel.send(`Please specify a user`)
        const unfound = [];

        let members = args.map(a => {
            const m = message.guild.findMember(a);
            if (!m) unfound.push(a);
            return m
        }).filter(m => m).map(m => m.id);

        db.query(`SELECT * FROM excuses WHERE id IN (${members.map(m => "'" + m + "'").join(", ")}) and guildid = '${message.guild.id}'`, (err, rows) => {
            rows.forEach(row => members = members.filter(m => m != row.id));
            db.query(`DELETE FROM excuses WHERE id IN (${rows.map(m => "'" + m.id + "'").join(", ")}) and guildid = '${message.guild.id}'`, (e, r) => {
                if (rows.length) {
                    message.channel.send({
                        embeds: [
                            new Discord.MessageEmbed()
                            .setTitle("Excuse Removal")
                            .setDescription(`The following members have had their excuses removed:\n${rows.map(m => "<@" + m.id + ">").join(', ')}`)
                        ]
                    })
                }
                if (members.length) {
                    message.channel.send({
                        embeds: [
                            new Discord.MessageEmbed()
                            .setTitle("Excuse Removal")
                            .setDescription(`The following members did not have excuses:\n${members.map(m => "<@" + m + ">").join(', ')}`)
                        ]
                    })
                }
                if (unfound.length) {
                    message.channel.send({
                        embeds: [
                            new Discord.MessageEmbed()
                            .setTitle("Excuse Removal")
                            .setDescription(`Could not find the following members:\`\`\`\n${unfound.join(', ')}\`\`\``)
                        ]
                    })
                }
            })
        })
    },
    async resetExcuses(guild, bot, db, reset) {
        if (reset) {
            const settings = bot.settings[guild.id];
            const guildQuota = quotas[guild.id];
            if (!guildQuota) return;
            const unmet_quotas = await this.getMissed(guild, bot, db, guildQuota, settings);
            const excused = Object.values(unmet_quotas)
                .filter(u => u.leave || u.excuse || !u.quotas.length || u.met.length)
                .map(l => `'${l.member.id}'`);
            const leave = Object.values(unmet_quotas)
                .filter(u => u.leave)
                .map(u => `'${u.member.id}'`);
            const unexcused = Object.values(unmet_quotas)
                .map(u => `'${u.member.id}'`)
                .filter(u => !excused.includes(u));
            const check = leave.length ? `id IN (${leave.join(', ')})` : 'false';
            await db.query(`UPDATE users SET ${guildQuota.consecutiveLeave} = IF(${check}, ${guildQuota.consecutiveLeave} + 1, 0)`)
            if (excused.length)
                await new Promise(res => db.query(`UPDATE users SET ${guildQuota.consecutiveUnexcused} = 0 WHERE id IN (${excused.join(', ')})`, () => res()))
            if (unexcused.length)
                await new Promise(res => db.query(`UPDATE users SET ${guildQuota.consecutiveUnexcused} = ${guildQuota.consecutiveUnexcused}+1, ${guildQuota.totalUnexcused} = ${guildQuota.totalUnexcused}+1 WHERE id IN (${unexcused.join(', ')})`, () => res()))
            await new Promise(res => db.query(`insert into archivedExcuses select *, current_date() as archivedOn from excuses where guildid = '${guild.id}'`, () => res()));
        }
        db.query(`delete from excuses where guildid = '${guild.id}'`, e => {
            if (e) ErrorLogger.log(e, bot);
        })
    },
    /**
     * 
     * @param {Discord.Guild} guild 
     * @param {Discord.Client} bot 
     * @param {import('mysql').Connection} db 
     * @param {GuildQuota} guildQuota 
     * @param {*} settings 
     * @returns {Promise<MemberQuota>}
     */
    async getMissed(guild, bot, db, guildQuota, settings) {
        return new Promise((res, rej) => {
            const unmet = {};
            db.query(`select u.*, e.reason as reason, e.image as image, e.modid as modid from users u left join excuses e on u.id = e.id where e.guildid is null or e.guildid = '${guild.id}'`, (err, rows) => {
                if (err) ErrorLogger.log(err, bot);
                if (!rows || !rows.length) { return res({}); }
                for (const row of rows) {
                    const member = guild.members.cache.get(row.id);
                    if (!member) continue;
                    for (const quota of guildQuota.quotas) {
                        const roles = quota.roles.map(role => guild.roles.cache.get(settings.roles[role]));
                        const ignore = (guildQuota.ignoreRoles || []).map(r => settings.roles[r]).filter(r => r);
                        if (!member.roles.cache.filter(r => roles.includes(r)).size ||
                            member.roles.cache.filter(r => ignore.includes(r.id)).size) continue;
                        if (!unmet[member.id])
                            unmet[member.id] = {
                                member,
                                quotas: [],
                                met: [],
                                consecutive: parseInt(row[guildQuota.consecutiveUnexcused]) + 1,
                                totalMissed: parseInt(row[guildQuota.totalUnexcused]),
                                consecutiveLeave: parseInt(row[guildQuota.consecutiveLeave])
                            };
                        let total = 0;
                        for (const type of quota.values) {
                            total += (row[type.column] || 0) * type.value;
                        }
                        if (quota.specialEvents) {
                            for (const event of quota.specialEvents) {
                                if (settings.lists.runningEvents.includes(event.name)) {
                                    for (const type of event.values) {
                                        total += (row[type.column] || 0) * type.value;
                                    }
                                }
                            }
                        }
                        if (total < quota.quota) {
                            if (unmet[member.id].leave) continue;
                            if (settings.roles.lol && member.roles.cache.has(settings.roles.lol)) {
                                unmet[member.id].leave = true;
                                unmet[member.id].excuse = {
                                    modid: bot.user.id,
                                    reason: `Had the <@&${settings.roles.lol}> role at reset.`
                                }
                            }

                            if (!unmet[member.id].excuse && row.modid) {
                                unmet[member.id].excuse = {
                                    modid: row.modid,
                                    reason: row.reason,
                                    image: row.image
                                }
                            }
                            if (!unmet[member.id].update) {
                                unmet[member.id].update = `('${row.id}', '${guild.id}', current_date())`;
                            }
                            const issue = {
                                name: quota.name,
                                total,
                                values: quota.values.map(v => {
                                    return { name: v.name, value: row[v.column] }
                                })
                            }

                            if (quota.specialEvents) {
                                for (const event of quota.specialEvents) {
                                    if (settings.lists.runningEvents.includes(event.name)) {
                                        issue.values = issue.values.concat(event.values.map(v => {
                                            return { name: v.name, value: row[v.column] }
                                        }))
                                    }
                                }
                            }
                            unmet[member.id].quotas.push(issue);
                        } else {
                            unmet[member.id].met.push(quota);
                        }
                    }
                }
                res(unmet);
            });
        });
    },
    async getEligible(guild, bot, db, guildQuota, settings) {
        return new Promise((res, rej) => {
            const votes = {};
            for (const quota of guildQuota.quotas) {
                if (!quota.voteInfo) continue;
                const roles = quota.voteInfo.roles.map(r => settings.roles[r]).map(r => guild.roles.cache.get(r)).filter(r => r);
                if (!roles.length) continue;
                db.query(`select id, ${quota.voteInfo.runsDone.map(rd => rd.column).join(', ')}, ${quota.consecutiveHit} from users where ${quota.voteInfo.runsDone.map(rd => rd.column + ' >= ' + rd.count).join(' OR ')} ${quota.voteInfo.consecutive ? 'OR ' + quota.consecutiveHit + ' >= ' + quota.voteInfo.consecutive : ''}`, (err, rows) => {
                    if (!rows || !rows.length) return res(votes);
                    for (const row of rows) {
                        if (!votes[row.id]) votes[row.id] = []

                    }
                })
            }
        })
    },
    async calculateMissed(guild, bot, db, channel, reset) {
        const settings = bot.settings[guild.id];
        if (!settings || !settings.backend.sendmissedquota) return;
        const activitylog = channel ? channel : guild.channels.cache.get(settings.channels.activitylog);
        if (!activitylog) return;
        const guildQuota = quotas[guild.id];
        if (!guildQuota) return;
        const unmet_quotas = await this.getMissed(guild, bot, db, guildQuota, settings);
        const unexcused = [];
        const keys = Object.values(unmet_quotas).filter(i => !i.leave && i.quotas.length);
        const header = new Discord.MessageEmbed()
            .setAuthor(`Weekly Quotas`)
            .setDescription(`${keys.length} members have missed quota this week.`)
            .setColor('#0000ff');
        activitylog.send({ embeds: [header] })
        for (const id in unmet_quotas) {
            const issues = unmet_quotas[id];
            if (!issues.quotas.length) continue;
            const embed = new Discord.MessageEmbed()
                .setAuthor(issues.member.nickname || issues.member.user.tag, issues.member.user.displayAvatarURL())
                .setDescription(`Unmet Quota for ${issues.member}`)
                .setColor('#ff0000');
            if (issues.leave) {
                if (issues.consecutiveLeave < 2)
                    continue;
                embed.addField("Consecutive Leave", `${issues.consecutiveLeave} weeks`, true);
            }
            embed.addField("Total Unexcused", `${issues.totalMissed + (issues.excuse ? 0 : 1)}`, true);
            embed.addField("Consecutive Unexcused", `${issues.excuse ? 0 : issues.consecutive}`, true);
            for (const issue of issues.quotas) {
                embed.addField(issue.name, `\`\`\`\nTotal: ${issue.total}\n${issue.values.map(v => v.name + ": " + v.value).join(", ")}\`\`\``)
            }
            if (issues.excuse) {
                embed.addField("Excused By", `<@${issues.excuse.modid}>`);
                embed.addField("Reason", `${issues.excuse.reason}`);
                if (issues.excuse.image)
                    embed.setImage(issues.excuse.image);
                embed.setColor('#00ff00')
            }
            if (issues.met.length) {
                embed.addField("Met Quotas", issues.met.map(m => m.name).join(", "));
                if (!issues.excuse)
                    embed.setColor("#FFC100");
            }
            if (!issues.excuse) unexcused.push(id);
            try {
                activitylog.send({ embeds: [embed] })
            } catch (e) { ErrorLogger.log(e); }

        }
    }
}

function fitStringIntoEmbed(embed, string, channel, join) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + `${join}${string}`.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + `${join}${string}`.length >= 1024) {
            if (embed.length + `${join}${string}`.length >= 6000) {
                try {
                    channel.send({ embeds: [embed] })
                } catch (e) { ErrorLogger.log(e); }
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + `${join}${string}`.length >= 6000) {
                try {
                    channel.send({ embeds: [embed] })
                } catch (e) { ErrorLogger.log(e); }
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`${join}${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`${join}${string}`))
    }
}