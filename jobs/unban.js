const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const { RepeatedJob } = require('./RepeatedJob.js');
const { iterServersWithQuery } = require('./util.js');
const { getDB } = require('../dbSetup.js');
const { settings } = require('../lib/settings');

async function tryUnsuspend(bot, g, row, isVetBan) {
    const guildId = row.guildid;
    const { roles, channels, backend: { useUnverifiedRole } } = settings[g.id];
    const proofLogID = row.logmessage;
    const guild = bot.guilds.cache.get(guildId);
    const member = guild.members.cache.get(row.id);
    const db = getDB(g.id);

    if (!member) {
        if (!isVetBan) guild.channels.cache.get(channels.suspendlog).send(`<@!${row.id}> has been unsuspended automatically. However, they are not in the server`);
        return await db.promise().query('UPDATE ?? SET suspended = false WHERE id = ?', [isVetBan ? 'vetbans' : 'suspensions', row.id]);
    }

    try {
        if (isVetBan) {
            await member.roles.remove(roles.vetban);
            setTimeout(() => { member.roles.add(roles.vetraider); }, 1000);
            setTimeout(() => {
                if (!member.roles.cache.has(roles.vetraider)) {member.roles.add(roles.vetraider).catch(er => ErrorLogger.log(er, bot, g));}
                if (useUnverifiedRole && member.roles.cache.has(roles.unverified)) member.roles.remove(roles.unverified);
            }, 5000);
        } else {
            const roles = [];
            const rolesString = row.roles;
            rolesString.split(' ').forEach(r => { if (r !== '') roles.push(r); });

            await member.roles.add(roles).catch(er => ErrorLogger.log(er, bot, g));
            setTimeout(async () => {
                if (member.roles.cache.has(roles.tempsuspended)) await member.roles.remove(roles.tempsuspended).catch(er => ErrorLogger.log(er, bot, g));
                if (member.roles.cache.has(roles.permasuspended)) await member.roles.remove(roles.permasuspended);
                if (useUnverifiedRole && member.roles.cache.has(roles.unverified)) await member.roles.remove(roles.unverified);
            }, 5000);
        }

        const unsuspendPing = `<@!${row.id}> has been ${isVetBan ? 'un-vet-banned' : 'unsuspended'} automatically`;
        try {
            const messages = await guild.channels.cache.get(channels.suspendlog).messages.fetch({ limit: 100 });
            const m = messages.get(proofLogID);
            if (!m) {
                guild.channels.cache.get(channels.suspendlog).send(unsuspendPing);
            } else {
                const embed = new Discord.EmbedBuilder();
                embed.data = m.embeds.shift().data;
                embed.setColor('#00ff00')
                    .setDescription(embed.data.description.concat(`\nUn${isVetBan ? '-vet-banned' : 'suspended'} automatically`))
                    .setFooter({ text: 'Unsuspended at' })
                    .setTimestamp(Date.now());
                m.edit({ embeds: [embed] });
            }
        } catch (er) {
            guild.channels.cache.get(channels.suspendlog).send(unsuspendPing);
        } finally {
            await db.promise().query('UPDATE ?? SET suspended = false WHERE id = ?', [isVetBan ? 'vetbans' : 'suspensions', row.id]);
        }
    } catch (er) {
        ErrorLogger.log(er, bot, g);
    }
}

class UnbanVet extends RepeatedJob {
    async run(bot) {
        const dbQuery = 'SELECT * FROM vetbans WHERE suspended = true';
        await iterServersWithQuery(bot, dbQuery, async (bot, row, g) => {
            if (Date.now() > parseInt(row.uTime)) {
                await tryUnsuspend(bot, g, row, true);
            }
        });
    }
}

class Unsuspend extends RepeatedJob {
    async run(bot) {
        const dbQuery = 'SELECT * FROM suspensions WHERE suspended = true AND perma = false';
        await iterServersWithQuery(bot, dbQuery, async (bot, row, g) => {
            if (Date.now() > parseInt(row.uTime)) {
                await tryUnsuspend(bot, g, row, false);
            }
        });
    }
}

module.exports = { UnbanVet, Unsuspend };
