const Discord = require('discord.js')
const botSettings = require('../settings.json')
const ErrorLogger = require('../lib/logError')
const realmEyeScrape = require('../lib/realmEyeScrape')
const charList = require('./characterList')
const lootInfo = require('../data/lootInfo.json')
const ext = require('../lib/extensions');
const dungeons = require('../data/vetVerification.json')

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
        let vetVeriEmbed = new Discord.MessageEmbed()
            .setTitle(`Veteran Verification for ${message.guild.name}`)
            .addField('How to', 'React with the :white_check_mark: to get the role.\nMake sure to make your graveyard and character list public on realmeye before reacting\nAlso run the command ;stats to see your current run total.')
            .addField('Requirements', `${(settings.vetverireqs.maxed) ? `-${settings.vetverireqs.maxed} 8/8 Characters\n` : ''}${(settings.vetverireqs.meleemaxed) ? `-${settings.vetverireqs.meleemaxed} 8/8 Melee Characters\n` : ''}${(settings.vetverireqs.runs) ? `-${settings.vetverireqs.runs} Completed Runs\n` : ''}`)
        embedMessage = await vetVeriChannel.send(vetVeriEmbed)
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
        let reactionCollector = new Discord.ReactionCollector(embedMessage, checkFilter)
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
                if (err) ErrorLogger.log(err, bot)
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
            let graveyard = await realmEyeScrape.getGraveyardSummary(ign)
            for (let i in graveyard.achievements) {
                let achievement = graveyard.achievements[i]
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
                if (i == 'defense') continue
                for (let j in exaltStats.exalts) {
                    let e = exaltStats.exalts[j]
                    if (e[i]) switch (e[i].replace('+', '')) {
                        case '1': exaltCounts += 5; break;
                        case '2': exaltCounts += 15; break;
                        case '3': exaltCounts += 30; break;
                        case '4': exaltCounts += 50; break;
                        case '5': exaltCounts += 75; break;
                        default: continue;
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
            let mainEmbed = new Discord.MessageEmbed()
                .setAuthor(`${u.tag} tried to verify as a veteran under: ${ign}`, u.avatarURL())
                .setDescription(description);
            console.log(profile);
            if (!profile)
                mainEmbed.addField('Bot-Logged Runs:', `${loggedRuns || 0}`);
            else
                mainEmbed.addField('Started Runs', `${profile.participation.reg || 0}`)
                    .addField('Completed Runs', `${profile.participation.completions || 0}`);
            mainEmbed.addField('Realmeye Logged Runs:', `${realmEyeRuns || 0}`)
                .addField('Maxed Characters:', `Total: ${maxedChars} | Melee: ${meleeMaxed}`)
                .addField('Dungeon Specific Gear:', gearString || 'None!')
            for (let i of dungeon.exaltStats) {
                let count = { none: 0, one: 0, two: 0, three: 0, four: 0, five: 0 }
                for (let j in exaltStats.exaltations) {
                    if (exaltStats.exaltations[j][i]) switch (exaltStats.exaltations[j][i].replace('+', '')) {
                        case '1': count.one++; break;
                        case '2': count.two++; break;
                        case '3': count.three++; break;
                        case '4': count.four++; break;
                        case '5': count.five++; break;
                        default: count.none++; break;
                    } else count.none++
                }
                mainEmbed.addField(`${i.charAt(0).toUpperCase() + i.slice(1)} Exaltations:`, `+0 \`${count.none}\` | +1 \`${count.one}\` | +2 \`${count.two}\` | +3 \`${count.three}\` | +4 \`${count.four}\` | +5 \`${count.five}\``)
            }
            mainEmbed.addField('Problems:', problemString)
                .setFooter(u.id)
                .setTimestamp()

            let pendingMessage = await veriPending.send(mainEmbed)
            await pendingMessage.react('🔑')
            try {
                await u.send('You are currently under manual review for veteran verification. If you do not hear back within 48 hours, Please reach out to a Security or higher')
            } catch (e) {
                //User has DMs off
            }
            veriPending.send(await charList.getEmbed(ign, bot))
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
        let settings = bot.settings[message.guild.id]
        if (watching.includes(message.embeds[0].footer.text)) return
        else watching.push(message.embeds[0].footer.text)
        if (!message.reactions.cache.has('🔑')) message.react('🔑')
        let vetRaider = message.guild.roles.cache.get(settings.roles.vetraider)
        let keyCollector = new Discord.ReactionCollector(message, KeyFilter)
        keyCollector.on('collect', async function (r, u) {
            let reactor = message.guild.members.cache.get(u.id)
            message.reactions.removeAll()
                .then(message.react('💯'))
                .then(message.react('👋'))
                .then(message.react('🔒'))
            let ManualVerificationCollector = new Discord.ReactionCollector(message, ManualFilter)
            ManualVerificationCollector.on('collect', async function (r, u) {
                if (!(u.id == reactor.id)) return;
                let embed = message.embeds[0]
                let member = message.guild.members.cache.get(embed.footer.text)
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
                        embed.setFooter(`Accepted by ${reactor.nickname}`)
                        await message.edit(embed)
                        await member.roles.add(vetRaider.id)
                        //member.user.send(ext.parse(settings.messages.verifications.acceptvetveri, info))
                        try {
                            member.user.send(`You have been verified for the ${info.role.name} role in \`${info.guild.name}\`.`)
                        } catch (e) {
                            //user has DMs off
                        }
                        //db.query(`UPDATE users SET isVet = true WHERE id = '${u.id}'`)
                        ManualVerificationCollector.stop()
                        keyCollector.stop()
                        removeFromArray(member.id)
                        break;
                    case '👋':
                        //deny
                        await message.react('👋')
                        embed.setColor('#ff0000')
                        embed.setFooter(`Rejected by ${reactor.nickname}`)
                        await message.edit(embed)
                        //member.user.send(ext.parse(settings.messages.verifications.deniedvetveri, info))
                        try {
                            member.user.send(`You were denied from verifying for the \`${info.role.name}\` role in \`${info.guild.name}\`. Feel free to contact any Security+ staff member directly with screenshots in game if you have \`${info.reqs.runs}\` confirmable ${info.dungeon.boss} runs in your exaltations **or** between your live characters and graveyard.`)
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
    }
}
const checkFilter = (r, u) => !u.bot && r.emoji.name === '✅'
const KeyFilter = (r, u) => !u.bot && r.emoji.name === '🔑'
const ManualFilter = (r, u) => !u.bot && (r.emoji.name === '💯' || r.emoji.name === '👋' || r.emoji.name === '🔒' || r.emoji.name === '📧')