const Discord = require('discord.js')
const botSettings = require('../settings.json')
const axios = require('axios')
const emojiServers = require('../data/emojiServers.json')
const keyRoles = require('../data/keyRoles.json')

module.exports = {
    name: 'stats',
    description: 'Gives users stats',
    args: '(user)',
    role: 'raider',
    noGuildChoice: true,
    //dms: true,
    async execute(message, args, bot, db) {
        if (args.length == 0) var member = message.author
        else var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let id = args[0];
        if (member) id = member.id;
        if (!/^[0-9]+$/.test(id))
            return message.channel.send(`Could not find user by the name or id of ${id}.`);
        let embed = await this.getStatsEmbed(id, message.guild, bot).catch(er => {
            message.channel.send({
                embeds:
                    [
                        new Discord.EmbedBuilder().setDescription(`${er}`)
                    ]
            });
        })
        if (embed) message.channel.send({ embeds: [embed] })
    },
    async getStatsEmbed(id, guild, bot) {
        return new Promise(async (res, rej) => {
            //User
            const member = guild.members.cache.get(id);
            let ign = member && member.nickname ? member.nickname.replace(/[^a-z|]/gi, '').split('|')[0] : id;

            //All DB
            let promises = []
            let errored = false
            let rows = {} // {schema:row}
            bot.guilds.cache.each(g => {
                if (!emojiServers.includes(g.id)) {
                    if (bot.dbs[g.id] && g.members.cache.get(id)) {
                        promises.push(getRow(bot.dbs[g.id], id, rows).catch(er => {
                            errored = true
                            rej(er)
                        }))
                    }
                }
            })
            await Promise.all(promises)
            if (errored) return

            //OSanc Logic
            let data, hasO3 = false;
            const oryx3 = {
                participation: { reg: 0, vet: 0, completions: 0 },
                leading: { reg: 0, vet: 0 },
                pops: { inc: 0, shield: 0, sword: 0, helmet: 0 }
            };
            if (botSettings.osancStats) {

                if (ign) data = await axios.post(`https://api.osanc.net/getProfile`, { ign });
                if (data) data = data.data;
                if (data && data.profile && data.profile.oryx3) {
                    hasO3 = true
                    oryx3.participation = { ...oryx3.participation, ...data.profile.oryx3.participation };
                    oryx3.leading = { ...oryx3.leading, ...data.profile.oryx3.leading };
                    oryx3.pops = { ...oryx3.pops, ...data.profile.pops };
                    if (bot.dbs['343704644712923138']) bot.dbs['343704644712923138'].query(`UPDATE users SET o3runs = ${data.profile.oryx3.participation.completions} WHERE id = '${id}'`);
                    if (bot.dbs['343704644712923138']) bot.dbs['343704644712923138'].query(`UPDATE users SET runesused = ${oryx3.pops.shield + oryx3.pops.sword + oryx3.pops.helmet} WHERE id = '${id}'`);
                }
            }

            //setup embed
            const embed = new Discord.EmbedBuilder()
                .setColor('#015c21')
                .setDescription(`__**Stats for**__ <@${id}> ${member ? '\`' + (member.nickname || member.user.tag) + '\`' : ''}`)

            //Add local database info
            for (let i in rows) if (rows[i][0]) embed.addFields(getFields(rows[i][0], i))

            //Add o3 and misc(points)
            let otherFields = []
            if (hasO3) otherFields = getFields(oryx3, 'oryx3')
            if (rows['halls'] && rows['halls'][0]) otherFields.push({ name: `✨ Miscellaneous Stats ✨`, value: `🎟️ ${rows['halls'][0].points || 0} Points` })
            if (rows['testinghalls']) otherFields.push({ name: `✨ (Testing) Miscellaneous Stats ✨`, value: `🎟️ ${rows['testinghalls'][0].points || 0} Points` })
            if (otherFields.length > 0) embed.addFields(otherFields);

            //add discord pfp
            if (member) embed.setThumbnail(member.user.avatarURL());

            // check for missing keyroles
            const popInfo = keyRoles[guild.id];
            const settings = bot.settings[guild.id];
            if (settings && popInfo && member) {
                const keyRows = popInfo.map(ki => ki.types.map(t => t[0]).join(", ")).join(", ");
                if (bot.dbs['343704644712923138']) bot.dbs['343704644712923138'].query(`SELECT id, ${keyRows} FROM users WHERE id = '${member.id}'`, (err, keyRows) => {
                    if (err) ErrorLogger.log(err, bot)
                    if (keyRows && keyRows[0]) checkRow(guild, bot, keyRows[0], member);
                })
            }

            //return embed
            res(embed);
        })
    }
}

function getRow(db, id, rowsObj) {
    return new Promise((res, rej) => {
        db.query(`SELECT * FROM users WHERE id = '${id}'`, (err, rows) => {
            if (err) rej(err)
            else {
                rowsObj[db.config.database] = rows
                res(rows)
            }
        })
    })
}


function getFields(row, schema) {
    if (schema == 'oryx3') return [
        {
            name: `<:oryxThree:831047591096745984> Oryx Sanctuary Stats <:oryxThree:831047591096745984>`,
            value: '** **'
        },
        {
            name: `<:o3portal:831046404252237855> __**Runes Popped**__ <:o3portal:831046404252237855>`,
            value: `<:inc:831046532156620851> ${row.pops.inc}\n` +
                `<:shieldRune:831046532232118292> ${row.pops.shield}\n` +
                `<:swordRune:831046532370530324> ${row.pops.sword}\n` +
                `<:helmetRune:831046532115202078> ${row.pops.helmet} `,
            inline: true
        },
        {
            name: `<:oryxThree:831047591096745984> __**Runs Done**__ <:oryxThree:831047591096745984>`,
            value: `${row.participation.reg} Normal Runs\n` +
                `${row.participation.vet} Veteran Runs\n` +
                `${row.participation.completions} Completes`,
            inline: true
        },
        {
            name: `<:oryxThree:831047591096745984> __**Runs Lead**__ <:oryxThree:831047591096745984>`,
            value: `${row.leading.reg} Normal Runs\n` +
                `${row.leading.vet} Veteran Runs`,
            inline: true
        }
    ]
    if (schema == 'halls' || schema == 'testinghalls') return [
        {
            name: `<${botSettings.emote.hallsPortal}> Lost Halls Stats <${botSettings.emote.hallsPortal}>`,
            value: '** **'
        },
        {
            name: `<:legendaryMysteryKey:831052176507535360> __**Keys Popped**__ <:legendaryMysteryKey:831052176507535360>`,
            value: `<${botSettings.emote.LostHallsKey}> ${row.keypops}\n` +
                `<:shattersKey:1008104345197346817> ${row.shattersPops}\n` +
                `<:fungalK:723001429614395402> ${row.fungalPops}\n` +
                `<:nestK:723001429693956106> ${row.nestPops}\n` +
                `<:epicMysteryKey:831051424187940874> ${row.eventpops}\n` +
                `<${botSettings.emote.Vial}> ${row.vialStored} Dropped\n` +
                `<${botSettings.emote.Vial}> ${row.vialUsed} Used`,
            inline: true
        },
        {
            name: `<${botSettings.emote.hallsPortal}> __**Runs Done**__ <${botSettings.emote.hallsPortal}>`,
            value: `<${botSettings.emote.malus}> ${row.cultRuns}\n` +
                `<${botSettings.emote.voidd}> ${row.voidRuns}\n` +
                `<:forgottenking:1008068892071055512> ${row.shattersRuns}\n` +
                `<:crystal:1008068893056696410> ${row.fungalRuns}\n` +
                `<:queenbee:1008068890791780433> ${row.nestRuns}\n` +
                `<:epicMysteryKey:831051424187940874> ${row.eventruns}`,
            inline: true
        },
        {
            name: `<${botSettings.emote.hallsPortal}> __**Runs Led**__ <${botSettings.emote.hallsPortal}>`,
            value: `<${botSettings.emote.malus}> ${row.cultsLead}\n` +
                `<${botSettings.emote.voidd}> ${row.voidsLead}\n` +
                `<:forgottenking:1008068892071055512> ${row.shattersLead}\n` +
                `<:crystal:1008068893056696410> ${row.fungalsLead}\n` +
                `<:queenbee:1008068890791780433> ${row.nestsLead}\n` +
                `<:epicMysteryKey:831051424187940874> ${parseInt(row.eventsLead) * 10} Minutes\n` +
                `<:feedback:858920770806087710> ${row.feedback + row.exaltFeedback}\n` +
                `🤝 ${row.assists} Assists\n` +
                `🔎 ${row.parses} Parses`,
            inline: true
        }
    ]
    if (schema == 'shatters') return [
        {
            name: `<:shatters:723001214865899532> Shatters Stats <:shatters:723001214865899532>`,
            value: '** **'
        },
        {
            name: `<:legendaryMysteryKey:831052176507535360> __**Keys Popped**__ <:legendaryMysteryKey:831052176507535360>`,
            value: `<:shattersKey:1008104345197346817> ${row.shatterspops}\n` +
                `<:epicMysteryKey:831051424187940874> ${row.eventpops}\n`,
            inline: true
        },
        {
            name: `<:TheForgottenCrown:719931358889115680> __**Runs Done**__ <:TheForgottenCrown:719931358889115680>`,
            value: `<:forgottenKing:849406533435523093> ${row.runs}\n` +
                `<:epicMysteryKey:831051424187940874> ${row.eventruns}\n` +
                `<:forgottenKing:849406533435523093> ${row.oldruns} *Legacy*\n`,
            inline: true
        },
        {
            name: `<:TheForgottenCrown:719931358889115680> __**Runs Led**__ <:TheForgottenCrown:719931358889115680>`,
            value: `<:forgottenKing:849406533435523093> ${row.successruns}\n` +
                `❌ ${row.failruns}\n` +
                `<:epicMysteryKey:831051424187940874> ${parseInt(row.eventslead) * 10} Minutes\n` +
                `🤝 ${row.assists} Assists\n` +
                `<:forgottenKing:849406533435523093> ${row.oldsuccessruns} *Legacy*\n` +
                `🤝 ${row.oldassists} *Legacy Assists*`,
            inline: true
        }
    ]
    console.log('no found schema in stats.js:getFields. Schema: ', schema)
    return []
}

function checkRow(guild, bot, row, member) {
    return new Promise(async (res) => {
        const settings = bot.settings[guild.id];
        const popInfo = keyRoles[guild.id];
        member = member || await guild.members.fetch(row.id).catch(e => { });
        if (!settings || !popInfo || !member) return;
        const rolesToAdd = [];
        for (const keyInfo of popInfo) {
            if (!settings.roles[keyInfo.role]) continue;
            let count = 0;
            for (const [keyType, keyName] of keyInfo.types)
                count += row[keyType] || 0;
            if (count >= keyInfo.amount) {
                if (!member.roles.cache.has(settings.roles[keyInfo.role]))
                    rolesToAdd.push(settings.roles[keyInfo.role]);
            }
        }
        member.roles.add(rolesToAdd);
        res(rolesToAdd);
    })
}