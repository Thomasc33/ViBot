const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const afkCheck = require('./afkCheck.js')
const vision = require('@google-cloud/vision')
const realmEyeScrape = require('../lib/realmEyeScrape')
const charStats = require('../data/charStats.json')
const botSettings = require('../settings.json')
const ParseCurrentWeek = require('../data/currentweekInfo.json').parsecurrentweek
const quota = require('./quota')
const quotas = require('../data/quotas.json')
const client = new vision.ImageAnnotatorClient(botSettings.gcloudOptions)

module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    alias: ['pm'],
    args: '<image>',
    getNotes() {
        return 'Image can either be a link, or an embeded image'
    },
    role: 'eventrl',
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        let { channel } = message.member.voice

        if (args.length && /^\d+$/.test(args[0])) channel = bot.channels.resolve(args.shift()) // add ability to parse from a different channel with ;pm channelid <image>

        if (!channel) return message.channel.send('Channel not found. Make sure you are in a channel, then try again')

        const parseStatusEmbed = new Discord.EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('Parse Status')
            .addFields([{ name: 'Parse By', value: `${message.member}` }])
            .addFields([{ name: 'Status', value: 'Gathering image' }])
        const parseStatusMessage = await message.channel.send({ embeds: [parseStatusEmbed] })
        const started = Date.now()
        let image
        if (message.attachments.size) image = await message.attachments.first().proxyURL
        else if (args.length) image = args[0] // added check if args actually exists
        if (!image) {
            parseStatusEmbed.setColor('#ff0000')
                .data.fields[1].value = 'Error Getting Image'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            return
        }
        parseStatusEmbed.data.fields[1].value = 'Sending Image to Google'
        parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
        const players = await client.textDetection(image)
            .then(([result]) => result.fullTextAnnotation.text.replace(/[\n,]/g, ' ').split(/ +/).splice(0, 3).filter(p => p))
            .catch(er => {
                parseStatusEmbed.data.fields[1].value = `Error: \`${er.message}\``
                parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            })
        if (!players) return

        async function crasherParse() {
            parseStatusEmbed.data.fields[1].value = 'Processing Data'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            let voiceUsers = []
            const alts = []
            const crashers = []
            const otherChannel = []
            const findA = []
            const allowedCrashers = []
            let kickList = '/kick'
            const raidIDs = afkCheck.returnRaidIDsbyMemberVoice(bot, channel.id)
            if (raidIDs.length == 0) return message.channel.send('No raid found in this channel')
            const raid = bot.afkChecks[raidIDs[0]]
            voiceUsers = channel.members.map(m => m)
            for (const player of players) {
                const member = message.guild.findMember(player)
                if (!member) {
                    crashers.push(player)
                    kickList = kickList.concat(` ${player}`)
                } else if (!voiceUsers.includes(member)) {
                    if (member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) continue
                    if (raid.members.includes(member.id)) allowedCrashers.push(member)
                    if (member.voice.channel) otherChannel.push(`${member}: ${member.voice.channel}`)
                    else crashers.unshift(`<@!${member.id}>`)
                    kickList = kickList.concat(` ${player}`)
                    findA.push(player)
                }
            }
            for (const user of voiceUsers) {
                if (user.roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) continue
                if (!user.nickname) continue
                const nick = user.nickname.toLowerCase().replace(/[^a-z|]/gi, '').split('|')
                if (!players.some(p => nick.includes(p.toLowerCase()))) {
                    alts.push(`<@!${user.id}>`)
                }
            }

            const embed = new Discord.EmbedBuilder()
                .setTitle(`Parse for ${channel.name}`)
                .setColor('#00ff00')
                .setDescription(`There are ${crashers.length} crashers, ${alts.length} potential alts, and ${otherChannel.length} people in other channels`)
                .addFields(
                    { name: 'Potential Alts', value: alts.join(', ') || 'None' },
                    { name: 'Other Channels', value: otherChannel.join('\n') || 'None' },
                    { name: 'Crashers', value: crashers.join(', ') || 'None' },
                    { name: 'Find Command', value: `\`\`\`${findA.join(' ')}\`\`\`` },
                    { name: 'Kick List', value: `\`\`\`${kickList}\`\`\`` })

            if (raid) embed.addFields({ name: 'Were in VC', value: `The following can use the \`reconnect\` button:\n${allowedCrashers.map(u => `${u} `)}` })
            await message.channel.send({ embeds: [embed] })
            parseStatusEmbed.data.fields[1].value = 'Crasher Parse Completed. See Below. Beginning Character Parse'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

            // post in crasher-list
            let key = null
            if (raid.reactables.Key && raid.reactables.Key.members[0]) key = raid.reactables.Key.members[0]
            if (settings.commands.crasherlist) {postInCrasherList(embed, message.guild.channels.cache.get(settings.channels.parsechannel), message.member, key)}
        }

        async function characterParse() {
            const unreachable = []
            const characterParseEmbed = new Discord.EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('Character Parse')

            const scrapes = Promise.all(players.map(player => realmEyeScrape.getUserInfo(player).catch(er => { ErrorLogger.log(er, bot, message.guild); unreachable.push(player) })))

            for (const i in players) {
                if (players[i].replace(/[^a-z]/gi, '') == '') continue

                const player = players[i]
                const characterInfo = scrapes[i]

                if (!characterInfo || !characterInfo.characters[0] || characterInfo.characters[0].class.replace(/[^a-zA-Z]/g, '') != characterInfo.characters[0].class) return unreachable.push(player)
                const character = characterInfo.characters[0]

                const maxStats = charStats[character.class.toLowerCase()]
                if (!maxStats) {
                    console.log(`Stats for ${character.class} is missing`)
                    return unreachable.push(player)
                }
                const issueString = getIssues(settings, character, maxStats)
                if (issueString) {
                    const characterEmote = bot.emojis.cache.find(e => e.name == character.class)
                    let weaponEmoji, abilityEmoji, armorEmoji, ringEmoji
                    if (character.weapon) weaponEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.weapon.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                    else weaponEmoji = 'None'
                    if (character.ability) abilityEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.ability.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                    else abilityEmoji = 'None'
                    if (character.armor) armorEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.armor.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                    else armorEmoji = 'None'
                    if (character.ring) ringEmoji = bot.emojis.cache.find(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(character.ring.split(' ').slice(0, -1).join('').toLowerCase().replace(/[^a-z0-9]/g, '')))
                    else ringEmoji = 'None'
                    if (characterParseEmbed.data.fields.length >= 24 || JSON.stringify(characterParseEmbed.toJSON()).length + issueString.length + 50 > 6000) {
                        message.channel.send({ embeds: [characterParseEmbed] })
                        characterParseEmbed.data.fields = []
                    }
                    characterParseEmbed.addFields([{ name: player, value: `[Link](https://www.realmeye.com/player/${player}) | ${characterEmote} | LVL: \`${character.level}\` | Fame: \`${character.fame}\` | Stats: \`${character.stats}\` | ${weaponEmoji} ${abilityEmoji} ${armorEmoji} ${ringEmoji}${issueString}` }])
                    if (i % 5 == 0) {
                        parseStatusEmbed.data.fields[1].value = `Parsing Characters (${i}/${players.length})`
                        parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
                    }
                }
            }
            // await Promise.all(promises)
            const unreachableEmbed = new Discord.EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('The following were unreachable')
                .setDescription('None!')
            for (const i in unreachable) {
                if (unreachableEmbed.data.description == 'None!') unreachableEmbed.setDescription(`${unreachable[i]} `)
                else unreachableEmbed.setDescription(unreachableEmbed.data.description.concat(`, ${unreachable[i]}`))
            }
            await message.channel.send({ embeds: [characterParseEmbed] })
            await message.channel.send({ embeds: [unreachableEmbed] })
        }

        const parsePromises = []
        parsePromises.push(crasherParse())
        if (settings.backend.characterparse) parsePromises.push(characterParse())

        await Promise.all(parsePromises)

        parseStatusEmbed.data.fields[1].value = 'Parse Completed'
        parseStatusEmbed.setFooter({ text: `Parse took ${(Date.now() - started) / 1000} seconds` })
        await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })

        let currentweekparsename, parsetotalname
        for (const week of ParseCurrentWeek) {
            if (message.guild.id == week.id && !week.disabled) {
                currentweekparsename = week.parsecurrentweek
                parsetotalname = week.parsetotal
            }
        }
        if (!currentweekparsename || !parsetotalname) return
        db.query(`UPDATE users SET ${parsetotalname} = ${parsetotalname} + 1, ${currentweekparsename} = ${currentweekparsename} + 1 WHERE id = '${message.author.id}'`)
        db.query(`INSERT INTO loggedusage (logged, userid, guildid, utime, amount) values ('parseMembers', '${message.author.id}', '${message.guild.id}', '${Date.now()}', 1)`)
        const guildQuota = quotas[message.guild.id]
        if (!guildQuota) return
        const parseQuota = guildQuota.quotas.filter(q => q.id == 'security')[0]
        if (parseQuota) {quota.update(message.guild, db, bot, settings, guildQuota, parseQuota)}
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

async function getIssues(settings, character, maxStats) {
    let issueString = ''
    // check for level 20
    if (parseInt(character.level) != 20) issueString += `\nNot level 20 (${character.level}/20)`

    // check for max dex/attack
    if (settings.backend.realmeyestats) {
        const statstot = character.statsTotal.replace(/[^0-9-,]/g, '').split(',')
        const statsbonus = character.statsBonus.replace(/[^0-9-,]/g, '').split(',')
        const statsArray = []
        // eslint-disable-next-line guard-for-in
        for (const i in statstot) {
            statsArray.push(parseInt(statstot[i]) - parseInt(statsbonus[i]))
        }
        const stats = {
            hp: statsArray[0],
            mp: statsArray[1],
            att: statsArray[2],
            def: statsArray[3],
            spd: statsArray[4],
            vit: statsArray[5],
            wis: statsArray[6],
            dex: statsArray[7]
        }
        if (stats.dex < maxStats.dex) {
            issueString += `\nDex is not maxed (${stats.dex}/${maxStats.dex})`
        }
        if (stats.att < maxStats.att) {
            issueString += `\nAttack is not maxed (${stats.att}/${maxStats.att})`
        }
    }
    // check for gear reqs
    // weapon
    if (character.weapon) {
        const weaponTier = parseInt(character.weapon.split(/ +/).pop().replace('T', ''))
        if (weaponTier < settings.runreqs.weapon && !isNaN(weaponTier)) {
            issueString += `\nWeapon tier is too low (T${weaponTier})`
        }
    } else {
        issueString += 'Weapon is not equipped'
    }
    // ability
    if (character.ability) {
        if (character.class.toLowerCase() != 'trickster' && character.class.toLowerCase() != 'mystic') {
            const abilityTier = parseInt(character.ability.split(/ +/).pop().replace('T', ''))
            if (abilityTier < settings.runreqs.ability && !isNaN(abilityTier)) {
                issueString += `\nAbility tier is too low (T${abilityTier})`
            }
        }
    } else {
        issueString += 'Ability is not equipped'
    }
    // armor
    if (character.armor) {
        const armorTier = parseInt(character.armor.split(/ +/).pop().replace('T', ''))
        if (armorTier < settings.runreqs.armor && !isNaN(armorTier)) {
            issueString += `\nArmor tier is too low (T${armorTier})`
        }
    } else {
        issueString += 'Armor is not equipped'
    }
    // ring
    if (character.ring) {
        const ringTier = parseInt(character.ring.split(/ +/).pop().replace('T', ''))
        if (ringTier < settings.runreqs.ring && !isNaN(ringTier)) {
            issueString += `\nRing tier is too low (T${ringTier})`
        }
    } else {
        issueString += 'Ring is not equipped'
    }
    return issueString
}
