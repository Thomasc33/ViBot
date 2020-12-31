const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const botSettings = require('../settings.json')
const realmEyeScrape = require('../realmEyeScrape')

var verificationChannel
var verificationMessage
var watching = []
var active = []
var embedMessage


module.exports = {
    name: 'verification',
    description: 'Verification Module',
    args: 'create/update',
    role: 'moderator',
    async execute(message, args, bot, db) {
        if (!bot.settings[message.guild.id].backend.verification) return
        switch (args[0].toLowerCase()) {
            case 'create':
                this.create(message, bot)
            case 'update':
                this.manualVerifyUpdate(message.guild, bot, db);
        }
    },
    async create(message, bot) {
        let settings = bot.settings[message.guild.id]
        verificationChannel = message.guild.channels.cache.get(settings.channels.verification)
        verificationChannel.bulkDelete(100)
        let verificationEmbed = new Discord.MessageEmbed()
            .setColor('#015c21')
            .setTitle('Verification Steps')
            .setDescription(`**1.** Unprivate your discord PM's to ensure bot can reach you
            
            **2** Log in to your realmeye page and unprivate everything except for \`last known location\`. If you do not have a password for realmeye, ingame type \`/tell MrEyeBall password\` to get one

            **3.** React with the :white_check_mark: below

            **4.** Wait for the bot to PM you with further instructions.`)
        verificationMessage = await verificationChannel.send(verificationEmbed)
        verificationMessage.react('✅')
    },
    async init(guild, bot, db) {
        let settings = bot.settings[guild.id]
        if (!embedMessage) {
            let veriChannel = guild.channels.cache.get(settings.channels.verification)
            if (veriChannel == null) return;
            let messages = await veriChannel.messages.fetch({ limit: 1 })
            embedMessage = messages.first()
        }
        let reactionCollector = new Discord.ReactionCollector(embedMessage, (r, u) => !u.bot && r.emoji.name == '✅')
        reactionCollector.on('collect', (r, u) => {
            this.verify(u, guild, bot, db)
        })
        this.manualVerifyUpdate(guild, bot, db)
    },
    async verify(u, guild, bot, db) {
        //initial variables
        let settings = bot.settings[guild.id]
        let member = guild.members.cache.get(u.id);
        let veriactive = guild.channels.cache.get(settings.channels.veriactive)
        let veripending = guild.channels.cache.get(settings.channels.manualverification)
        let verilog = guild.channels.cache.get(settings.channels.verificationlog)
        let veriattempts = guild.channels.cache.get(settings.channels.veriattempts)
        if (!veriactive || !veripending || !verilog || !veriattempts) return ErrorLogger.log(new Error(`ID For a verificiation channel is missing`), bot)

        //check to see if they are currently under review and veri-blacklist
        if (active.includes(u.id)) return
        if (watching.includes(u.id)) return u.send(`You are currently under manual verification. If you do not hear back within 48 hours, please DM me again to contact modmail`).catch(er => { })
        if (await checkBlackList(u.id, db)) return u.send(`You are currently blacklisted from verifying. Please DM me to contact mod-mail and find out why`)
        active.push(u.id)

        //log that they are attempting to verify
        let LoggingEmbed = new Discord.MessageEmbed()
            .setColor('#00ff00')
            .setAuthor(`${u.tag} is attempting to verify`)
            .setDescription(`<@!${u.id}> has started the verification process`)
            .setFooter(`ID: ${u.id}`)
        if (u.avatarURL()) LoggingEmbed.author.iconURL = u.avatarURL()
        veriattempts.send(LoggingEmbed)
        let activeMessage = await veriactive.send(LoggingEmbed)

        //check other servers for verification
        let res = await this.reVerify(u, guild, bot, db) //true = verified, false = not verified

        //dm user
        let embed = new Discord.MessageEmbed()
            .setColor('#015c21')
            .setTitle(`<${botSettings.emote.hallsPortal}> Your verification status! <${botSettings.emote.hallsPortal}>`)
        if (!res) embed.setDescription(`__**You have not been verified yet! Please follow the instructions below**__\n\n**Please enter your in game name** Enter it actually how it is spelled in game (Ex. \`Vi\`).\nCapitalization doesn't matter\n\n*React with ❌ at anytime to cancel*`)
            .setFooter(`There is a 15 minute timer that updates every 30 seconds...`)
        let dms = await u.createDM()
        let embedMessage = await dms.send(embed)

        //stop verification if reverifying
        let ign
        if (res) {
            ign = res;
            return autoVerify()
        }

        //abort collector
        let abortCollector = new Discord.ReactionCollector(embedMessage, (r, u) => !u.bot && r.emoji.name == '❌')
        let reactionCollectors = [], checkingIGN = false
        abortCollector.on('collect', async (r, u) => {
            if (r.emoji.name != '❌') return; //not needed, but just in case :)
            if (checkingIGN) return
            for (let i in reactionCollectors) {
                reactionCollectors[i].stop()
            }
            cancelVerification(1)
        })
        embedMessage.react('❌')

        //update every 30 seconds
        let time = 900 //15 minutes = 900 seconds
        let timer = bot.setInterval(update, 30000)
        function update() {
            if (time <= 0) return cancelVerification(0)
            if (!embed || !LoggingEmbed) return
            time -= 30
            let min = Math.floor(time / 60)
            let seconds = time % 60
            embed.setFooter(`Time remaining: ${min} minutes ${seconds} seconds`)
            embedMessage.edit(embed)
            LoggingEmbed.setFooter(`Their verification has ${min} minutes and ${seconds} seconds left`)
            activeMessage.edit(LoggingEmbed).catch(er => { })
        }

        //cancels verification
        async function cancelVerification(reason) {
            //0=timeout,1=aborted,2=blacklisted ign,3=dupe
            switch (reason) {
                case 0:
                    LoggingEmbed.setDescription(`<@!${u.id}> verification timed out`)
                    embed.setDescription(`Verification Timed Out`)
                    break;
                case 1:
                    LoggingEmbed.setDescription(`<@!${u.id}> cancelled their verification`)
                    embed.setDescription(`Verification aborted`)
                    break;
                case 2:
                    LoggingEmbed.setDescription(`<@!${u.id}> was auto-denied because ${ign} is blacklisted`)
                    embed.setDescription(`You are currently blacklisted from verifying. Please DM me to contact mod-mail and find out why`)
                    break;
                case 3:
                    LoggingEmbed.setDescription(`<@!${u.id}> was auto-denied because ${ign} already exists in the server`)
                    embed.setDescription(`There is already a member verified under ${ign}. If this is an error, please DM me to get in contact with mod-mail`)
                    break;
            }
            embed.footer = null
            LoggingEmbed.setColor(`#ff0000`)
            activeMessage.delete()
            veriattempts.send(LoggingEmbed)
            active.splice(active.indexOf(u.id), 1)
            embedMessage.edit(embed)
            bot.clearInterval(timer)
        }

        //get users ign
        ign = await getIgn()
        async function getIgn() {
            return new Promise(async (resolve, reject) => {
                let ignCollector = new Discord.MessageCollector(dms, m => !m.author.bot)
                reactionCollectors.push(ignCollector)
                ignCollector.on("collect", async m => {
                    if (m.content.split(/ +/).length > 1) {
                        embed.setDescription(`Please enter only your IGN.\nTry again`)
                        embedMessage.edit(embed)
                    } else {
                        let ign = m.content
                        if (ign.replace(/[^a-z]/gi, '') != ign) {
                            embed.setDescription(`Please only enter letters.\nTry again`)
                            embedMessage.edit(embed)
                        } else {
                            embed.setDescription(`Are you sure you wish to verify as: \`${ign}\`\n`)
                            embedMessage.edit(embed)
                            embedMessage.react('✅')
                                .then(embedMessage.react('❌'))
                            checkingIGN = true
                            let confirmReactionCollector = new Discord.ReactionCollector(embedMessage, (r, u) => !u.bot && (r.emoji.name == '✅' || r.emoji.name == '❌'))
                            confirmReactionCollector.on('collect', async (r, u) => {
                                if (r.emoji.name == '✅') {
                                    resolve(ign)
                                    ignCollector.stop()
                                    checkingIGN = false
                                } else {
                                    embed.setDescription(`__**You have not been verified yet! Please follow the instructions below**__\n\n**Please enter your in game name** Enter it actually how it is spelled in game (Ex. \`Vi\`).\n`)
                                    embedMessage.edit(embed)
                                }
                                confirmReactionCollector.stop()
                            })
                        }
                    }
                })
            })
        }

        //check blacklist for ign
        if (await checkBlackList(ign, db)) return cancelVerification(2)

        //verify name isnt in server yet
        let dupes = guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(ign.toLowerCase()));
        if (dupes) {
            return cancelVerification(3)
        } else {
            LoggingEmbed.setDescription(`<@!${u.id}> is attempting to verify under [${ign}](https://www.realmeye.com/player/${ign})`)
            veriattempts.send(LoggingEmbed)
            activeMessage.edit(LoggingEmbed).catch(er => { })
        }

        //generate and give vericode
        let vericode = `PUBHALLS-${Math.floor(Math.random() * 10000)}`
        embed.setDescription(`You have chosen to verify under: \`${ign}\`\n\nPlease add the following code into your realmeye description:\n\`\`\`${vericode}\`\`\`\nRe-react to the ✅ when it is done`)
        embedMessage.edit(embed)
        let veriCodeReactionCollector = new Discord.ReactionCollector(embedMessage, (r, u) => !u.bot && r.emoji.name == '✅')
        reactionCollectors.push(veriCodeReactionCollector)
        veriCodeReactionCollector.on('collect', async (r, u) => {
            //check realmeye description for vericode
            let userInfo = await realmEyeScrape.getGraveyardSummary(ign).catch(er => {
                //ErrorLogger.log(er, bot)
                if (er == 'Unloaded Graveyard') {
                    embed.setDescription(`Your graveyard is not loaded on realmeye or it is privated. If you are sure it is set to public then go to your graveyard and click on the button that says:\n\`Click here if you think that some of your deceased heros are still missing!\`\nOnce you are done, re-react with the ✅`)
                    embedMessage.edit(embed)
                    LoggingEmbed.setDescription(`<@!${u.id}> Needs to load in their graveyard on their realmeye page *clicking the button*`)
                    LoggingEmbed.setColor('#ff0000')
                    activeMessage.edit(LoggingEmbed).catch(er => { })
                    veriattempts.send(LoggingEmbed)
                    return;
                } else {
                    embed.setDescription(`There was an error checking your realmeye page. Please make sure everything except last known location is public, then re-react with the ✅`)
                    embedMessage.edit(embed)
                    LoggingEmbed.setDescription(`<@!${u.id}> Needs to unprivate parts of their realmeye to verify`)
                    LoggingEmbed.setColor('#ff0000')
                    activeMessage.edit(LoggingEmbed)
                    veriattempts.send(LoggingEmbed)
                    return;
                }

            })
            if (!userInfo) return
            LoggingEmbed.setColor('#00ff00')
            let found = false;
            for (let i in userInfo.desc) {
                if (userInfo.desc[i].includes(vericode)) found = true
            }
            if (!found) {
                embed.setDescription(`The veri-code was not found in your realmeye page. It may take a few seconds to update on realmeye. Please re-react to the ✅ in about 30 seconds`)
                embedMessage.edit(embed)
                LoggingEmbed.setDescription(`<@!${u.id}> tried to verify, but their veri-code was not in their realmeye description`)
                LoggingEmbed.setColor('#ffff00')
                activeMessage.edit(LoggingEmbed)
                veriattempts.send(LoggingEmbed)
            } else {
                //if code matches, check against requirements
                LoggingEmbed.setColor(`#00ff00`)
                let denyReason = [];
                //stars
                if (parseInt(userInfo.rank) < settings.autoveri.stars) denyReason.push({
                    reason: 'Star Count',
                    stat: `${userInfo.rank}/${settings.autoveri.stars}`
                })
                //fame
                if (parseInt(userInfo.fame) < settings.autoveri.fame) denyReason.push({
                    reason: 'Fame Count',
                    stat: `${userInfo.fame}/${settings.autoveri.fame}`
                })
                //discord account age
                if (u.createdTimestamp > Date.now() - (settings.autoveri.discordage * 2592000000)) denyReason.push({
                    reason: 'Discord Account Age'
                });
                //realm account age
                let days = userInfo.created.split(/ +/)
                let daysValid = false
                for (let i in days) { if (parseInt(days[i].replace(/[^0-9]/g, '')) >= settings.autoveri.realmage) daysValid = true }
                if (!(userInfo.created.includes('year') || daysValid)) denyReason.push({
                    reason: 'Realm Account Age'
                })
                //death count
                if (parseInt(userInfo.deaths[userInfo.deaths.length - 1]) < settings.autoveri.deathcount) denyReason.push({
                    reason: 'Death Count',
                    stat: `${userInfo.deaths[userInfo.deaths.length - 1]}/${settings.autoveri.deathcount}`
                })
                if (denyReason.length == 0) autoVerify()
                else manualVerify(denyReason, userInfo)
                veriCodeReactionCollector.stop()
            }
        })

        //manual verify
        async function manualVerify(reasons, data) {
            bot.clearInterval(timer)
            embed.setDescription(`Your account is now under manual review, please do not attempt to verify again. If your account has not been reviewed within the next 48 hours, please contact the staff __**through modmail**__ **by sending me a message.** Please **DO NOT** contact a staff member directly about being verified unless you are told to do so.`)
                .setColor('#ff0000')
                .footer = null
            embedMessage.edit(embed)
            activeMessage.delete()
            active.splice(active.indexOf(u.id), 1)
            LoggingEmbed.setDescription(`<@!${u.id}> Attempted to verify, however, they had issues with their profile and are now under manual review`)
            veriattempts.send(LoggingEmbed)
            let manualEmbed = new Discord.MessageEmbed()
                .setAuthor(`${u.tag} is attempting to verify as: ${ign}`, u.avatarURL())
                .setDescription(`<@!${u.id}> : [Realmeye Link](https://www.realmeye.com/player/${ign})`)
                .addFields(
                    { name: 'Rank', value: `${data.rank}`, inline: true },
                    { name: 'Guild', value: `${data.guild}`, inline: true },
                    { name: 'Guild Rank', value: `${data.guild_rank}`, inline: true },
                    { name: 'Alive Fame', value: `${data.fame}`, inline: true },
                    { name: 'Death Fame', value: `${data.account_fame}`, inline: true },
                    { name: 'Deaths', value: `${data.deaths[data.deaths.length - 1]}`, inline: true },
                    { name: 'Account Created', value: `${data.created}`, inline: true },
                    { name: 'Last seen', value: `${data.player_last_seen}`, inline: true },
                    { name: 'Character Count', value: `${data.chars}`, inline: true },
                    { name: 'Skins', value: `${data.skins}`, inline: true },
                    { name: 'Discord account created', value: u.createdAt, inline: false },
                )
                .setFooter(u.id)
            let reason = ''
            reasons.forEach(r => {
                reason += `-${r.reason}`
                if (r.stat) reason += ` ${r.stat}`
                reason += '\n'
            })
            reason = reason.trim()
            if (reason != '') manualEmbed.addField('Problems', reason)
            let m = await veripending.send(manualEmbed)
            await m.react('🔑')
            module.exports.watchMessage(m, bot, db)
        }

        //autoverify
        async function autoVerify() {
            let tag = member.user.tag.substring(0, member.user.tag.length - 5)
            let nick = ''
            if (tag == ign) {
                nick = ign.toLowerCase()
                if (tag == nick) {
                    nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
                }
            } else nick = ign
            await member.setNickname(nick)
            setTimeout(() => { member.roles.add(settings.roles.raider) }, 1000)
            db.query(`INSERT INTO users (id) VALUES ('${u.id}')`, err => {
                if (err) return
            })
            embed.setDescription('Welcome to the server. You have been verified. Please head over to rules, faq, and raiding-rules channels to familiarize yourself with the server. Happy raiding')
            embedMessage.edit(embed)
            LoggingEmbed.setDescription(`<@!${u.id}> has successfully verified under [${ign}](https://www.realmeye.com/player/${ign})`)
            verilog.send(LoggingEmbed)
            veriattempts.send(LoggingEmbed)
            activeMessage.delete()
            active.splice(active.indexOf(u.id), 1)
        }
    },
    async manualVerifyUpdate(guild, bot, db) {
        let settings = bot.settings[guild.id]
        let veriPending = guild.channels.cache.get(settings.channels.manualverification)
        let messages = await veriPending.messages.fetch({ limit: 100 })
        messages.filter(m => m.reactions.cache.has('🔑')).each(m => {
            this.watchMessage(m, bot, db)
        })
    },
    async watchMessage(message, bot, db) {
        //variables
        let embed = message.embeds[0]
        watching.push(embed.footer.text)
        let settings = bot.settings[message.guild.id]
        let member = message.guild.members.cache.get(embed.footer.text)
        if (!member) {
            message.guild.channels.cache.get(settings.channels.verificationlog).send(`<@!${embed.footer.text}> Left server while under manual review`)
            return message.delete()
        }
        let desc = embed.author.name.split(/ +/)
        let ign = desc[desc.length - 1]
        //start key reaction collector
        if (!message.reactions.cache.has('🔑')) message.react('🔑')
        let reactionCollector = new Discord.ReactionCollector(message, (r, u) => !u.bot && r.emoji.name == '🔑')
        reactionCollector.on('collect', (r, u) => {
            //check to make sure member is still in the server
            if (!member) {
                message.guild.channels.cache.get(settings.channels.verificationlog).send(`<@!${embed.footer.text}> Left server while under manual review`)
                reactionCollector.stop()
                return message.delete()
            }
            //remove reactions and get reactor
            let reactor = message.guild.members.cache.get(u.id)
            //stop old reaction collector, start new reaction collector
            reactionCollector.stop()
            let checkXCollector = new Discord.ReactionCollector(message, (r, u) => u.id == reactor.id && (r.emoji.name === '✅' || r.emoji.name === '❌' || r.emoji.name === '🔒'))
            //Remove reacts and add check and x
            message.reactions.removeAll()
                .then(message.react('✅'))
                .then(message.react('❌'))
                .then(message.react('🔒'))

            checkXCollector.on('collect', async (r, u) => {
                //stop collector
                checkXCollector.stop()
                await message.reactions.removeAll()
                //lock
                if (r.emoji.name === '🔒') return module.exports.watchMessage(message, bot, db)
                //check
                else if (r.emoji.name === '✅') {
                    //add 100 emote
                    message.react('💯')
                    //set embed color to green
                    embed.setColor('#00ff00')
                    embed.setFooter(`Accepted by "${reactor.nickname}"`)
                    embed.setTimestamp()
                    message.edit(embed)
                    //log in veri-log
                    let veriEmbed = new Discord.MessageEmbed()
                        .setColor('#00ff00')
                        .setDescription(`${member} was manually verified by ${reactor}`)
                    message.guild.channels.cache.get(settings.channels.verificationlog).send(veriEmbed)
                    //set nickname
                    let tag = member.user.tag.substring(0, member.user.tag.length - 5)
                    let nick = ''
                    if (tag == ign) {
                        nick = ign.toLowerCase()
                        if (tag == nick) {
                            nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
                        }
                    } else nick = ign
                    await member.setNickname(nick)
                    //give verified raider role
                    setTimeout(() => { member.roles.add(settings.roles.raider) }, 1000)
                    //dm user
                    member.user.send(`You have been successfully verified in \`${message.guild.name}\`. Welcome! AFK-Checks work a little big different here, so make sure to read through the FAQ to learn more`)
                    //remove from watching embed
                    watching.splice(watching.indexOf(u.id), 1)
                    //remove them from expelled list
                    db.query(`DELETE FROM veriblacklist WHERE id = '${member.id}' OR id = '${ign}'`)
                }
                //x
                else if (r.emoji.name === '❌') {
                    //create next reaction collector
                    let reasonCollector = new Discord.ReactionCollector(message, (r, u) => u.id == reactor.id && (r.emoji.name === '1️⃣' || r.emoji.name === '2️⃣' || r.emoji.name === '3️⃣' || r.emoji.name === '4️⃣' || r.emoji.name === '🔒'))
                    //add reacts
                    message.react('1️⃣')
                        .then(message.react('2️⃣'))
                        .then(message.react('3️⃣'))
                        .then(message.react('4️⃣'))
                        .then(message.react('🔒'))

                    reasonCollector.on('collect', async (r, u) => {
                        message.reactions.removeAll()
                        reasonCollector.stop()
                        //lock
                        if (r.emoji.name === '🔒') return module.exports.watchMessage(message, bot, db)
                        //1
                        else if (r.emoji.name === '1️⃣') {
                            //add to expelled
                            db.query(`INSERT INTO veriblacklist (id, modid) VALUES ('${member.id}', '${reactor.id}'),('${ign.toLowerCase()}', '${reactor.id}')`)
                            //dm user, tell to appeal to reactor
                            member.user.send(`You were denied from verifying in \`${message.guild.name}\`. Please contact ${reactor} \`${reactor.user.tag}\` to appeal`)
                            //set embed color to red, add wave emote
                            denyMessage('1️⃣')
                        }
                        //2
                        else if (r.emoji.name === '2️⃣') {
                            //set nickname
                            let tag = member.user.tag.substring(0, member.user.tag.length - 5)
                            let nick = ''
                            if (tag == ign) {
                                nick = ign.toLowerCase()
                                if (tag == nick) {
                                    nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
                                }
                            } else nick = ign
                            await member.setNickname(nick)
                            //give user event raider role
                            setTimeout(() => { member.roles.add(settings.roles.eventraider) }, 1000)
                            //dm user and explain event boi
                            member.user.send(`Your application to the server ${message.guild.name} has been denied. Because your account has been flagged, we ask that you continue to play on your account for an additional two weeks before contacting ${reactor} \`${reactor.user.tag} | ${reactor.nickname}\` to appeal. For now, you have been given access to the events section to participate in non-Lost Halls dungeons.`)
                            //set embed color to red, add wave emote
                            denyMessage('2️⃣')
                        }
                        //3
                        else if (r.emoji.name === '3️⃣') {
                            //dm user to unprivate their realmeye
                            member.user.send(`You were denied from verifying in \`${message.guild.name}\`. Please unprivate everything on your realmeye (except for last known location) and try again`)
                            //update embed
                            denyMessage('3️⃣')
                        }
                        //4
                        else if (r.emoji.name === '4️⃣') {
                            //expell user
                            db.query(`INSERT INTO veriblacklist (id, modid) VALUES ('${member.id}', '${reactor.id}')`)
                            //dm user that they were denied
                            member.user.send(`You were denied from verifying in \`${message.guild.name}\``)
                            //update embed
                            denyMessage('4️⃣')
                        }
                        function denyMessage(e) {
                            //set embed color to red, add wave emote
                            embed.setColor(`#ff0000`)
                            embed.setFooter(`Denied using ${e} by ${reactor.nickname}`)
                            message.edit(embed)
                            message.react('👋')
                            //send to verilog
                            let denyEmbed = new Discord.MessageEmbed()
                                .setColor(`#ff0000`)
                                .setDescription(`${member} was denied by ${reactor} using ${e}`)
                                .setTimestamp()
                            message.guild.channels.cache.get(settings.channels.verificationlog).send(denyEmbed)
                            //remove from watching embed
                            watching.splice(watching.indexOf(u.id), 1)
                        }
                    })
                }
            })
        })
    },
    async reVerify(u, guild, bot, db) {
        return new Promise(async (res, rej) => {
            //check to see if they are in other servers   
            let emojiServers = require('../emojiServers.json')
            let nicks = []
            let suspended = false
            await bot.guilds.cache.each(async g => {
                if (emojiServers.includes(g.id)) return
                let member = await g.members.cache.get(u.id)
                if (member && member.nickname) {
                    let suspendedRole = member.roles.cache.filter(r => r.name.toLowerCase().includes('suspend'))
                    if (suspendedRole) return suspended = true
                    let nick = member.nickname.replace(/[^a-z|]/gi, '').split('|')
                    for (let i of nick) nicks.push(i)
                }
            })
            if (suspended) return res(false)
            if (nicks.length <= 0) return res(false)
            let uniqueNames = [... new Set(nicks)]

            //ask which nick is their main
            let embed = new Discord.MessageEmbed()
                .setColor('#015c21')
                .setTitle('Reverification')
                .setDescription('You have verified with ViBot before. Would you like to reverify under one of the following names?')
                .setFooter('React with one of the following numbers, or :x:')
            let i = 0
            uniqueNames.forEach(nick => {
                if (i >= 9) return
                embed.addField(numberToEmoji(i), nick, true)
                i++;
            })
            let m = await u.send(embed)
            let reactionCollector = new Discord.ReactionCollector(m, (r, u) => !u.bot)
            reactionCollector.on('collect', async (r, u) => {
                switch (r.emoji.name) {
                    case '1️⃣': res(uniqueNames[0]); m.delete(); reactionCollector.stop(); break;
                    case '2️⃣': res(uniqueNames[1]); m.delete(); reactionCollector.stop(); break;
                    case '3️⃣': res(uniqueNames[2]); m.delete(); reactionCollector.stop(); break;
                    case '4️⃣': res(uniqueNames[3]); m.delete(); reactionCollector.stop(); break;
                    case '5️⃣': res(uniqueNames[4]); m.delete(); reactionCollector.stop(); break;
                    case '6️⃣': res(uniqueNames[5]); m.delete(); reactionCollector.stop(); break;
                    case '7️⃣': res(uniqueNames[6]); m.delete(); reactionCollector.stop(); break;
                    case '8️⃣': res(uniqueNames[7]); m.delete(); reactionCollector.stop(); break;
                    case '9️⃣': res(uniqueNames[8]); m.delete(); reactionCollector.stop(); break;
                    case '🔟': res(uniqueNames[9]); m.delete(); reactionCollector.stop(); break;
                    case '❌': res(false); m.delete(); reactionCollector.stop(); break;
                    default:
                        let retryMessage = await message.channel.send('There was an issue with the reaction. Please try again');
                        setTimeout(() => { retryMessage.delete() }, 5000)
                }
            })
            for (let j = 0; j < i; j++) {
                m.react(numberToEmoji(j))
            }
            await m.react('❌')
        })
    },
    checkActive(id) {
        if (active.includes(id)) return true
        else return false
    }
}

function numberToEmoji(i) {
    switch (i) {
        case 0: return ('1️⃣');
        case 1: return ('2️⃣');
        case 2: return ('3️⃣');
        case 3: return ('4️⃣');
        case 4: return ('5️⃣');
        case 5: return ('6️⃣');
        case 6: return ('7️⃣');
        case 7: return ('8️⃣');
        case 8: return ('9️⃣');
        case 9: return ('🔟');
    }
}


async function checkBlackList(id, db) {
    return new Promise(async (resolve, reject) => {
        db.query(`SELECT * FROM veriblacklist WHERE id = '${id.toLowerCase()}'`, async (err, rows) => {
            if (err) reject(err)
            if (rows.length != 0) resolve(true)
            else resolve(false)
        })
    })
}

const CheckFilter = (r, u) => r.emoji.name === '✅' && !u.bot
const XFilter = (r, u) => r.emoji.name === '❌' && !u.bot
const CheckXFilter = (r, u) => (r.emoji.name === '✅' || r.emoji.name === '❌') && !u.bot