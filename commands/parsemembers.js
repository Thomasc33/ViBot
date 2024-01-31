const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')
const afkCheck = require('./afkCheck.js')
const vision = require('@google-cloud/vision');
const realmEyeScrape = require('../lib/realmEyeScrape');
const charStats = require('../data/charStats.json')
const botSettings = require('../settings.json')
const ParseCurrentWeek = require('../data/currentweekInfo.json')
const quota = require('./quota')
const quotas = require('../data/quotas.json');
const afkTemplate = require('./afkTemplate.js');
const client = new vision.ImageAnnotatorClient(botSettings.gcloudOptions);
const parseQuotaValues = require('../data/parseQuotaValues.json');


module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    alias: ['pm'],
    args: '<image>',
    getNotes(guild, member, bot) {
        return 'Image can either be a link, or an embeded image'
    },
    role: 'eventrl',
    /**
     * 
     * @param {Discord.Message} message 
     * @param {string[]} args 
     * @param {Discord.Client} bot 
     * @param {import('mysql').Connection} db 
     * @returns 
     */
    async execute(message, args, bot, db) {
        // determine raid to parse
        let raidID
        let settings = bot.settings[message.guild.id]
        let memberVoiceChannel = message.member.voice.channel

        if (args.length && /^\d+$/.test(args[0])) //add ability to parse from a different channel with ;pm channelid <image>
            memberVoiceChannel = await bot.channels.fetch(args.shift());
        const raidIDs = Object.keys(bot.afkModules).filter(r => bot.afkModules[r].guild?.id == message.guild.id)

        if (raidIDs.length == 0)
            return message.channel.send('Could not find an active run. Please try again.')
        else if (raidIDs.length == 1) {
            raidID = raidIDs[0];
        }
        else if (raidIDs.some(r => bot.afkModules[r].channel != null && bot.afkModules[r].channel.id == memberVoiceChannel)) // prioritize vc
            raidID = raidIDs.find(r => bot.afkModules[r].channel != null && bot.afkModules[r].channel.id == memberVoiceChannel);
        else if (raidIDs.filter(r => bot.afkModules[r].members.includes(message.member.id)).length == 1) { // prioritize the raids they've joined
            raidID = raidIDs.find(r => bot.afkModules[r].members.includes(message.member.id));
        }  
        else {
            const raidMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Active Runs`)
                .setMinValues(1)
                .setMaxValues(1)
            let text = 'Which active run would you like to parse for?'
            let index = 0
            for (let id of raidIDs) {
                const label = `${bot.afkModules[id].afkTitle()}` // BUG this shows up undefined upon restart sometimes
                text += `\n\`\`${index+1}.\`\` ${label}`
                raidMenu.addOptions({ label: `${index+1}. ${bot.afkModules[id].afkTitle()}`, value: id })
                index++
            }
            const { value: id } = await message.selectPanel(text, null, raidMenu, 30000, false, true)
            if (!id) return await message.reply('You must specify the raid to parse, or join the raid\'s voice channel.')
            raidID = id
        }

        const raid = bot.afkModules[raidID];

        // start parse building
        let parseStatusEmbed = new Discord.EmbedBuilder()
            .setColor(`#00ff00`)
            .setTitle('Parse Status')
            .addFields([{ name: 'Parse By', value: `${message.member}` }])
            .addFields([{ name: 'Status', value: 'Gathering image' }])
        let parseStatusMessage = await message.channel.send({ embeds: [parseStatusEmbed] })
        let started = Date.now()
        let image;
        if (message.attachments.size) image = await message.attachments.first().proxyURL;
        else if (args.length) image = args[0]; //added check if args actually exists
        if (!image) {
            parseStatusEmbed.setColor('#ff0000')
                .data.fields[1].value = 'Error Getting Image'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            return;
        }
        parseStatusEmbed.data.fields[1].value = 'Sending Image to Google'
        parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
        try {
            const [result] = await client.textDetection(image);
            var imgPlayers = result.fullTextAnnotation;
            imgPlayers = imgPlayers.text.replace(/[\n,]/g, " ").split(/ +/)
            imgPlayers.shift()
            imgPlayers.shift()
            imgPlayers.shift()
        } catch (er) {
            parseStatusEmbed.data.fields[1].value = `Error: \`${er.message}\``
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            return;
        }

        const vcless = raid.vcOptions == afkTemplate.TemplateVCOptions.NO_VC

        async function runParse() {
            if (!vcless && !raid.channel) return message.reply("Channel not found, please join a vc or specify channel id");
            parseStatusEmbed.data.fields[1].value = 'Processing Data'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            
            const minimumStaffRolePosition = message.guild.roles.cache.get(settings.roles.almostrl).position

            const raiders = imgPlayers.map(player => player.toLowerCase())
            const raidMembers = !vcless && raid.members.concat(...raid.earlySlotMembers)
            const members = vcless ? Object.values(raid.reactables).map(r => r.members).flat() : bot.channels.cache.get(raid.channel.id).members.map(m => m.id)

            /** @type {{ id: string, nicknames: string[] }[]} */
            const alts = []
            /** @type {string[]} */
            const crashers = []
            const kick = []
            const find = []
            const otherChannel = []
            const allowedCrashers = []

            for (const player of raiders) {
                const member = message.guild.findMember(player)
                if (!member) {
                    crashers.push(player)
                    kick.push(player)
                } else if (!members.includes(member.id)) {
                    if (member.roles.highest.position >= minimumStaffRolePosition) continue

                    if (!vcless) {
                        if (raidMembers.includes(member.id)) allowedCrashers.push(member.id)
                        if (member.voice.channel) otherChannel.push(`${member}: ${member.voice.channel}`)
                        else crashers.unshift(`${member}`)
                    } else crashers.unshift(`${member}`)

                    kick.push(player)
                    find.push(player)
                }
            }

            for (const memberId of members) {
                const member = message.guild.members.cache.get(memberId)
                if (member.roles.highest.position > minimumStaffRolePosition) continue
                if (!member.nickname) continue
                const nicknames = member.nickname.toLowerCase().replace(/[^a-z|]/gi, '').split('|')
                if (!raiders.some(raider => nicknames.includes(raider)) && !alts.some(alt => alt.id == member.id)) alts.push({ id: member.id, nicknames })
            }

            const normalizedCrashers = crashers.map(normalizeName)
            const normalizedAlts = alts.map(({id, nicknames}) => ({ id, nicknames: nicknames.map(normalizeName) }))
            const results = reassembleAndCheckNames(normalizedCrashers, normalizedAlts)
            const [matchKeys, matchValues] = [Array.from(results.keys()), Array.from(results.values())]

            const actualCrashers = []
            const possibleAlts = []
            const actualKicks = []
            const actualFind = []
            for (const crasher_idx in crashers) {
                if (!matchValues.some(m => m.parts.includes(normalizedCrashers[crasher_idx]))) 
                    actualCrashers.push(crashers[crasher_idx])
            }

            for (const alt of normalizedAlts) {
                if (!matchKeys.some(full => alt.nicknames.some(name => full == name)))
                    possibleAlts.push(`<@${alt.id}>`)
            }

            for (const raider of kick) {
                if (!matchValues.some(m => m.parts.includes(normalizeName(raider))))
                    actualKicks.push(raider)
            }

            for (const raider of find) {
                if (!matchValues.some(m => m.includes(normalizeName(raider))))
                    actualFind.push(raider)
            }
            

            const embed = new Discord.EmbedBuilder()
                .setTitle(`Parse for ${raid.afkTitle()}`)
                .setColor('#00ff00')
                .setDescription(`There are ${actualCrashers.length} crashers, ${possibleAlts.length} potential alts` + (vcless ? '' : `, and ${otherChannel.length} people in other channels`))
                .addFields({ name: 'Potential Alts', value: possibleAlts.join(', ') || 'None' })
            
            if (!vcless) embed.addFields({ name: 'Other Channels', value: otherChannel.join('\n') || 'None' })
            
            embed.addFields(
                { name: 'Crashers', value: actualCrashers.join(', ') || 'None' }, 
                { name: 'Find Command', value: `\`\`\`;find ${actualFind.join(' ')}\`\`\`` }, 
                { name: 'Kick List', value: actualKicks.length ? `\`\`\`${actualKicks.join(' ')}\`\`\`` : 'None' }
            )

            if (!vcless) embed.addFields({
                name: `Were in VC`, 
                value: `The following can use the \`reconnect\` button:\n${allowedCrashers.map(u => `<@${u}>`).join(' ')}`
            })

            await message.channel.send({ embeds: [embed] });
            parseStatusEmbed.data.fields[1].value = `Crasher Parse Completed. See Below. Beginning Character Parse`
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

            if (settings.commands.crasherlist)
                postInCrasherList(embed, message.guild.channels.cache.get(settings.channels.parsechannel), message.member, raid.reactables?.Key?.members[0])
        }

        async function characterParse() {
            let unreachable = []
            let characterParseEmbed = new Discord.EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Character Parse')
            let promises = []
            for (let i in imgPlayers) {
                if (imgPlayers[i].replace(/[^a-z]/gi, '') == '') continue;
                await test()
                async function test() { //synchronous :sadge:
                    return new Promise(async res => {
                        realmEyeScrape.getUserInfo(imgPlayers[i]).then(characterInfo => {
                            function exit(me) {
                                if (me) console.log(me)
                                unreachable.push(imgPlayers[i]);
                                return res()
                            }
                            if (!characterInfo || !characterInfo.characters[0] || characterInfo.characters[0].class.replace(/[^a-zA-Z]/g, '') != characterInfo.characters[0].class) return exit()
                            let maxStats = charStats[characterInfo.characters[0].class.toLowerCase()]
                            if (!maxStats) return exit(`Stats for ${characterInfo.characters[0].class} is missing`)
                            let issue = false;
                            let character = characterInfo.characters[0]
                            let issueString = ''
                            //check for level 20
                            if (parseInt(character.level) != 20) {
                                issue = true
                                issueString += `\nNot level 20 (${character.level}/20)`
                            }
                            //check for max dex/attack
                            if (settings.backend.realmeyestats) {
                                let statstot = character.statsTotal.replace(/[^0-9-,]/g, '').split(',')
                                let statsbonus = character.statsBonus.replace(/[^0-9-,]/g, '').split(',')
                                let statsArray = []
                                for (let i in statstot) {
                                    statsArray.push(parseInt(statstot[i]) - parseInt(statsbonus[i]))
                                }
                                let stats = {
                                    hp: statsArray[0],
                                    mp: statsArray[1],
                                    att: statsArray[2],
                                    def: statsArray[3],
                                    spd: statsArray[4],
                                    vit: statsArray[5],
                                    wis: statsArray[6],
                                    dex: statsArray[7],
                                }
                                if (stats.dex < maxStats.dex) {
                                    issue = true;
                                    issueString += `\nDex is not maxed (${stats.dex}/${maxStats.dex})`
                                }
                                if (stats.att < maxStats.att) {
                                    issue = true;
                                    issueString += `\nAttack is not maxed (${stats.att}/${maxStats.att})`
                                }
                            }
                            //check for gear reqs
                            //weapon
                            if (character.weapon) {
                                let weaponTier = parseInt(character.weapon.split(/ +/).pop().replace('T', ''))
                                if (weaponTier < settings.runreqs.weapon && weaponTier !== NaN) {
                                    issue = true;
                                    issueString += `\nWeapon tier is too low (T${weaponTier})`
                                }
                            } else {
                                issue = true;
                                issueString += `Weapon is not equipped`
                            }
                            //ability
                            if (character.ability) {
                                if (character.class.toLowerCase() != 'trickster' && character.class.toLowerCase() != 'mystic') {
                                    let abilityTier = parseInt(character.ability.split(/ +/).pop().replace('T', ''))
                                    if (abilityTier < settings.runreqs.ability && abilityTier !== NaN) {
                                        issue = true;
                                        issueString += `\nAbility tier is too low (T${abilityTier})`
                                    }
                                }
                            } else {
                                issue = true;
                                issueString += `Ability is not equipped`
                            }
                            //armor
                            if (character.armor) {
                                let armorTier = parseInt(character.armor.split(/ +/).pop().replace('T', ''))
                                if (armorTier < settings.runreqs.armor && armorTier !== NaN) {
                                    issue = true;
                                    issueString += `\nArmor tier is too low (T${armorTier})`
                                }
                            } else {
                                issue = true;
                                issueString += `Armor is not equipped`
                            }
                            //ring
                            if (character.ring) {
                                let ringTier = parseInt(character.ring.split(/ +/).pop().replace('T', ''))
                                if (ringTier < settings.runreqs.ring && ringTier !== NaN) {
                                    issue = true;
                                    issueString += `\nRing tier is too low (T${ringTier})`
                                }
                            } else {
                                issue = true;
                                issueString += `Ring is not equipped`
                            }
                            if (issue) {
                                let characterEmote = bot.emojis.cache.find(e => e.name == character.class)
                                let weaponEmoji, abilityEmoji, armorEmoji, ringEmoji
                                if (!character.weapon) weaponEmoji = 'None'
                                else weaponEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.weapon.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                                if (!character.ability) abilityEmoji = 'None'
                                else abilityEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.ability.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                                if (!character.armor) armorEmoji = 'None'
                                else armorEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.armor.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                                if (!character.ring) ringEmoji = 'None'
                                else ringEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.ring.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                                if (characterParseEmbed.data.fields.length >= 24 || JSON.stringify(characterParseEmbed.toJSON()).length + issueString.length + 50 > 6000) {
                                    message.channel.send({ embeds: [characterParseEmbed] })
                                    characterParseEmbed.data.fields = []
                                }
                                characterParseEmbed.addFields([{ name: imgPlayers[i], value: `[Link](https://www.realmeye.com/player/${imgPlayers[i]}) | ${characterEmote} | LVL: \`${character.level}\` | Fame: \`${character.fame}\` | Stats: \`${character.stats}\` | ${weaponEmoji} ${abilityEmoji} ${armorEmoji} ${ringEmoji}${issueString}` }])
                                if (i % 5 == 0) {
                                    parseStatusEmbed.data.fields[1].value = `Parsing Characters (${i}/${imgPlayers.length})`
                                    parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
                                }
                            }
                            return res()
                        }).catch(er => {
                            ErrorLogger.log(er, bot, message.guild)
                            unreachable.push(imgPlayers[i])
                            return res()
                        })
                    })
                }
            }
            // await Promise.all(promises)
            let unreachableEmbed = new Discord.EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('The following were unreachable')
                .setDescription('None!')
            for (let i in unreachable) {
                if (unreachableEmbed.data.description == 'None!') unreachableEmbed.setDescription(`${unreachable[i]} `)
                else unreachableEmbed.setDescription(unreachableEmbed.data.description.concat(`, ${unreachable[i]}`))
            }
            await message.channel.send({ embeds: [characterParseEmbed] })
            await message.channel.send({ embeds: [unreachableEmbed] })
        }

        let parsePromises = [runParse()]
        if (settings.backend.characterparse) parsePromises.push(characterParse());

        await Promise.all(parsePromises)

        parseStatusEmbed.data.fields[1].value = 'Parse Completed'
        parseStatusEmbed.setFooter({ text: `Parse took ${(Date.now() - started) / 1000} seconds` })
        await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

        // log parse quota
        let currentWeekParseName, parseTotalName, commandName;

        if (parseQuotaValues.hasOwnProperty(message.guild.id) && parseQuotaValues[message.guild.id].includes(raid.afkTemplateName)) {
            for (let i in ParseCurrentWeek.o3parsecurrentweek) {
                i = ParseCurrentWeek.o3parsecurrentweek[i];
                if (message.guild.id == i.id && !i.disabled) {
                    currentWeekParseName = i.parsecurrentweek;
                    parseTotalName = i.parsetotal;
                }
            }
            commandName = 'o3ParseMembers';
        }
        else {
            for (let i in ParseCurrentWeek.parsecurrentweek) {
                i = ParseCurrentWeek.parsecurrentweek[i];
                if (message.guild.id == i.id && !i.disabled) {
                    currentWeekParseName = i.parsecurrentweek;
                    parseTotalName = i.parsetotal;
                }
            }
            commandName = 'parseMembers';
        }

        if (!currentWeekParseName || !parseTotalName) return;

        db.query('UPDATE users SET ?? = ?? + 1, ?? = ?? + 1 WHERE id = ?', [parseTotalName, parseTotalName, currentWeekParseName, currentWeekParseName, message.author.id]);
        db.query('INSERT INTO loggedusage (logged, userid, guildid, utime, amount) values (?, ?, ?, ?, ?)', [commandName, message.author.id, message.guild.id, Date.now(), 1]);
        const guildQuota = quotas[message.guild.id];
        if (!guildQuota) return;
        const parseQuota = guildQuota.quotas.filter(q => q.id == 'security')[0];
        if (parseQuota) {quota.update(message.guild, db, bot, settings, guildQuota, parseQuota);}
    }
}

async function postInCrasherList(embed, channel, parser, key) {

    let m
    if (key) {
        m = await channel.send(`<@!${key}> please double check with ${parser} \`${parser.nickname}\` before kicking anyone`, embed)
    } else {
        m = await channel.send({ embeds: [embed] })
    }
    setTimeout(() => { m.delete() }, 600000)
}

// Normalization function as defined earlier
function normalizeName(name) {
    return name.toLowerCase().replace(/\s/g, '').replace(/i/g, 'l');
}
//TODO: inRaidNames is now [{ id, nicknames }]
//return [{ currentName, { components, id }}]
// Function to reassemble and check split names
/**
 * 
 * @param {string[]} crasherNames 
 * @param {[{id: string, nicknames: string[]}]} raidMembers 
 * @returns {Map<string, { components: string[], id: string }}
 */
function reassembleAndCheckNames(crasherNames, raidMembers) {
    let matchedNamesMap = new Map();

    for (let i = 0; i < crasherNames.length; i++) {
        let currentName = '';
        const originalComponents = [];

        combine:
        for (let j = i; j < crasherNames.length; j++) {
            currentName += crasherNames[j];
            originalComponents.push(crasherNames[j]);

            for (const { id, nicknames } of raidMembers) {
                if (nicknames.includes(currentName)) {
                    matchedNamesMap.set(currentName, { parts: originalComponents, id })
                    i = j; // Skip the next names as they are part of the current one
                    break combine
                }
            }
        }
    }

    return matchedNamesMap
}

/**
 * 
 * @param {*} namesArray 
 * @param {*} matchedMap 
 * @returns {Map<string, { components: string[], id: string }}
 */
function filterNames(namesArray, matchedMap) {
    return namesArray.filter(name => {
        for (let [, originalNames] of matchedMap.entries()) {
            if (originalNames.components.includes(name)) {
                return false; // Exclude this name as it's part of a matched set
            }
        }
        return true; // Include this name as it's not part of any matched set
    });
}

