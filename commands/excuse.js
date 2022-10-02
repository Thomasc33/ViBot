const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const quotas = require('../data/quotas.json');
import('../lib/types.js')
module.exports = {
    name: 'excuse',
    role: 'headrl',
    description: `\`list [names/ids...]\` - List excuses for mentioned names. If no names mentioned, lists everyone with an excuse for this week.
                  \`add <name/id> [reason] [image]\` - Add an excuse for a staff member.
                  \`remove <names/ids...>\` - Removes the listed members' excuses.
                  \`display\` - Forces the display of missed quota embeds into the activity log channel. This will not reset them.
                  \`resetall\` - Resets all excuses. This will not change the time they reset at weekly and will not archive the excuses removed.
                  \`ignore [reason]\` - Ignore the current week for the guild. This will stop weeks unexcused from updating and no messages in the activity log will be sent.
                  \`unignore\` - Unignore the current week.
                  \`isignored\` - List the current ignored status for this week.`,
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
        let embed = new Discord.EmbedBuilder()
            .setAuthor({ name: `Ignore Current Week` })
            .setTitle(ignore ? `Currently Ignored` : `Currently Active`)
            .setDescription(ignore ? ignore.reason : `To ignore the current week, use \`;excuse ignore [reason]\`.`);
        message.channel.send({ embeds: [embed] });
    },
    async ignore(message, args, bot, db) {
        const ignore = await this.getIgnore(message.guild.id, db);
        let embed = new Discord.EmbedBuilder()
            .setAuthor({ name: `Ignore Current Week` });
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
        let embed = new Discord.EmbedBuilder()
            .setAuthor({ name: `Ignore Current Week` });
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
        db.query(`SELECT * FROM excuses where guildid = '${message.guild.id}'`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            let embed = new Discord.EmbedBuilder()
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
        db.query(`SELECT * FROM excuses WHERE id IN (${members.map(a => "'" + a + "'").join(', ')}) AND guildid = '${message.guild.id}'`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot);
            let embed = new Discord.EmbedBuilder()
                .setTitle(`Excused Staff`);
            if (!rows || !rows.length)
                message.channel.send({ embeds: [embed.setDescription('None!')] });
            const guild = bot.guilds.cache.get(message.guild.id);
            for (const row of rows) {
                const member = guild.members.cache.get(row.id);
                if (!member)
                    continue;
                const modmember = guild.members.cache.get(row.modid);
                embed.data.fields = [];
                embed.addFields([
                    { name: "Staff Member", value: `<@${row.id}> \`${member.nickname || member.user.tag}\`` },
                    { name: "Excused By", value: `<@${row.modid}> \`${modmember.nickname || modmember.user.tag}\`` },
                    { name: "Reason", value: row.reason ? row.reason : "None" }
                ])
                if (row.image) embed.setImage(row.image);
                message.channel.send({ embeds: [embed] });
            }
            rows.forEach(row => members = members.filter(m => m != row.id));
            if (members.length) {
                message.channel.send({
                    embeds: [
                        new Discord.EmbedBuilder()
                            .setTitle("Excuse List")
                            .setDescription(`The following members did not have excuses:\n${members.map(m => "<@" + m + ">").join(', ')}`)
                    ]
                })
            }
            if (unfound.length) {
                message.channel.send({
                    embeds: [
                        new Discord.EmbedBuilder()
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
                            new Discord.EmbedBuilder()
                                .setTitle("Excuse Removal")
                                .setDescription(`The following members have had their excuses removed:\n${rows.map(m => "<@" + m.id + ">").join(', ')}`)
                        ]
                    })
                }
                if (members.length) {
                    message.channel.send({
                        embeds: [
                            new Discord.EmbedBuilder()
                                .setTitle("Excuse Removal")
                                .setDescription(`The following members did not have excuses:\n${members.map(m => "<@" + m + ">").join(', ')}`)
                        ]
                    })
                }
                if (unfound.length) {
                    message.channel.send({
                        embeds: [
                            new Discord.EmbedBuilder()
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
                        if (quota.noexcuses) continue;
                        const roles = quota.roles.map((role, i) => {
                            return {
                                name: role,
                                role: guild.roles.cache.get(settings.roles[role]),
                                req: quota.quota[i]
                            }
                        })
                        const ignore = (guildQuota.ignoreRoles || []).map(r => settings.roles[r]).filter(r => r);
                        if (!member.roles.cache.filter(r => roles.map(ro => ro.role).includes(r)).size ||
                            member.roles.cache.filter(r => ignore.includes(r.id)).size) continue;
                        const requirement = roles.filter(role => { if (!role.role) console.log(role); return member.roles.cache.has(role.role.id) })
                            .reduce((p, c) => p.role.position > c.role.position ? p : c, { role: { position: -Infinity } });
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

                        if (total < requirement.req) {
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
                                requirement,
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
        const header = new Discord.EmbedBuilder()
            .setAuthor({ name: `Weekly Quotas` })
            .setDescription(`${keys.length} members have missed quota this week.`)
            .setColor('#0000ff');
        activitylog.send({ embeds: [header] })
        for (const id in unmet_quotas) {
            const issues = unmet_quotas[id];
            if (!issues.quotas.length) continue;
            const embed = new Discord.EmbedBuilder()
                .setAuthor({ name: issues.member.nickname || issues.member.user.tag, iconURL: issues.member.user.displayAvatarURL() })
                .setDescription(`Unmet Quota for ${issues.member}`)
                .setColor('#ff0000');
            if (issues.leave) {
                if (issues.consecutiveLeave < 2)
                    continue;
                embed.addFields({ name: "Consecutive Leave", value: `${issues.consecutiveLeave} weeks`, inline: true });
            }
            embed.addFields({ name: "Total Unexcused", value: `${issues.totalMissed + (issues.excuse ? 0 : 1)}`, inline: true });
            embed.addFields({ name: "Consecutive Unexcused", value: `${issues.excuse ? 0 : issues.consecutive}`, inline: true });
            for (const issue of issues.quotas) {
                embed.addFields({ name: issue.name, value: `\`\`\`\nTotal: ${issue.total} | Required: ${issue.requirement.req} (${issue.requirement.role.name})\n${issue.values.map(v => v.name + ": " + v.value).join(", ")}\`\`\`` })
            }
            if (issues.excuse) {
                embed.addFields({ name: "Excused By", value: `<@${issues.excuse.modid}>` });
                embed.addFields({ name: "Reason", value: `${issues.excuse.reason}` });
                if (issues.excuse.image)
                    embed.setImage(issues.excuse.image);
                embed.setColor('#00ff00')
            }
            if (issues.met.length) {
                embed.addFields({ name: "Met Quotas", value: issues.met.map(m => m.name).join(", ") });
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
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `${join}${string}`.length >= 2048) {
        if (!embed.data.fields) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `${join}${string}`.length >= 1024) {
            if (JSON.stringify(embed.toJSON()).length + `${join}${string}`.length >= 6000) {
                try {
                    channel.send({ embeds: [embed] })
                } catch (e) { ErrorLogger.log(e); }
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (JSON.stringify(embed.toJSON()).length + `${join}${string}`.length >= 6000) {
                try {
                    channel.send({ embeds: [embed] })
                } catch (e) { ErrorLogger.log(e); }
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`${join}${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`${join}${string}`))
    }
}