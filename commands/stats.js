const Discord = require('discord.js')
const botSettings = require('../settings.json')
const axios = require('axios')
const keyRoles = require('../data/keyRoles.json')
const { getDB, guildSchema } = require('../dbSetup.js')
const { iterServers } = require('../jobs/util.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'stats',
    description: 'Gives users stats',
    args: '(user)',
    role: 'raider',
    noGuildChoice: true,
    //dms: true,
    args: [
        slashArg(SlashArgType.User, 'user', {
            required: false,
            description: "The user whose stats you'd like to view"
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        if (args.length == 0) var member = message.author
        else var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let id = args[0];
        if (member) id = member.id;
        if (!/^[0-9]+$/.test(id))
            return await message.channel.send(`Could not find user by the name or id of ${id}.`);
        let embed = await this.getStatsEmbed(id, message.guild, bot, db).catch(async er => {
            console.log(er)
            await message.replyInternalError({
                embeds:
                    [
                        new Discord.EmbedBuilder().setDescription(`${er}`)
                    ]
            });
        })
        if (embed) await message.reply({ embeds: [embed] })
    },
    async getStatsEmbed(id, guild, bot) {
        //User
        const member = guild.members.cache.get(id);
        let ign = member && member.nickname ? member.nickname.replace(/[^a-z|]/gi, '').split('|')[0] : id;

        //All DB
        let rows = {} // {schema:row}
        await iterServers(bot, async (bot, g) => {
            const db = getDB(g.id)
            if (db && g.members.cache.get(id)) {
                const schema = guildSchema(g.id)
                const [userRows,] = await db.promise().query('SELECT * FROM users WHERE id = ?', [id])
                // console.log("SCHEMA: " + db.config.database)
                rows[schema] = userRows
            }
        })

        //OSanc Logic
        let data, hasO3 = false;
        const oryx3 = {
            participation: { reg: 0, vet: 0, completions: 0 },
            leading: { reg: 0, vet: 0 },
            pops: { inc: 0, shield: 0, sword: 0, helmet: 0 },
            rows: rows[guildSchema(guild.id)][0]
        };
        
        if (botSettings.osancStats) {
            if (ign) data = await axios.post(`https://api.osanc.net/getProfile`, { ign });
            if (data) data = data.data;
            if (data && data.profile && data.profile.oryx3) {
                hasO3 = true
                oryx3.participation = { ...oryx3.participation, ...data.profile.oryx3.participation };
                oryx3.leading = { ...oryx3.leading, ...data.profile.oryx3.leading };
                oryx3.pops = { ...oryx3.pops, ...data.profile.pops };
                const hallsdb = getDB('343704644712923138')
                if (hallsdb) hallsdb.query(`UPDATE users SET o3runs = ${data.profile.oryx3.participation.completions} WHERE id = '${id}'`);
                if (hallsdb) hallsdb.query(`UPDATE users SET runesused = ${oryx3.pops.shield + oryx3.pops.sword + oryx3.pops.helmet} WHERE id = '${id}'`);
                if (hallsdb) hallsdb.query(`UPDATE users SET incPops = ${oryx3.pops.inc} WHERE id = '${id}'`);
            }
        }

        //setup embed
        const embed = new Discord.EmbedBuilder()
            .setColor('#015c21')
            .setDescription(`__**Stats for**__ <@${id}> ${member ? '\`' + (member.nickname || member.user.tag) + '\`' : ''}`)

        //Add local database info
        for (let i in rows) if (rows[i][0]) embed.addFields(getFields(rows[i][0], i, bot))

        //Add o3 and misc(points)
        let otherFields = []
        if (hasO3) otherFields = getFields(oryx3, 'oryx3', bot)
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
            const hallsdb = getDB('343704644712923138')
            if (hallsdb) hallsdb.query(`SELECT id, ${keyRows} FROM users WHERE id = '${member.id}'`, (err, keyRows) => {
                if (err) ErrorLogger.log(err, bot, message.guild)
                if (keyRows && keyRows[0]) checkRow(guild, bot, keyRows[0], member);
            })
        }

        //return embed
        return embed;
    }
}

function getFields(row, schema, bot) {
    if (schema == 'oryx3') {
        return [
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
                value: `${bot.storedEmojis.oryxThree.text} ${row.participation.reg} Normal Runs\n` +
                    `${bot.storedEmojis.oryxThree.text} ${row.participation.vet} Veteran Runs\n` +
                    `${bot.storedEmojis.oryxThree.text} ${row.participation.completions} Completes`,
                inline: true
            },
            {
                name: `<:oryxThree:831047591096745984> __**Runs Lead**__ <:oryxThree:831047591096745984>`,
                value: `${bot.storedEmojis.oryxThree.text} ${row.rows.o3leads} Normal Runs\n` +
                    `${bot.storedEmojis.oryxThree.text} ${row.leading.vet} Veteran Runs\n` +
                    `${bot.storedEmojis.feedback.text} ${row.rows.o3feedback} Feedbacks\n` +
                    `:mag: ${row.rows.o3parses} Parses`,
                inline: true
            }
        ]
    }
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
                `<:steamworksKey:1050848141492109372> ${row.steamworkPops}\n` +
                `<:mvK:1090163553396334663> ${row.moonlightPops}\n` +
                `<:epicMysteryKey:831051424187940874> ${row.eventpops}\n` +
                `<:modded_key:1027356831565217812> ${row.moddedPops}\n` +
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
                `<a:steamworksPortal:1050156386547413012> ${row.steamworkRuns}\n` +
                `<:mv:1090163554872737866> ${row.moonlightRuns}\n` +
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
                `<:SteamworksBoss:1050156577920917574> ${row.steamworkLead}\n` +
                `<:MoonlightBoss:1090178399252783104> ${row.moonlightLead}\n` +
                `<:epicMysteryKey:831051424187940874> ${parseInt(row.eventsLead) * 10} Minutes\n` +
                `<:feedback:858920770806087710> ${row.feedback + row.exaltFeedback}\n` +
                `<:shattersFeedback:1071433377879707728> ${row.shattersFeedback}\n` +
                `🤝 ${row.assists} Assists\n` +
                `🔎 ${row.parses} Parses\n`,
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
                `<:mvK:1090163553396334663> ${row.moonlightPops}\n` +
                `<:epicMysteryKey:831051424187940874> ${row.eventpops}\n`,
            inline: true
        },
        {
            name: `<:TheForgottenCrown:719931358889115680> __**Runs Done**__ <:TheForgottenCrown:719931358889115680>`,
            value: `<:forgottenKing:849406533435523093> ${row.runs}\n` +
                `<:mv:1090163554872737866> ${row.moonlightRuns}\n` +
                `<:epicMysteryKey:831051424187940874> ${row.eventruns}\n` +
                `<:forgottenKing:849406533435523093> ${row.oldruns} *Legacy*\n`,
            inline: true
        },
        {
            name: `<:TheForgottenCrown:719931358889115680> __**Shatters Runs Led**__ <:TheForgottenCrown:719931358889115680>`,
            value: `<:forgottenKing:849406533435523093> ${row.successruns} Normal\n` +
                `<:forgottenKing:849406533435523093> ${row.veteranShattersLead} Veteran\n` +
                `<:forgottenKing:849406533435523093> ${row.hardmodeLead} Hardmode\n` +
                `❌ ${row.failruns}\n`,
            inline: true
        },        
        {
            name: `<:TheForgottenCrown:719931358889115680> __**Moonlight Runs Led**__ <:TheForgottenCrown:719931358889115680>`,
            value: `<:MoonlightBoss:1090178399252783104> ${row.moonlightLead}`,
            inline: true
        },
        {
            name: `<:TheForgottenCrown:719931358889115680> __**Other Runs Led**__ <:TheForgottenCrown:719931358889115680>`,
            value: `<:epicMysteryKey:831051424187940874> ${parseInt(row.eventslead) * 10} Minutes\n` +
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
