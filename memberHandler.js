const Discord = require('discord.js')
const ErrorLogger = require('./lib/logError')
const { getDB } = require('./dbSetup.js')

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

module.exports = {
    async checkWasSuspended(bot, member) {
        const db = getDB(member.guild.id)

        const [rows, ] = await db.promise().query(`SELECT suspended, ignOnLeave FROM suspensions WHERE id = ? AND suspended = true AND guildid = ?`, [member.id, member.guild.id])
        if (rows.length > 0) await suspendedMemberRejoin(bot, member, rows[0].ignOnLeave)
    },
    async checkWasMuted(bot, member) {
        const db = getDB(member.guild.id)

        const [[{ mute_count }], ] = await db.promise().query(`SELECT COUNT(*) as mute_count FROM mutes WHERE id = ? AND muted = true`, [member.id])
        if (mute_count !== 0) {
            await member.roles.add(bot.settings[member.guild.id].roles.muted)
            const logChannel = modlogChannel(bot, member.guild)
            if (logChannel) await logChannel.send(`${member} rejoined server after leaving while muted. Giving muted role back.`)
        }
    },
    async pruneRushers(db, rusherRoleId, oldMember, newMember) {
        if (!oldMember.roles.cache.has(rusherRoleId) && newMember.roles.cache.has(rusherRoleId)) {
            const today = new Date()
            await db.promise().query('INSERT IGNORE INTO rushers (id, guildid, time) values (?, ?, ?)', [newMember.id, newMember.guild.id, today.valueOf()])
        } else if (oldMember.roles.cache.has(rusherRoleId) && !newMember.roles.cache.has(rusherRoleId)) {
            await db.promise().query('DELETE FROM rushers WHERE id = ?', [newMember.id])
        }
    },
    async updateAffiliateRoles(bot, member) {
        await Promise.all(bot.partneredServers.filter((server) => server.guildId == member.guild.id).map(async (partneredServer) => {
            const partneredSettings = bot.settings[partneredServer.id]
            const otherServer = bot.guilds.cache.find(g => g.id == partneredServer.id)
            const partneredMember = otherServer.members.cache.get(member.id)

            if (!partneredMember) { return }

            // Take `partneredSettings.roles` but convert the values from role IDs to complete role objects
            const partneredRoles = Object.fromEntries(Object.entries(partneredSettings.roles).map(([k, roleId]) => [k, otherServer.roles.cache.get(roleId)]))

            if (!partneredMember.roles.cache.has(partneredRoles.raider.id)) return
            if (partneredMember.roles.cache.hasAny(partneredRoles.permasuspended.id, partneredRoles.tempsuspended.id)) return

            const partneredModLogs = otherServer.channels.cache.get(partneredSettings.channels.modlogs)

            const memberRoleIds = Array.from(member.roles.cache.values()).map((role) => role.id.toString())
            const partnerServerRoleIds = bot.settings[member.guild.id].roles
            const isStaff     = !!partneredServer.affiliatelist.find((roletype) => memberRoleIds.includes(partnerServerRoleIds[roletype]))
            const vasEligable = !!partneredServer.vaslist.find((roletype) => memberRoleIds.includes(partnerServerRoleIds[roletype]))

            // Not sure if this is too fancy/functional -- could reduce to a setRole(true / false)
            await (isStaff     ? addRole : removeRole)(partneredMember, partneredRoles.affiliatestaff,  partneredModLogs)
            await (vasEligable ? addRole : removeRole)(partneredMember, partneredRoles.vetaffiliate,    partneredModLogs)

            if (partneredMember.roles.highest.position == partneredRoles.vetaffiliate.position && !partneredMember.displayName.startsWith(partneredServer.prefix)) {
                await partneredMember.setNickname(`${partneredServer.prefix}${partneredMember.displayName}`, 'Automatic Nickname Change: User just got Veteran Affiliate Staff as their highest role')
                await modLog(partneredMember, partneredModLogs, partneredMember.roles.highest.hexColor, `Automatic Prefix Change for ${partneredMember}\nOld Nickname: \`${partneredMember.displayName}\`\nNew Nickname: \`${partneredMember.displayName}\`\nPrefix: \`${partneredServer.prefix}\``)
            }
        }))
    },
    async detectSuspensionEvasion(bot, member) {
        const db = getDB(member.guild.id)
        await db.promise().query('SELECT COUNT(*) as suspension_count FROM suspensions WHERE id = ? AND suspended = true AND guildid = ?', [member.id, member.guild.id]).then(async ([[{ suspension_count }], ]) => {
            if (suspension_count === 0) return
            let modlog = modlogChannel(bot, member.guild)
            if (modlog) await modlog.send(`${member} is attempting to dodge a suspension by leaving the server`)
            await db.promise().query('UPDATE suspensions SET ignOnLeave = ? WHERE id = ? AND suspended = true', [member.nickname, member.id])
            if (member.nickname) {
                await Promise.all(member.nickname.replace(/[^a-z|]/gi, '').split('|').map(async (n) => {
                    await db.promise().query('INSERT INTO veriblacklist (id, guildid, modid, reason) VALUES (?, ?, ?, ?)', [n, member.guild.id, bot.user.id, 'Left Server While Suspended'])
                }))
            }

        }, (err) => {
            ErrorLogger.log(err, bot, member.guild)
        })
    }
}
