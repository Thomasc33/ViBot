const Discord = require('discord.js')
const botSettings = require('../settings.json')
const ErrorLogger = require('../lib/logError')
const realmEyeScrape = require('../lib/realmEyeScrape')
const charList = require('./characterList')
const lootInfo = require('../data/lootInfo.json')
const ext = require('../lib/extensions');
const dungeons = require('../data/vetVerification.json')
const VerificationCurrentWeek = require('../data/currentweekInfo.json').verificationcurrentweek
const quota = require('./quota')
const quotas = require('../data/quotas.json')

var watching = []
var embedMessage, bot

module.exports = {
    name: 'vetverification',
    role: 'moderator',
    description: 'createmessage/restart',
    execute(message, args, bot, db) {
        switch (args[0]) {
            case 'createmessage':
                this.createMessage(message, bot, db)
                break;
            case 'restart':
                this.restartPending(message.guild, db)
        }
    },
    async createMessage(message, bot, db) {
        let settings = bot.settings[message.guild.id]
        let vetVeriChannel = message.guild.channels.cache.get(settings.channels.vetverification)
        if (!vetVeriChannel) return message.channel.send(`Vet Verification channel not found`)
        let vetVeriEmbed = new Discord.EmbedBuilder()
            .setTitle(`Veteran Verification for ${message.guild.name}`)
            .addFields([{ name: 'How to', value: 'React with the :white_check_mark: to get the role.\nMake sure to make your graveyard and character list public on realmeye before reacting\nAlso run the command ;stats to see your current run total.' }])
            .addFields([{ name: 'Requirements', value: `${(settings.vetverireqs.maxed) ? `-${settings.vetverireqs.maxed} 8/8 Characters\n` : ''}${(settings.vetverireqs.meleemaxed) ? `-${settings.vetverireqs.meleemaxed} 8/8 Melee Characters\n` : ''}${(settings.vetverireqs.runs) ? `-${settings.vetverireqs.runs} Completed Runs\n` : ''}` }])
        embedMessage = await vetVeriChannel.send({ embeds: [vetVeriEmbed] })
        embedMessage.react('✅')
        this.init(message.guild, bot, db)
    },
    async init(guild, bott, db) {
        bot = bott
        let settings = bott.settings[guild.id]
        if (!embedMessage) {
            let vetVeriChannel = guild.channels.cache.get(settings.channels.vetverification)
            if (vetVeriChannel == null) return;
            let messages = await vetVeriChannel.messages.fetch({ limit: 1 })
            embedMessage = messages.first()
        }
        let reactionCollector = new Discord.ReactionCollector(embedMessage, { filter: checkFilter })
        reactionCollector.on('collect', (r, u) => {
            this.vetVerify(u, guild, db)
        })
        this.restartPending(guild, db)
    },
    async vetVerify(u, guild, db) {
        let settings = bot.settings[guild.id]
        let member = guild.members.cache.get(u.id)
        let vetRaider = settings.roles.vetraider
        let veriLog = guild.channels.cache.get(settings.channels.verificationlog)
        let veriPending = guild.channels.cache.get(settings.channels.manualvetverification)
        let ign = member.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|')[0]
        const dungeon = dungeons[guild.id];
        if (!dungeon)
            return;
        if (!member) return;
        if (watching.includes(u.id)) return
        if (member.roles.cache.has(vetRaider)) return

        let loggedRuns = 0
        let profile;
        if (!dungeon.webdata) {
            db.query(`SELECT * FROM users WHERE id = '${u.id}'`, (err, rows) => {
                if (err) ErrorLogger.log(err, bot, guild)
                if (rows.length == 0) return
                if (dungeon.dbnames) for (let i of dungeon.dbnames) if (rows[0][i]) loggedRuns += parseInt(rows[0][i])
                if (dungeon.dbisvet) isVet = rows[0][dungeon.dbisvet]
            })
        } else {
            try {
                profile = await realmEyeScrape.getSancProfile(ign);
                loggedRuns = profile.participation.completions;
            }
            catch (e) { console.log(e) };
        }
        let userInfo = await realmEyeScrape.getUserInfo(ign)
        let maxedChars = 0;
        let meleeMaxed = 0;
        let realmEyeRuns = 0;
        if (settings.backend.realmeyestats) {
            for (let i in userInfo.characters) {
                let char = userInfo.characters[i]
                if (char.stats == '8/8') {
                    maxedChars += 1;
                    if (char.class == 'Warrior' || char.class == 'Knight' || char.class == 'Paladin') meleeMaxed += 1;
                }
            }
        }
        if (dungeon.realmeyestring) {
            let graveyard = await realmEyeScrape.getGraveyardSummary(ign).catch(er => null)
            if (graveyard)
                for (let i in graveyard.dungeonCompletes) {
                    let achievement = graveyard.dungeonCompletes[i]
                    if (dungeon.realmeyestring.includes(achievement.type)) {
                        realmEyeRuns += parseInt(achievement.total)
                    }
                }
        }
        let exaltCounts = 0
        let exaltStats
        if (dungeon.exaltStats.length > 0) {
            exaltStats = await realmEyeScrape.getExaltationHistory(ign)
            for (let i of dungeon.exaltStats) {
                for (let j in exaltStats.exaltations) {
                    let e = exaltStats.exaltations[j]

                    if (e[i]) {
                        e[i] = parseInt(e[i].toLowerCase().replace('+', ''));
                        if (['health', 'mana'].includes(e[i]))
                            e[i] = e[i] / 5;
                        switch (e[i]) {
                            case 1: exaltCounts += 5; break;
                            case 2: exaltCounts += 15; break;
                            case 3: exaltCounts += 30; break;
                            case 4: exaltCounts += 50; break;
                            case 5: exaltCounts += 75; break;
                            default: continue;
                        }
                    }
                }
            }
        }
        let problems = []
        if (!(loggedRuns >= settings.vetverireqs.runs || realmEyeRuns >= settings.vetverireqs.runs || exaltCounts >= settings.vetverireqs.runs)) problems.push(1)
        if (maxedChars < settings.vetverireqs.maxed) problems.push(2)
        if (meleeMaxed < settings.vetverireqs.meleeMaxed) problems.push(3)
        if (problems.length == 0) {
            //vet verify
            veriLog.send(`${member} (${member} has been given the Veteran Raider role automatically)`)
            await member.roles.add(vetRaider)
            if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) await member.roles.remove(settings.roles.unverified)
            // db.query(`UPDATE users SET ${dungeon.dbisvet} = true WHERE id = '${u.id}'`)
        } else {
            //manual verify
            let whites = 0;
            let Weapons = 0;
            let Abilities = 0;
            let Armors = 0;
            let Rings = 0;
            let STs = 0;

            if (dungeon.lootInfo && lootInfo[dungeon.lootInfo]) for (let i in userInfo.characters) {
                let char = userInfo.characters[i]
                //weapon
                if (char.weapon) {
                    if (settings.vetverireqs.weapon) {
                        const match = char.weapon.match(/(^T(?<t1>\d+)|T(?<t2>\d+)$)/);
                        if (match) {
                            const tier = match.groups.t1 === undefined ? match.groups.t2 : match.groups.t1;
                            if (tier == settings.vetverireqs.weapon) Weapons++;
                        }
                    }
                    else if (lootInfo[dungeon.lootInfo].whites.includes(char.weapon.substring(0, char.weapon.lastIndexOf(' ')))) whites++;
                    else if (lootInfo[dungeon.lootInfo].STs.includes(char.weapon.substring(0, char.weapon.lastIndexOf(' ')))) STs++;

                }
                //ability
                if (char.ability) {
                    if (settings.vetverireqs.ability) {
                        const match = char.ability.match(/(^T(?<t1>\d+)|T(?<t2>\d+)$)/);
                        if (match) {
                            const tier = match.groups.t1 === undefined ? match.groups.t2 : match.groups.t1;
                            if (tier == settings.vetverireqs.ability) Abilities++;
                        }
                    }
                    if (lootInfo[dungeon.lootInfo].whites.includes(char.ability.substring(0, char.ability.lastIndexOf(' ')))) whites++;
                    else if (lootInfo[dungeon.lootInfo].STs.includes(char.ability.substring(0, char.ability.lastIndexOf(' ')))) STs++;
                }
                //armor
                if (char.armor) {
                    if (settings.vetverireqs.armor) {
                        const match = char.armor.match(/(^T(?<t1>\d+)|T(?<t2>\d+)$)/);
                        if (match) {
                            const tier = match.groups.t1 === undefined ? match.groups.t2 : match.groups.t1;
                            if (tier == settings.vetverireqs.armor) Armors++;
                        }
                    }
                    else if (lootInfo[dungeon.lootInfo].whites.includes(char.armor.substring(0, char.armor.lastIndexOf(' ')))) whites++;
                    else if (lootInfo[dungeon.lootInfo].STs.includes(char.armor.substring(0, char.armor.lastIndexOf(' ')))) STs++;
                }
                //ring
                if (char.ring) {
                    if (settings.vetverireqs.ring) {
                        const match = char.ring.match(/(^T(?<t1>\d+)|T(?<t2>\d+)$)/);
                        if (match) {
                            const tier = match.groups.t1 === undefined ? match.groups.t2 : match.groups.t1;
                            if (tier == settings.vetverireqs.ring) Rings++;
                        }
                    }
                    if (lootInfo[dungeon.lootInfo].whites.includes(char.ring.substring(0, char.ring.lastIndexOf(' ')))) whites++;
                    else if (lootInfo[dungeon.lootInfo].STs.includes(char.ring.substring(0, char.ring.lastIndexOf(' ')))) STs++;
                }
            }
            let description = `${member} [Player Link](https://www.realmeye.com/player/${ign})`;
            if (dungeon.webAppLink)
                description += ` - [Web App](https://losthalls.org/profile/${ign})`;

            let gearString = [
                { name: 'Weapons', count: Weapons, tier: settings.vetverireqs.weapon },
                { name: 'Abilities', count: Abilities, tier: settings.vetverireqs.ability },
                { name: 'Armors', count: Armors, tier: settings.vetverireqs.armor },
                { name: 'Rings', count: Rings, tier: settings.vetverireqs.ring }]
                .map(g => g.tier ? `T${g.tier} ${g.name}: ${g.count}` : '')
                .filter(g => g != '');
            gearString.push(`Whites: ${whites}`, `STs: ${STs}`);

            gearString = gearString.join(' | ');

            const problemList = ['-Not Enough Runs Completed', '-Not Enough Maxed Characters', '-Not Enough Maxed Melee Characters'];
            const problemString = problems.sort().map(v => problemList[v - 1]).join('\n') || 'None!';
            let mainEmbed = new Discord.EmbedBuilder()
                .setAuthor({ name: `${u.tag} tried to verify as a veteran under: ${ign}`, iconURL: u.avatarURL() || undefined })
                .setDescription(description);
            if (!profile)
                mainEmbed.addFields([{ name: 'Bot-Logged Runs:', value: `${loggedRuns || 0}` }]);
            else
                mainEmbed.addFields([{ name: 'Started Runs', value: `${profile.participation.reg || 0}` }])
                    .addFields([{ name: 'Completed Runs', value: `${profile.participation.completions || 0}` }]);
            mainEmbed.addFields([{ name: 'Realmeye Logged Runs:', value: `${realmEyeRuns || 0}` }])
                .addFields([{ name: 'Maxed Characters:', value: `Total: ${maxedChars} | Melee: ${meleeMaxed}` }])
                .addFields([{ name: 'Dungeon Specific Gear:', value: gearString || 'None!' }])

            for (let i of dungeon.exaltStats) {
                const count = [0, 0, 0, 0, 0, 0];
                let ishpmana = ['health', 'mana'].includes(i.toLowerCase());
                for (let j in exaltStats.exaltations) {
                    console.log(i, j, exaltStats.exaltations[j][i])
                    count[(exaltStats.exaltations[j][i] || 0) / (ishpmana ? 5 : 1)]++;
                }
                console.log(count);
                mainEmbed.addFields([{ name: `${i.charAt(0).toUpperCase() + i.slice(1)} Exaltations:`, value: count.map((val, idx) => `+${ishpmana ? idx * 5 : idx} \`${val}\``).join(' | ') }])
            }
            mainEmbed.addFields([{ name: 'Problems:', value: problemString }])
                .setFooter({ text: u.id })
                .setTimestamp()

            let pendingMessage = await veriPending.send({ embeds: [mainEmbed] })
            await pendingMessage.react('🔑')
            try {
                await u.send('You are currently under manual review for veteran verification. If you do not hear back within 48 hours, Please reach out to a Security or higher')
            } catch (e) {
                //User has DMs off
            }
            veriPending.send({ embeds: [await charList.getEmbed(ign, bot)] })
            this.pendingModule(pendingMessage, db)
        }
    },
    async restartPending(guild, db) {
        let settings = bot.settings[guild.id]
        let veriPending = guild.channels.cache.get(settings.channels.manualvetverification)
        let messages = await veriPending.messages.fetch({ limit: 100 })
        messages.each(m => {
            if (m.reactions.cache.has('🔑')) {
                this.pendingModule(m, db)
            }
        })
    },
    async pendingModule(message, db) {
        let manualVetVerifyLog = this.manualVetVerifyLog
        let settings = bot.settings[message.guild.id]
        if (watching.includes(message.embeds[0].footer.text)) return
        else watching.push(message.embeds[0].footer.text)
        if (!message.reactions.cache.has('🔑')) message.react('🔑')
        let vetRaider = message.guild.roles.cache.get(settings.roles.vetraider)
        let keyCollector = new Discord.ReactionCollector(message, { filter: KeyFilter })
        keyCollector.on('collect', async function (r, u) {
            let reactor = message.guild.members.cache.get(u.id)
            message.reactions.removeAll()
                .then(message.react('💯'))
                .then(message.react('👋'))
                .then(message.react('🔒'))
            let ManualVerificationCollector = new Discord.ReactionCollector(message, { filter: ManualFilter })
            ManualVerificationCollector.on('collect', async function (r, u) {
                if (!(u.id == reactor.id)) return;
                let embed = new Discord.EmbedBuilder()
                embed.data = message.embeds[0].data
                let member = message.guild.members.cache.get(embed.data.footer.text)
                const info = {
                    role: vetRaider,
                    guild: message.guild,
                    member: member,
                    staff: reactor,
                    reqs: settings.vetverireqs,
                    dungeon: dungeons[message.guild.id]
                };
                await message.reactions.removeAll();
                switch (r.emoji.name) {
                    case '💯':
                        //verify
                        await message.react('💯')
                        embed.setColor('#00ff00')
                        embed.setFooter({ text: `Accepted by ${reactor.nickname}` })
                        await message.edit({ embeds: [embed] })
                        await member.roles.add(vetRaider.id)
                        if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) await member.roles.remove(settings.roles.unverified)
                        //member.user.send(ext.parse(settings.messages.verifications.acceptvetveri, info))
                        try {
                            member.user.send(`You have been verified for the ${info.role.name} role in \`${info.guild.name}\`.`)
                        } catch (e) {
                            //user has DMs off
                        }
                        //db.query(`UPDATE users SET isVet = true WHERE id = '${u.id}'`)
                        manualVetVerifyLog(message, u.id, bot, db)
                        ManualVerificationCollector.stop()
                        keyCollector.stop()
                        removeFromArray(member.id)
                        break;
                    case '👋':
                        //deny
                        await message.react('👋')
                        embed.setColor('#ff0000')
                        embed.setFooter({ text: `Rejected by ${reactor.nickname}` })
                        await message.edit({ embeds: [embed] })
                        try {
                            if (settings.strings.vetVerifyDeniedMessage) {
                                member.user.send(`${settings.strings.vetVerifyDeniedMessage}`)
                            } else {
                                member.user.send(`You were denied from verifying for the \`${info.role.name}\` role in \`${info.guild.name}\`. Feel free to contact any Security+ staff member directly with screenshots in game if you have \`${info.reqs.runs}\` confirmable ${info.dungeon.boss} runs in your exaltations **or** between your live characters and graveyard.`)
                            }
                        } catch (e) {
                            //user has DMs off
                        }
                        ManualVerificationCollector.stop()
                        keyCollector.stop()
                        removeFromArray(member.id)
                        break;
                    case '🔒':
                        message.react('🔑')
                        ManualVerificationCollector.stop()
                        break;
                }
                function removeFromArray(id) {
                    let index = watching.indexOf(id)
                    if (index > -1) {
                        watching.splice(index, 1)
                    }
                }
            })
        })
    },
    async manualVetVerifyLog(message, authorid, bot, db) {
        let settings = bot.settings[message.guild.id]
        let currentweekverificationname, verificationtotalname
        for (let i in VerificationCurrentWeek) {
            i = VerificationCurrentWeek[i]
            if (message.guild.id == i.id && !i.vetdisabled) { 
                currentweekverificationname = i.vetverificationcurrentweek
                verificationtotalname = i.vetverificationtotal
            }
        }
        if (!currentweekverificationname || !verificationtotalname) return
        db.query(`UPDATE users SET ${verificationtotalname} = ${verificationtotalname} + 1, ${currentweekverificationname} = ${currentweekverificationname} + 1 WHERE id = '${authorid}'`)
        const guildQuota = quotas[message.guild.id]
        if (!guildQuota) return
        const parseQuota = guildQuota.quotas.filter(q => q.id == "security")[0]
        if (parseQuota) quota.update(message.guild, db, bot, settings, guildQuota, parseQuota)
    }
}
const checkFilter = (r, u) => !u.bot && r.emoji.name === '✅'
const KeyFilter = (r, u) => !u.bot && r.emoji.name === '🔑'
const ManualFilter = (r, u) => !u.bot && (r.emoji.name === '💯' || r.emoji.name === '👋' || r.emoji.name === '🔒' || r.emoji.name === '📧')