const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')
const afkCheck = require('./afkCheck.js')
const vision = require('@google-cloud/vision');
const realmEyeScrape = require('../lib/realmEyeScrape');
const charStats = require('../data/charStats.json')
const ParseCurrentWeek = require('../data/currentweekInfo.json')
const quota = require('./quota')
const quotas = require('../data/quotas.json');
const afkTemplate = require('./afkTemplate.js');
const { settings, config: { gcloudOptions } } = require('../lib/settings');
const client = new vision.ImageAnnotatorClient(gcloudOptions);


module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    alias: ['pm'],
    args: '<image>',
    getNotes() {
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
        const { roles, channels, commands, runreqs, backend } = settings[message.guild.id];
        let memberVoiceChannel = message.member.voice.channel

        if (args.length && /^\d+$/.test(args[0])) //add ability to parse from a different channel with ;pm channelid <image>
            memberVoiceChannel = await bot.channels.fetch(args.shift());

        async function getRaid() {
            const raids = Object.values(bot.afkModules).filter(afk => afk.guild?.id == message.guild.id)
            if (raids.length == 0) {
                message.channel.send('Could not find an active run. Please try again.')
                return
            }

            if (raids.length == 1) return raids[0];
            if (raids.filter(afk => afk.channel?.id == memberVoiceChannel).length == 1)
                return raids.find(afk => afk.channel?.id == memberVoiceChannel)

            const raidMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Active Runs`)
                .setMinValues(1)
                .setMaxValues(1)
            let text = 'Which active run would you like to parse for?'
            for (let index = 0; index < raids.length; index++) {
                text += `\n\`\`${index+1}.\`\` ${raids[index].afkTitle()}`
                raidMenu.addOptions({ label: `${index+1}. ${raids[index].afkTitle()}`, value: String(index) })
            }
            const { value } = await message.selectPanel(text, null, raidMenu, 30000, false, true)
            if (value) return raids[value]
            await message.reply('You must specify the raid to parse, or join the raid\'s voice channel.')
        }
        
        const raid = await getRaid()
        if (!raid) return

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

        async function runParse() {
            if (!raid.isVcless() && !raid.channel) return message.reply("Channel not found, please join a vc or specify channel id");
            parseStatusEmbed.data.fields[1].value = 'Processing Data'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            
            const minimumStaffRolePosition = message.guild.roles.cache.get(roles.almostrl).position

            const raiders = imgPlayers.map(player => player.toLowerCase())
            const members = raid.isVcless() ? raid.members : bot.channels.cache.get(raid.channel.id).members.map(m => m.id)

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

                    if (!raid.isVcless()) {
                        if (raid.members.includes(member.id)) allowedCrashers.push(member.id)
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

            const actualCrashers = crashers.filter((_, idx) => !matchValues.some(m => m.parts.includes(normalizedCrashers[idx])))
            const possibleAlts = normalizedAlts.filter(alt => !matchKeys.some(full => alt.nicknames.some(name => full == name))).map(alt => `<@${alt.id}>`)
            const actualKicks = kick.filter(raider => !matchValues.some(m => m.parts.includes(normalizeName(raider))))
            const actualFind = find.filter(raider => !matchValues.some(m => m.parts.includes(normalizeName(raider))))
            

            const embed = new Discord.EmbedBuilder()
                .setTitle(`Parse for ${raid.afkTitle()}`)
                .setColor('#00ff00')
                .setDescription(`There are ${actualCrashers.length} crashers, ${possibleAlts.length} potential alts` + (raid.isVcless() ? '' : `, and ${otherChannel.length} people in other channels`))
                .addFields({ name: 'Potential Alts', value: possibleAlts.join(', ') || 'None' })
            
            if (!raid.isVcless()) embed.addFields({ name: 'Other Channels', value: otherChannel.join('\n') || 'None' })
            
            embed.addFields(
                { name: 'Crashers', value: actualCrashers.join(', ') || 'None' }, 
                { name: 'Find Command', value: `\`\`\`;find ${actualFind.join(' ')}\`\`\`` }, 
                { name: 'Kick List', value: actualKicks.length ? `\`\`\`${actualKicks.join(' ')}\`\`\`` : 'None' }
            )

            if (!raid.isVcless()) embed.addFields({
                name: `Were in VC`, 
                value: `The following can use the \`reconnect\` button:\n${allowedCrashers.map(u => `<@${u}>`).join(' ')}`
            })

            await message.channel.send({ embeds: [embed] });
            parseStatusEmbed.data.fields[1].value = `Crasher Parse Completed. See Below. Beginning Character Parse`
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

            if (commands.crasherlist) {
                postInCrasherList(embed, message.guild.channels.cache.get(channels.parsechannel), message.member, raid.getButton("Key")?.members[0])
            }
                
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
                            if (backend.realmeyestats) {
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
                                if (weaponTier < runreqs.weapon && weaponTier !== NaN) {
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
                                    if (abilityTier < runreqs.ability && abilityTier !== NaN) {
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
                                if (armorTier < runreqs.armor && armorTier !== NaN) {
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
                                if (ringTier < runreqs.ring && ringTier !== NaN) {
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
        if (backend.characterparse) parsePromises.push(characterParse());

        await Promise.all(parsePromises)

        parseStatusEmbed.data.fields[1].value = 'Parse Completed'
        parseStatusEmbed.setFooter({ text: `Parse took ${(Date.now() - started) / 1000} seconds` })
        await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

        // log parse quota
        let currentWeekParseName, parseTotalName, commandName;

        if (raid.buttons.some(button => button.name.toLowerCase() == 'winecellar incantation')) { // hope this never causes problems in the future
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
        if (parseQuota) {quota.update(message.guild, db, bot, guildQuota, parseQuota);}
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

// Function to reassemble and check split names
/**
 * 
 * @param {string[]} crasherNames 
 * @param {[{id: string, nicknames: string[]}]} raidMembers 
 * @returns {Map<string, { parts: string[], id: string }}
 */

function reassembleAndCheckNames(crasherNames, raidMembers) {
    let matchedNamesMap = new Map();

    const namesToCheck = crasherNames.slice(); // Copy array

    while (namesToCheck.length > 0 && raidMembers.length > 0) {
        let currentName = namesToCheck.shift();

        for (let i = 0; i <= namesToCheck.length; i++) {
            const matchedMember = raidMembers.find(({nicknames}) => nicknames.includes(currentName + namesToCheck.slice(0, i).join('')));
            if (matchedMember) {
                const matchedComponents = namesToCheck.splice(0, i);
                matchedNamesMap.set(currentName + matchedComponents.join(''), { parts: [currentName, ...matchedComponents], id: matchedMember.id })
            }
        }
    }

    return matchedNamesMap
}
 
