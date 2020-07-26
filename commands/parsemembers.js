const Discord = require('discord.js');
const ErrorLogger = require('../logError')
const RealmeyeScrape = require('../realmEyeScrape')
const vision = require('@google-cloud/vision');
const realmEyeScrape = require('../realmEyeScrape');
const charStats = require('../charStats.json')
const botSettings = require('../settings.json')
const client = new vision.ImageAnnotatorClient(botSettings.gcloudOptions);


module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    alias: ['pm'],
    args: '<image>',
    notes: 'Image can either be a link, or an embeded image',
    role: 'Almost Raid Leader',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        var channel = message.member.voice.channel
        if (channel == null) {
            message.channel.send('Channel not found. Make sure you are in a channel, then try again');
            return;
        }
        let parseStatusEmbed = new Discord.MessageEmbed()
            .setColor(`#00ff00`)
            .setTitle('Parse Status')
            .addField('Parse By', `${message.member}`)
            .addField('Status', 'Gathering image')
        let parseStatusMessage = await message.channel.send(parseStatusEmbed)
        var image;
        if (message.attachments.size == 0) {
            image = args[0];
        } else {
            image = await message.attachments.first().proxyURL;
        }
        if (image == null) {
            parseStatusEmbed.setColor('#ff0000')
                .fields[1].value = 'Error Getting Image'
            await parseStatusMessage.edit(parseStatusEmbed)
            return;
        }
        parseStatusEmbed.fields[1].value = 'Sending Image to Google'
        await parseStatusMessage.edit(parseStatusEmbed)
        try {
            const [result] = await client.textDetection(image)
            var players = result.fullTextAnnotation.text.replace(/[\n,]/g, " ").split(/ +/)
            players.shift()
            players.shift()
            players.shift()
        } catch (er) {
            parseStatusEmbed.fields[1].value = `Error: \`${er.message}\``
            await parseStatusMessage.edit(parseStatusEmbed)
            return;
        }
        parseStatusEmbed.fields[1].value = 'Processing Data'
        await parseStatusMessage.edit(parseStatusEmbed)
        var raiders = []
        for (let i in players) {
            raiders.push(players[i].toLowerCase())
        }
        var voiceUsers = []
        var alts = []
        var crashers = []
        var otherChannel = []
        var findA = []
        var kickList = '/kick'
        voiceUsers = channel.members.array();
        for (let i in raiders) {
            let player = raiders[i];
            if (player == '') continue;
            let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(player.toLowerCase()));
            if (member == null) {
                crashers.push(player);
                kickList = kickList.concat(` ${player}`)
            } else if (!voiceUsers.includes(member)) {
                if (member.roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) continue;
                if (member.voice.channel) {
                    otherChannel.push(`${member}: ${member.voice.channel}`);
                } else {
                    crashers.unshift(`<@!${member.id}>`);
                }
                kickList = kickList.concat(` ${player}`)
                findA.push(player)
            }
        }
        for (let i in voiceUsers) {
            if (voiceUsers[i].roles.highest.position >= message.guild.roles.cache.get(settings.roles.almostrl).position) continue;
            let nick = voiceUsers[i].nickname.toLowerCase().replace(/[^a-z|]/gi, '')
            if (!raiders.includes(nick)) {
                alts.push(`<@!${voiceUsers[i].id}>`);
            }
        }
        var crashersS = ' ', altsS = ' ', movedS = ' ', find = `;find `
        for (let i in crashers) { crashersS = crashersS.concat(crashers[i]) + ', ' }
        for (let i in alts) { altsS = altsS.concat(alts[i]) + ', ' }
        for (let i in otherChannel) { movedS = movedS.concat(otherChannel[i]) + '\n' }
        for (let i in findA) { find = find.concat(findA[i]) + ' ' }
        if (crashersS == ' ') { crashersS = 'None' }
        if (altsS == ' ') { altsS = 'None' }
        if (movedS == ' ') { movedS = 'None' }
        let embed = new Discord.MessageEmbed()
            .setTitle(`Parse for ${channel.name}`)
            .setColor('#00ff00')
            .setDescription(`There are ${crashers.length} crashers, ${alts.length} potential alts, and ${otherChannel.length} people in other channels`)
            .addFields(
                { name: 'Potential Alts', value: altsS },
                { name: 'Other Channels', value: movedS },
                { name: 'Crashers', value: crashersS },
                { name: 'Find Command', value: `\`\`\`${find}\`\`\`` },
                { name: 'Kick List', value: `\`\`\`${kickList}\`\`\`` }
            )
        await message.channel.send(embed);
        parseStatusEmbed.fields[1].value = `Crasher Parse Completed. See Below. Beginning Character Parse`
        await parseStatusMessage.edit(parseStatusEmbed)

        //post in crasher-list
        let key = null
        if (message.member.voice.channel && bot.afkChecks[message.member.voice.channel.id] && bot.afkChecks[message.member.voice.channel.id].key) key = bot.afkChecks[message.member.voice.channel.id].key
        postInCrasherList(embed, message.guild.channels.cache.get(settings.channels.parsechannel), message.member, key)

        //character parse
        let unreachable = []
        let characterParseEmbed = new Discord.MessageEmbed()
            .setColor('#00ff00')
            .setTitle('Character Parse')
        for (let i in players) {
            if (players[i] == '') continue;
            console.log('parsing ' + players[i])
            try {
                var characterInfo = await realmEyeScrape.getUserInfo(players[i])
            } catch (er) { unreachable.push(players[i]) }
            if (!characterInfo) { unreachable.push(players[i]); continue }
            if (!characterInfo.characters[0]) { unreachable.push(players[i]); continue }
            try {
                if (characterInfo.characters[0].class.replace(/[^a-zA-Z]/g, '') != characterInfo.characters[0].class) { unreachable.push(players[i]); continue }
                let maxStats = charStats[characterInfo.characters[0].class.toLowerCase()]
                if (!maxStats) { console.log(message.channel.send(`Stats for ${characterInfo.characters[0].class} is missing`)); continue; }
                let issue = false;
                let character = characterInfo.characters[0]
                let issueString = ''
                //check for level 20
                if (parseInt(character.level) != 20) {
                    issue = true
                    issueString += `\nNot level 20 (${character.level}/20)`
                }
                //check for max dex/attack
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
                    if (characterParseEmbed.fields.length >= 24 || characterParseEmbed.length + issueString.length + 50 > 6000) {
                        await message.channel.send(characterParseEmbed)
                        characterParseEmbed.fields = []
                    }
                    characterParseEmbed.addField(players[i], `[Link](https://www.realmeye.com/player/${players[i]}) | ${characterEmote} | LVL: \`${character.level}\` | Fame: \`${character.fame}\` | Stats: \`${character.stats}\` | ${weaponEmoji} ${abilityEmoji} ${armorEmoji} ${ringEmoji}${issueString}`)
                    if (i % 5 == 0) {
                        parseStatusEmbed.fields[1].value = `Parsing Characters (${i}/${players.length})`
                        await parseStatusMessage.edit(parseStatusEmbed)
                    }
                }
            } catch (er) {
                console.log(er)
                unreachable.push(player)
            }
        }
        let unreachableEmbed = new Discord.MessageEmbed()
            .setColor('#00ff00')
            .setTitle('The following were unreachable')
            .setDescription('None!')
        for (let i in unreachable) {
            if (unreachableEmbed.description == 'None!') unreachableEmbed.setDescription(`${unreachable[i]} `)
            else unreachableEmbed.setDescription(unreachableEmbed.description.concat(`, ${unreachable[i]}`))
        }
        await message.channel.send(characterParseEmbed)
        await message.channel.send(unreachableEmbed)
        parseStatusEmbed.fields[1].value = 'Parse Completed'
        await parseStatusMessage.edit(parseStatusEmbed)
    }
}

async function postInCrasherList(embed, channel, parser, key) {
    let m
    if (key) {
        m = await channel.send(`<@!${key}> please double check with ${parser} \`${parser.nickname}\` before kicking anyone`, embed)
    } else {
        m = await channel.send(embed)
    }
    setTimeout(() => { m.delete() }, 600000)
}