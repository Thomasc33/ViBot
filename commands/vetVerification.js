const Discord = require('discord.js')
const botSettings = require('../settings.json')
const ErrorLogger = require('../logError')
const realmEyeScrape = require('../realmEyeScrape')
const charList = require('./characterList')

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
        if (vetVeriChannel == null) return message.channel.send(`Vet Verification channel not found`)
        let vetVeriEmbed = new Discord.MessageEmbed()
            .setTitle('Veteran Verification for Lost Halls')
            .addField('How to', 'React with the :white_check_mark: to get the role.\nMake sure to make your graveyard and character list public on realmeye before reacting\nAlso run the command ;stats and -stats and see if you have a total of 100 runs completed.')
            .addField('Requirements', '-2 8/8 Characters\n-1 8/8 Melee Character\n-100 Completed Lost Halls')
        embedMessage = await vetVeriChannel.send(vetVeriEmbed)
        embedMessage.react('✅')
        this.init(message.guild, bot, db)
    },
    async init(guild, bott, db) {
        bot = bott
        let settings = bott.settings[guild.id]
        if (embedMessage == undefined) {
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
        if (member == null) return;
        if (watching.includes(u.id)) return
        if (member.roles.cache.has(vetRaider)) return;
        let loggedRuns = 0
        let isVet = false
        db.query(`SELECT * FROM users WHERE id = '${u.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (rows.length == 0) return
            loggedRuns += parseInt(rows[0].cultRuns)
            loggedRuns += parseInt(rows[0].voidRuns)
            isVet = rows[0].isVet
        })
        if (isVet) return member.roles.add(vetRaider)
        let userInfo = await realmEyeScrape.getUserInfo(ign)
        let maxedChars = 0;
        let meleeMaxed = 0;
        let realmEyeRuns = 0;
        for (let i in userInfo.characters) {
            let char = userInfo.characters[i]
            if (char.stats == '8/8') {
                maxedChars += 1;
                if (char.class == 'Warrior' || char.class == 'Knight' || char.class == 'Paladin') {
                    meleeMaxed += 1;
                }
            }
        }
        let graveyard = await realmEyeScrape.getGraveyardSummary(ign)
        for (let i in graveyard.achievements) {
            let achievement = graveyard.achievements[i]
            if (achievement.type == 'Lost Halls completed' || achievement.type == 'Voids completed' || achievement.type == 'Cultist Hideouts completed') {
                realmEyeRuns += parseInt(achievement.total)
            }
        }
        let problems = []
        if (!(loggedRuns >= settings.vetverireqs.runs || realmEyeRuns >= settings.vetverireqs.runs)) problems.push(1)
        if (maxedChars < settings.vetverireqs.maxed) problems.push(2)
        if (meleeMaxed < settings.vetverireqs.meleeMaxed) problems.push(3)
        if (problems.length == 0) {
            //vet verify
            veriLog.send(`${member} (${member} has been given the Veteran Raider role automatically)`)
            await member.roles.add(vetRaider)
            db.query(`UPDATE users SET voidsLead = true WHERE id = '${u.id}'`)
        } else {
            //manual verify
            let whites = 0;
            let t14Weapons = 0;
            let t14Armors = 0;
            let STs = 0;
            for (let i in userInfo.characters) {
                let char = userInfo.characters[i]
                //weapon
                if (char.weapon) {
                    if (char.weapon.includes('T14')) t14Weapons++;
                    else if (botSettings.lootInfo.whites.includes(char.weapon.substring(0, char.weapon.lastIndexOf(' ')))) whites++;
                    else if (botSettings.lootInfo.STs.includes(char.weapon.substring(0, char.weapon.lastIndexOf(' ')))) STs++;
                }
                //ability
                if (char.ability) {
                    if (botSettings.lootInfo.whites.includes(char.ability.substring(0, char.ability.lastIndexOf(' ')))) whites++;
                    else if (botSettings.lootInfo.STs.includes(char.ability.substring(0, char.ability.lastIndexOf(' ')))) STs++;
                }
                //armor
                if (char.armor) {
                    if (char.armor.includes('T14')) t14Armors++;
                    else if (botSettings.lootInfo.whites.includes(char.armor.substring(0, char.armor.lastIndexOf(' ')))) whites++;
                    else if (botSettings.lootInfo.STs.includes(char.armor.substring(0, char.armor.lastIndexOf(' ')))) STs++;
                }
                //ring
                if (char.ring) {
                    if (botSettings.lootInfo.whites.includes(char.ring.substring(0, char.ring.lastIndexOf(' ')))) whites++;
                    else if (botSettings.lootInfo.STs.includes(char.ring.substring(0, char.ring.lastIndexOf(' ')))) STs++;
                }

            }
            let mainEmbed = new Discord.MessageEmbed()
                .setAuthor(`${u.tag} tried to verify as a veteran under: ${ign}`, u.avatarURL())
                .setDescription(`${member} [Player Link](https://www.realmeye.com/player/${ign})`)
                .addField('Bot-Logged Runs:', `${loggedRuns}`)
                .addField('Realmeye Logged Runs:', `${realmEyeRuns}`)
                .addField('Maxed Characters:', `Total: ${maxedChars} | Melee: ${meleeMaxed}`)
                .addField('Halls Gear:', `Whites: ${whites} | T14 Weapons: ${t14Weapons} | T14 Armors: ${t14Armors} | STs: ${STs}`)
                .addField('Problems:', ' ')
                .setFooter(u.id)
                .setTimestamp()
            if (problems.includes(1)) mainEmbed.fields[4].value += '-Not Enough Runs Completed\n'
            if (problems.includes(2)) mainEmbed.fields[4].value += '-Not Enough Maxed Characters\n'
            if (problems.includes(3)) mainEmbed.fields[4].value += '-Not Enough Maxed Melee Characters\n'
            let pendingMessage = await veriPending.send(mainEmbed)
            await pendingMessage.react('🔑')
            await u.send('You are currently under manual review for veteran verification. If you do not hear back within 48 hours, Please reach out to a Security or higher')
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
                await message.reactions.removeAll();
                switch (r.emoji.name) {
                    case '💯':
                        //verify
                        await message.react('💯')
                        embed.setColor('#00ff00')
                        embed.setFooter(`Accepted by ${reactor.nickname}`)
                        await message.edit(embed)
                        await member.roles.add(vetRaider.id)
                        db.query(`UPDATE users SET voidsLead = true WHERE id = '${u.id}'`)
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
                    console.log(index)
                    if (index > -1) {
                        console.log(watching)
                        watching.splice(index, 1)
                        console.log(watching)
                    }
                }
            })
        })
    }
}
const checkFilter = (r, u) => !u.bot && r.emoji.name === '✅'
const KeyFilter = (r, u) => !u.bot && r.emoji.name === '🔑'
const ManualFilter = (r, u) => !u.bot && (r.emoji.name === '💯' || r.emoji.name === '👋' || r.emoji.name === '🔒')