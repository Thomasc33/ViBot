const Discord = require('discord.js')
const ErrorLogger = require('./lib/logError')

async function modLog(member, logChannel, color, msg) {
    const iconUrl = 'https://cdn.discordapp.com/avatars/' + member.id + '/' + member.user.avatar + '.webp'
    const embed = new Discord.EmbedBuilder()
        .setAuthor({ name: `${member.displayName}`, iconURL: iconUrl })
        .setDescription(msg)
        .setColor(color)
    await logChannel.send({ embeds: [embed] })
}

function modlogChannel(bot, guild) {
    const modlog = guild.channels.cache.get(bot.settings[guild.id].channels.modlogs)
    if (!modlog) ErrorLogger.log(new Error(`mod log not found in ${guild.id}`), bot, guild)
    return modlog
}

async function removeRole(member, role, logChannel) {
    if (!member.roles.cache.has(role.id)) return
    await member.roles.remove(role)
    await modLog(member, logChannel, role.hexColor, `Removed role ${role} from ${member} \`\`${member.displayName}\`\``)
}

async function addRole(member, role, logChannel) {
    if (member.roles.cache.has(role.id)) return
    await member.roles.add(role)
    await modLog(member, logChannel, role.hexColor, `Given role ${role} to ${member} \`\`${member.displayName}\`\``)
}

async function suspendedMemberRejoin(bot, member, ignOnLeave) {
    let msg = `${member} rejoined server after leaving while suspended. `;
    const logChannel = modlogChannel(bot, member.guild)
    await member.roles.add(bot.settings[member.guild.id].roles.tempsuspended)
    if (ignOnLeave) {
        member.setNickname(ignOnLeave);
        if (logChannel) await logChannel.send(`${member} rejoined server after leaving while suspended. Giving suspended role and nickname back.`)
    } else {
        if (logChannel) await logChannel.send(`${member} rejoined server after leaving while suspended. Could not assign a nickname as it was either null or undefined. Giving suspended role back.`);
    }
}

function dbQueryPromise(db, query) {
    return new Promise((resolve) => {
        db.query(query, (err, rows) => { if (err) throw err; resolve(rows) })
    })
}

module.exports = {
    async checkWasSuspended(bot, member) {
        const db = bot.dbs[member.guild.id]

        const rows = await dbQueryPromise(db, `SELECT suspended, ignOnLeave FROM suspensions WHERE id = '${member.id}' AND suspended = true AND guildid = '${member.guild.id}'`)
        if (rows.length !== 0) {
            await suspendedMemberRejoin(bot, member, rows[0].ignOnLeave)
        } else if (rows.length > 1) {
            // Probably should log an error here?
        }
    },
    async checkWasMuted(bot, member) {
        const db = bot.dbs[member.guild.id]

        const rows = await dbQueryPromise(db, `SELECT muted FROM mutes WHERE id = '${member.id}' AND muted = true`)
        if (rows.length !== 0) {
            member.roles.add(bot.settings[member.guild.id].roles.muted)
            const modlogChannel = modlogChannel(bot, member.guild)
            if (modlogChannel) await modlogChannel.send(`${member} rejoined server after leaving while muted. Giving muted role back.`)
        } else if (rows.length > 1) {
            // Probably should log an error here?
        }
    },
    pruneRushers(db, rusherRoleId, oldMember, newMember) {
        if (!oldMember.roles.cache.has(rusherRoleId) && newMember.roles.cache.has(rusherRoleId)) {
            const today = new Date()
            db.query(`INSERT IGNORE INTO rushers (id, guildid, time) values ("${newMember.id}", "${newMember.guild.id}", ${today.valueOf()})`)
        } else if (oldMember.roles.cache.has(rusherRoleId) && !newMember.roles.cache.has(rusherRoleId)) {
            db.query(`DELETE FROM rushers WHERE id = "${newMember.id}"`)
        }
    },
    async updateAffiliateRoles(bot, member) {
        await Promise.all(bot.partneredServers.filter((server) => server.guildId === member.guildId).map(async (partneredServer) => {
            const partneredSettings = bot.settings[partneredServer.id]
            const otherServer = bot.guilds.cache.find(g => g.id == partneredServer.id)
            const partneredMember = otherServer.members.cache.get(member.id)

            if (!partneredMember) { return }

            // Take `partneredSettings.roles` but convert the values from role IDs to complete role objects
            const partneredRoles = Object.fromEntries(Object.entries(partneredSettings.roles).map((k, roleId) => [k, otherServer.roles.cache.get(roleId)]))

            if (!partneredMember.roles.cache.has(partneredRoles.raider.id)) return
            if (partneredMember.roles.cache.hasAny(partneredRoles.permasuspended.id, partneredRoles.tempsuspended.id)) return

            const partneredModLogs = otherServer.channels.cache.get(partneredSettings.channels.modlogs)

            const memberRoles = Array.from(member.roles.cache.values())
            const isStaff     = memberRoles.any((role) => partneredServer.affiliatelist.include(role.name))
            const vasEligable = memberRoles.any((role) => partneredServer.vaslist.include(role.name))

            // Not sure if this is too fancy/functional -- could reduce to a setRole(true / false)
            await (isStaff     ? addRole : removeRole)(partneredMember, partneredRoles.affiliatestaff,  partneredModLogs)
            await (vasEligable ? addRole : removeRole)(partneredMember, partneredRoles.vetaffiliate,    partneredModLogs)

            if (partneredMember.roles.highest.position == partneredRoles.vetaffiliate.position && !partneredMember.displayName.startsWith(partneredServer.prefix)) {
                await partneredMember.setNickname(`${partneredServer.prefix}${partneredMember.displayName}`, 'Automatic Nickname Change: User just got Veteran Affiliate Staff as their highest role')
                await modLog(partneredMember, partneredModLogs, partneredMember.roles.highest.hexColor, `Automatic Prefix Change for ${partneredMember}\nOld Nickname: \`${partneredMember.displayName}\`\nNew Nickname: \`${partneredMember.displayName}\`\nPrefix: \`${partneredServer.prefix}\``)
            }
        }))
    },
    detectSuspensionEvasion(bot, member) {
        const db = bot.dbs[member.guild.id]
        db.query(`SELECT suspended FROM suspensions WHERE id = '${member.id}' AND suspended = true AND guildid = '${member.guild.id}'`, (err, rows) => {
            if (err) return ErrorLogger.log(err, bot, member.guild)
            if (rows.length !== 0) {
                let modlog = modlogChannel(bot, member.guild)
                if (modlog) modlog.send(`${member} is attempting to dodge a suspension by leaving the server`)
                db.query(`UPDATE suspensions SET ignOnLeave = '${member.nickname}' WHERE id = '${member.id}' AND suspended = true`)
                if (member.nickname) {
                    member.nickname.replace(/[^a-z|]/gi, '').split('|').forEach(n => {
                        db.query(`INSERT INTO veriblacklist (id, guildid, modid, reason) VALUES ('${n}', '${member.guild.id}', '${bot.user.id}', 'Left Server While Suspended')`)
                    })
                }
            }
        })
    }
}
