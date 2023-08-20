const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError')
const afkCheck = require('./afkCheck.js')
const vision = require('@google-cloud/vision');
const realmEyeScrape = require('../lib/realmEyeScrape');
const charStats = require('../data/charStats.json')
const botSettings = require('../settings.json')
const ParseCurrentWeek = require('../data/currentweekInfo.json').parsecurrentweek
const quota = require('./quota')
const quotas = require('../data/quotas.json')
const client = new vision.ImageAnnotatorClient(botSettings.gcloudOptions);


module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    alias: ['pm'],
    args: '<image>',
    getNotes(guild, member, bot) {
        return 'Image can either be a link, or an embeded image'
    },
    role: 'eventrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let channel = message.member.voice.channel

        if (args.length && /^\d+$/.test(args[0])) //add ability to parse from a different channel with ;pm channelid <image>
            channel = bot.channels.resolve(args.shift());

        if (!channel) return message.channel.send('Channel not found. Make sure you are in a channel, then try again');

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
            var players = result.fullTextAnnotation;
            players = players.text.replace(/[\n,]/g, " ").split(/ +/)
            players.shift()
            players.shift()
            players.shift()
        } catch (er) {
            parseStatusEmbed.data.fields[1].value = `Error: \`${er.message}\``
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            return;
        }

        async function crasherParse() {
            parseStatusEmbed.data.fields[1].value = 'Processing Data'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            var raiders = []
            for (let i in players) {
                raiders.push(players[i].toLowerCase())
            }
            var voiceUsers = []
            var alts = []
            var crashers = []
            var otherChannel = []
            var findA = []
            let allowedCrashers = []
            var kickList = '/kick'
            const raidIDs = afkCheck.returnRaidIDsbyMemberVoice(bot, channel.id)
            if (raidIDs.length == 0) return message.channel.send('No raid found in this channel')
            const raid = bot.afkChecks[raidIDs[0]]
            voiceUsers = channel.members.map(m => m);
            for (let i in raiders) {
                let player = raiders[i];
                if (player == '') continue;
                let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(player.toLowerCase()));
                if (member == null) {
                    crashers.push(player);
                    kickList = kickList.concat(` ${player}`)
                } else if (!voiceUsers.includes(member)) {
                    if (member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) continue;
                    if (raid.members.includes(member.id)) allowedCrashers.push(member)
                    if (member.voice.channel) otherChannel.push(`${member}: ${member.voice.channel}`);
                    else crashers.unshift(`<@!${member.id}>`);
                    kickList = kickList.concat(` ${player}`)
                    findA.push(player)
                }
            }
            for (let i in voiceUsers) {
                if (voiceUsers[i].roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) continue;
                if (!voiceUsers[i].nickname) continue
                let nick = voiceUsers[i].nickname.toLowerCase().replace(/[^a-z|]/gi, '')
                if (!raiders.includes(nick)) {
                    alts.push(`<@!${voiceUsers[i].id}>`);
                }
            }
            var crashersS = ' ',
                altsS = ' ',
                movedS = ' ',
                find = `;find `
            for (let i in crashers) { crashersS = crashersS.concat(crashers[i]) + ', ' }
            for (let i in alts) { altsS = altsS.concat(alts[i]) + ', ' }
            for (let i in otherChannel) { movedS = movedS.concat(otherChannel[i]) + '\n' }
            for (let i in findA) { find = find.concat(findA[i]) + ' ' }
            if (crashersS == ' ') { crashersS = 'None' }
            if (altsS == ' ') { altsS = 'None' }
            if (movedS == ' ') { movedS = 'None' }
            let embed = new Discord.EmbedBuilder()
                .setTitle(`Parse for ${channel.name}`)
                .setColor('#00ff00')
                .setDescription(`There are ${crashers.length} crashers, ${alts.length} potential alts, and ${otherChannel.length} people in other channels`)
                .addFields({ name: 'Potential Alts', value: altsS }, { name: 'Other Channels', value: movedS }, { name: 'Crashers', value: crashersS }, { name: 'Find Command', value: `\`\`\`${find}\`\`\`` }, { name: 'Kick List', value: `\`\`\`${kickList}\`\`\`` })
            if (raid) embed.addFields([{name: `Were in VC`, value: `The following can use the \`reconnect\` button:\n${allowedCrashers.map(u => `${u} `)}`}])
            await message.channel.send({ embeds: [embed] });
            parseStatusEmbed.data.fields[1].value = `Crasher Parse Completed. See Below. Beginning Character Parse`
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

            if (raid) {
                let id = raid.reactables.Key.members[0]
                if (id) {
                    let member = message.guild.members.cache.get(id)
                    if (member) {
                        message.channel.send(`/tell ${member.nickname} Can you kick the following people? **Don't copy paste names from kicklist. It may DC you**`)
                    }
                }
            }
            //post in crasher-list
            let key = null
            if (raid.reactables.Key && raid.reactables.Key.members[0]) key = raid.reactables.Key.members[0]
            if (settings.commands.crasherlist)
                postInCrasherList(embed, message.guild.channels.cache.get(settings.channels.parsechannel), message.member, key)
        }
        async function characterParse() {
            let unreachable = []
            let characterParseEmbed = new Discord.EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Character Parse')
            let promises = []
            for (let i in players) {
                if (players[i].replace(/[^a-z]/gi, '') == '') continue;
                await test()
                async function test() { //synchronous :sadge:
                    return new Promise(async res => {
                        realmEyeScrape.getUserInfo(players[i]).then(characterInfo => {
                            function exit(me) {
                                if (me) console.log(me)
                                unreachable.push(players[i]);
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
                                characterParseEmbed.addFields([{ name: players[i], value: `[Link](https://www.realmeye.com/player/${players[i]}) | ${characterEmote} | LVL: \`${character.level}\` | Fame: \`${character.fame}\` | Stats: \`${character.stats}\` | ${weaponEmoji} ${abilityEmoji} ${armorEmoji} ${ringEmoji}${issueString}` }])
                                if (i % 5 == 0) {
                                    parseStatusEmbed.data.fields[1].value = `Parsing Characters (${i}/${players.length})`
                                    parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
                                }
                            }
                            return res()
                        }).catch(er => {
                            ErrorLogger.log(er, bot, message.guild)
                            unreachable.push(players[i])
                            return res()
                        })
                    })
                }
            }
            //await Promise.all(promises)
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

        let parsePromises = []
        parsePromises.push(crasherParse())
        if (settings.backend.characterparse) parsePromises.push(characterParse())


        await Promise.all(parsePromises)

        parseStatusEmbed.data.fields[1].value = `Parse Completed`
        parseStatusEmbed.setFooter({ text: `Parse took ${(Date.now() - started) / 1000} seconds` })
        await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

        let currentweekparsename, parsetotalname
        for (let i in ParseCurrentWeek) {
            i = ParseCurrentWeek[i];
            if (message.guild.id == i.id && !i.disabled) {
                currentweekparsename = i.parsecurrentweek;
                parsetotalname = i.parsetotal
            }
        }
        if (!currentweekparsename || !parsetotalname) return
        db.query(`UPDATE users SET ${parsetotalname} = ${parsetotalname} + 1, ${currentweekparsename} = ${currentweekparsename} + 1 WHERE id = '${message.author.id}'`)
        db.query(`INSERT INTO loggedusage (logged, userid, guildid, utime, amount) values ('parseMembers', '${message.author.id}', '${message.guild.id}', '${Date.now()}', 1)`)
        const guildQuota = quotas[message.guild.id];
        if (!guildQuota) return;
        const parseQuota = guildQuota.quotas.filter(q => q.id == "security")[0]
        if (parseQuota)
            quota.update(message.guild, db, bot, settings, guildQuota, parseQuota)
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