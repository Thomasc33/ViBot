const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const botSettings = require('../settings.json')
const realmEyeScrape = require('../lib/realmEyeScrape')
const VerificationCurrentWeek = require('../data/currentweekInfo.json').verificationcurrentweek
const quota = require('./quota')
const quotas = require('../data/quotas.json')
// const VerificationML = require('../ml/verification')
// const TestAlt = require('./testAlt')

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
        let verificationEmbed = new Discord.EmbedBuilder()
            .setColor('#015c21')
            .setTitle('Verification Steps')
            .setDescription(`**1.** Unprivate your discord PM's to ensure bot can reach you
            
            **2** Log in to your realmeye page and unprivate everything except for \`last known location\`. If you do not have a password for realmeye, ingame type \`/tell MrEyeball password\` to get one

            **3.** React with the :white_check_mark: below

            **4.** Wait for the bot to PM you with further instructions.`)
        verificationMessage = await verificationChannel.send({ embeds: [verificationEmbed] })
        verificationMessage.react('✅')
    },
    async init(guild, bot, db) {
        let settings = bot.settings[guild.id]
        if (!embedMessage) {
            let veriChannel = guild.channels.cache.get(settings.channels.verification)
            if (!veriChannel) return;
            let messages = await veriChannel.messages.fetch({ limit: 1 })
            embedMessage = messages.first()
        }
        let reactionCollector = new Discord.ReactionCollector(embedMessage, { filter: (r, u) => !u.bot && r.emoji.name == '✅' })
        reactionCollector.on('collect', (r, u) => {
            this.verify(u, guild, bot, db)
        })
        this.manualVerifyUpdate(guild, bot, db)
    },
    async verify(u, guild, bot, db) {
        //initial variables
        let settings = bot.settings[guild.id]
        let member = guild.members.cache.get(u.id);
        if (!member)
            member = await guild.members.fetch({ user: u.id, force: true });

        let veriactive = guild.channels.cache.get(settings.channels.veriactive)
        let veripending = guild.channels.cache.get(settings.channels.manualverification)
        let verilog = guild.channels.cache.get(settings.channels.verificationlog)
        let veriattempts = guild.channels.cache.get(settings.channels.veriattempts)
        if (!veriactive || !veripending || !verilog || !veriattempts) return ErrorLogger.log(new Error(`ID For a verificiation channel is missing`), bot)

        //check to see if they are currently under review and veri-blacklist
        if (active.includes(u.id)) return
        if (watching.includes(u.id)) return u.send(`You are currently under manual verification. If you do not hear back within 48 hours, please DM me again to contact modmail`).catch(er => { })
        let blInfo = await checkBlackList(u.id, db);
        if (blInfo) {
            const blGuild = bot.guilds.cache.get(blInfo.guildid);
            if (!blGuild || !bot.settings[blGuild.id])
                return u.send(`You are currently blacklisted from verifying. Please DM me to contact mod-mail and find out why`);

            const staff = blGuild.members.cache.get(blInfo.modid);
            if (!staff || staff.id == bot.user.id || staff.roles.highest.comparePositionTo(bot.settings[blGuild.id].roles.security) < 0) {
                if (guild.id == botSettings.hallsId) return u.send(`You are currently blacklisted from the __${blGuild.name}__ server and cannot verify. The person who blacklisted you is no longer staff. Please DM any online security to appeal.`);
                return u.send(`You are currently blacklisted from the __${blGuild.name}__ server and cannot verify. The person who blacklisted you is no longer staff. Please DM me and send mod-mail to that server to appeal.`);
            }

            return u.send(`You are currently blacklisted from the __${blGuild.name}__ server and cannot verify. Please contact ${staff} in order to appeal. If they do not reply within 48 hours, feel free to mod-mail the ${blGuild.name} server to get assistance.`);
        }
        active.push(u.id)

        //log that they are attempting to verify
        let LoggingEmbed = new Discord.EmbedBuilder()
            .setColor('#00ff00')
            .setAuthor({ name: `${u.tag} is attempting to verify` })
            .setDescription(`<@!${u.id}> has started the verification process`)
            .setFooter({ text: `ID: ${u.id}` })
        if (u.avatarURL()) LoggingEmbed.setAuthor({ name: `${u.tag} is attempting to verify`, iconURL: u.avatarURL() })
        veriattempts.send({ embeds: [LoggingEmbed] })
        let activeMessage = await veriactive.send({ embeds: [LoggingEmbed] })

        //check other servers for verification
        let res = await this.reVerify(u, guild, bot, db) //true = verified, false = not verified

        //dm user
        let embed = new Discord.EmbedBuilder()
            .setColor('#015c21')
            .setTitle(`<${botSettings.emote.hallsPortal}> Your verification status! <${botSettings.emote.hallsPortal}>`)
        if (!res) embed.setDescription(`__**You have not been verified yet! Please follow the instructions below**__\n\n**Please enter your in game name** Enter it actually how it is spelled in game (Ex. \`Vi\`).\nCapitalization doesn't matter\n\n*React with ❌ at anytime to cancel*`)
            .setFooter({ text: `There is a 15 minute timer that updates every 30 seconds...` })
        let dms = await u.createDM()
        let embedMessage = await dms.send({ embeds: [embed] })

        //stop verification if reverifying
        let ign
        if (res) {
            ign = res;

            return autoVerify()
        }

        //abort collector
        let abortCollector = new Discord.ReactionCollector(embedMessage, { filter: (r, u) => !u.bot && r.emoji.name == '❌' })
        let reactionCollectors = [],
            checkingIGN = false
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
        let timer = setInterval(update, 30000)

        function update() {
            if (time <= 0) return cancelVerification(0)
            if (!embed || !LoggingEmbed) return
            time -= 30
            let min = Math.floor(time / 60)
            let seconds = time % 60
            embed.setFooter({ text: `Time remaining: ${min} minutes ${seconds} seconds` })
            embedMessage.edit({ embeds: [embed] })
            LoggingEmbed.setFooter({ text: `Their verification has ${min} minutes and ${seconds} seconds left` })
            activeMessage.edit({ embeds: [LoggingEmbed] }).catch(er => { })
        }

        //cancels verification
        async function cancelVerification(reason, info) {
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
                    const blGuild = bot.guilds.cache.get(info.guildid);
                    LoggingEmbed.addFields([{ name: 'Server', value: blGuild ? blGuild.name : 'Unknown', inline: true }]);
                    LoggingEmbed.addFields([{ name: 'Security', value: `<@!${info.modid}>`, inline: true }]);

                    if (!blGuild)
                        embed.setDescription(`You are currently blacklisted from verifying. Please DM me to contact mod-mail and find out why`);
                    else {
                        const staff = blGuild.members.cache.get(info.modid);
                        const blgsettings = bot.settings[blGuild.id];
                        const currently = blgsettings && staff && staff.roles.highest.comparePositionTo(blgsettings.roles.security) >= 0;
                        if (blGuild.id != guild.id)
                            LoggingEmbed.addFields([{ name: `Staff?`, value: currently ? '✅' : '❌', inline: true }]);
                        else if (!currently)
                            embed.setDescription(`You are currently blacklisted from the __${blGuild.name}__ server and cannot verify. The person who blacklisted you is no longer staff. Please DM me and send mod-mail to that server to appeal.`);
                        else
                            embed.setDescription(`You are currently blacklisted from the __${blGuild.name}__ server and cannot verify. Please contact ${staff} in order to appeal. If they do not reply within 48 hours, feel free to mod-mail the ${blGuild.name} server to get assistance.`);
                    }
                    break;
                case 3:
                    LoggingEmbed.setDescription(`<@!${u.id}> was auto-denied because ${ign} already exists in the server`)
                    embed.setDescription(`There is already a member verified under ${ign}. If this is an error, please DM me to get in contact with mod-mail`);
                    break;
            }
            embed.footer = null
            LoggingEmbed.setColor(`#ff0000`)
            activeMessage.delete()
            veriattempts.send({ embeds: [LoggingEmbed] })
            active.splice(active.indexOf(u.id), 1)
            embedMessage.edit({ embeds: [embed] })
            clearInterval(timer)
        }

        //get users ign
        ign = await getIgn()
        async function getIgn() {
            return new Promise(async (resolve, reject) => {
                let ignCollector = new Discord.MessageCollector(dms, { filter: m => !m.author.bot })
                reactionCollectors.push(ignCollector)
                ignCollector.on("collect", async m => {
                    if (m.content.split(/ +/).length > 1) {
                        embed.setDescription(`Please enter only your IGN.\nTry again`)
                        embedMessage.edit({ embeds: [embed] })
                    } else {
                        let ign = m.content
                        if (ign.replace(/[^a-z]/gi, '') != ign) {
                            embed.setDescription(`Please only enter letters.\nTry again`)
                            embedMessage.edit({ embeds: [embed] })
                        } else {
                            embed.setDescription(`Are you sure you wish to verify as: \`${ign}\`\n`)
                            embedMessage.edit({ embeds: [embed] })
                            embedMessage.react('✅')
                                .then(embedMessage.react('❌'))
                            checkingIGN = true
                            let confirmReactionCollector = new Discord.ReactionCollector(embedMessage, { filter: (r, u) => !u.bot && (r.emoji.name == '✅' || r.emoji.name == '❌') })
                            confirmReactionCollector.on('collect', async (r, u) => {
                                if (r.emoji.name == '✅') {
                                    resolve(ign)
                                    ignCollector.stop()
                                    checkingIGN = false
                                } else {
                                    embed.setDescription(`__**You have not been verified yet! Please follow the instructions below**__\n\n**Please enter your in game name** Enter it actually how it is spelled in game (Ex. \`Vi\`).\n`)
                                    embedMessage.edit({ embeds: [embed] })
                                }
                                confirmReactionCollector.stop()
                            })
                        }
                    }
                })
            })
        }
        blInfo = await checkBlackList(ign, db);
        //check blacklist for ign
        if (blInfo) return cancelVerification(2, blInfo)

        //verify name isnt in server yet
        let dupes = guild.members.cache.filter(user => user.nickname).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(ign.toLowerCase()));
        if (dupes) {
            return cancelVerification(3)
        } else {
            LoggingEmbed.setDescription(`<@!${u.id}> is attempting to verify under [${ign}](https://www.realmeye.com/player/${ign})`)
            veriattempts.send({ embeds: [LoggingEmbed] })
            activeMessage.edit({ embeds: [LoggingEmbed] }).catch(er => { })
        }

        //generate and give vericode
        let vericode = `VIBOT-${Math.floor(Math.random() * 10000)}`
        embed.setDescription(`You have chosen to verify under: \`${ign}\`\n\nPlease add the following code into your realmeye description:\n\`\`\`${vericode}\`\`\`\nRe-react to the ✅ when it is done`)
        embedMessage.edit({ embeds: [embed] })
        let veriCodeReactionCollector = new Discord.ReactionCollector(embedMessage, { filter: (r, u) => !u.bot && r.emoji.name == '✅' })
        reactionCollectors.push(veriCodeReactionCollector)
        veriCodeReactionCollector.on('collect', async (r, u) => {
            //check realmeye description for vericode
            let userInfo = await realmEyeScrape.getGraveyardSummary(ign).catch(er => {
                //ErrorLogger.log(er, bot)
                if (er == 'Unloaded Graveyard') {
                    embed.setDescription(`Your graveyard is not loaded on realmeye or it is privated. If you are sure it is set to public then go to your graveyard and click on the button that says:\n\`Click here if you think that some of your deceased heros are still missing!\`\nOnce you are done, re-react with the ✅`)
                    embedMessage.edit({ embeds: [embed] })
                    LoggingEmbed.setDescription(`<@!${u.id}> Needs to load in their graveyard on their realmeye page *clicking the button*`)
                    LoggingEmbed.setColor('#ff0000')
                    activeMessage.edit({ embeds: [LoggingEmbed] }).catch(er => { })
                    veriattempts.send({ embeds: [LoggingEmbed] })
                    return;
                } else {
                    embed.setDescription(`There was an error checking your realmeye page. Please make sure everything except last known location is public, then re-react with the ✅`)
                    embedMessage.edit({ embeds: [embed] })
                    LoggingEmbed.setDescription(`<@!${u.id}> Needs to unprivate parts of their realmeye to verify`)
                    LoggingEmbed.setColor('#ff0000')
                    activeMessage.edit({ embeds: [LoggingEmbed] })
                    veriattempts.send({ embeds: [LoggingEmbed] })
                    return;
                }

            })
            if (!userInfo) return
            LoggingEmbed.setColor('#00ff00')
            let found = true; //change back
            for (let i in userInfo.desc) {
                if (userInfo.desc[i].includes(vericode)) found = true
            }
            if (!found) {
                embed.setDescription(`The veri-code was not found in your realmeye page. It may take a few seconds to update on realmeye. Please re-react to the ✅ in about 30 seconds`)
                embedMessage.edit({ embeds: [embed] })
                LoggingEmbed.setDescription(`<@!${u.id}> tried to verify, but their veri-code was not in their realmeye description`)
                LoggingEmbed.setColor('#ffff00')
                activeMessage.edit({ embeds: [LoggingEmbed] })
                veriattempts.send({ embeds: [LoggingEmbed] })
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
            clearInterval(timer)
            embed.setDescription(`Your account is now under manual review, please do not attempt to verify again. If your account has not been reviewed within the next 48 hours, please contact the staff __**through modmail**__ **by sending me a message.** Please **DO NOT** contact a staff member directly about being verified unless you are told to do so.`)
                .setColor('#ff0000')
                .footer = null
            embedMessage.edit({ embeds: [embed] })
            activeMessage.delete()
            active.splice(active.indexOf(u.id), 1)
            LoggingEmbed.setDescription(`<@!${u.id}> Attempted to verify, however, they had issues with their profile and are now under manual review`)
            veriattempts.send({ embeds: [LoggingEmbed] })

            // let altDetectionScore = await TestAlt.testFromIGN(ign)
            let manualEmbed = new Discord.EmbedBuilder()
                .setAuthor({ name: `${u.tag} is attempting to verify as: ${ign}`, iconURL: u.avatarURL() })
                .setDescription(`<@!${u.id}> : [Realmeye Link](https://www.realmeye.com/player/${ign})`)
                .addFields(
                    { name: 'Rank', value: `${data.rank || 'Unknown'}`, inline: true },
                    { name: 'Guild', value: `${data.guild || 'Unknown'}`, inline: true },
                    { name: 'Guild Rank', value: `${data.guild_rank || 'Unknown'}`, inline: true },
                    { name: 'Alive Fame', value: `${data.fame || 'Unknown'}`, inline: true },
                    { name: 'Death Fame', value: `${data.account_fame || 'Unknown'}`, inline: true },
                    { name: 'Deaths', value: `${data.deaths[data.deaths.length - 1] || 'Unknown'}`, inline: true },
                    { name: 'Account Created', value: `${data.created || 'Unknown'}`, inline: true },
                    { name: 'Last seen', value: `${data.player_last_seen || 'Unknown'}`, inline: true },
                    { name: 'Character Count', value: `${data.chars || 'Unknown'}`, inline: true },
                    { name: 'Skins', value: `${data.skins || 'Unknown'}`, inline: true },
                    // { name: 'Alt %', value: altDetectionScore ? `${altDetectionScore.toFixed(20)}%` : 'Error Gathering Data', inline: true },
                    { name: 'Discord account created', value: u.createdAt.toString() || 'Unknown', inline: false }
                )
                .setFooter({ text: `${u.id}` })
            let reason = ''
            reasons.forEach(r => {
                reason += `-${r.reason}`
                if (r.stat) reason += ` ${r.stat}`
                reason += '\n'
            })
            reason = reason.trim()
            if (reason && reason != '') manualEmbed.addFields([{ name: 'Problems', value: reason }])
            let m = await veripending.send({ embeds: [manualEmbed] })
            await m.react('🔑')
            module.exports.watchMessage(m, bot, db)
        }

        //autoverify
        async function autoVerify() {
            if (!member) member = guild.members.cache.get(u.id)
            let tag = member.user.username
            let nick = ''
            if (tag == ign) {
                nick = ign.toLowerCase()
                if (tag == nick) {
                    nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
                }
            } else nick = ign
            await member.setNickname(nick)
            setTimeout(async () => {
                await member.roles.add(settings.roles.raider)
                if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) await member.roles.remove(settings.roles.unverified)
                if (settings.backend.giveeventroleonverification) member.roles.add(settings.roles.eventraider)
            }, 1000)
            db.query(`INSERT INTO users (id) VALUES ('${u.id}')`, err => {
                if (err) return
            })
            embed.setDescription('Welcome to the server. You have been verified. Please head over to rules, faq, and raiding-rules channels to familiarize yourself with the server. Happy raiding')
            embedMessage.edit({ embeds: [embed] })
            LoggingEmbed.setDescription(`<@!${u.id}> has successfully verified under [${ign}](https://www.realmeye.com/player/${ign})`)
            verilog.send({ embeds: [LoggingEmbed] })
            veriattempts.send({ embeds: [LoggingEmbed] })
            activeMessage.delete()
            active.splice(active.indexOf(u.id), 1)

            //data collection
            // TestAlt.trainFromIGN(ign, 0)
        }
    },
    async manualVerifyUpdate(guild, bot, db) {
        let settings = bot.settings[guild.id]
        let veriPending = guild.channels.cache.get(settings.channels.manualverification)
        let messages = await veriPending.messages.fetch({ limit: 100 })
        messages.filter(m => m.reactions.cache.has('🔑') && m.author.id == bot.user.id).each(m => {
            this.watchMessage(m, bot, db)
        })
    },
    async watchMessage(message, bot, db) {
        const member_id = message.embeds[0].footer.text.split(' ').pop()
        let member = await message.guild.members.fetch(member_id).catch(e => ErrorLogger.log(e, bot));
        //variables

        let settings = bot.settings[message.guild.id]
        if (!member) {
            message.guild.channels.cache.get(settings.channels.verificationlog).send(`<@!${member_id}> Left server while under manual review`)
            return message.delete()
        }
        let embed = new Discord.EmbedBuilder()
        embed.data = message.embeds[0].data
        watching.push(member.id)
        let desc = embed.data.author.name.split(/ +/)
        let ign = desc[desc.length - 1]
        //start key reaction collector
        if (!message.reactions.cache.has('🔑')) message.react('🔑')
        let reactionCollector = new Discord.ReactionCollector(message, { filter: (r, u) => !u.bot && r.emoji.name == '🔑' })
        reactionCollector.on('collect', async (r, u) => {
            //check to make sure member is still in the server
            if (!member) {
                message.guild.channels.cache.get(settings.channels.verificationlog).send(`<@!${member_id}> Left server while under manual review`)
                reactionCollector.stop()
                return message.delete()
            }
            let reactor = message.guild.members.cache.get(u.id)
            message.embeds[0].data.footer.text = `Opened by ${reactor.displayName || u.tag} - ${member_id}`
            message.edit({ embeds: message.embeds })
            //stop old reaction collector, start new reaction collector
            reactionCollector.stop()
            let checkXCollector = new Discord.ReactionCollector(message, { filter: (r, u) => u.id == reactor.id && (r.emoji.name === '✅' || r.emoji.name === '❌' || r.emoji.name === '🔒') })
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
                if (r.emoji.name === '🔒') {
                    message.embeds[0].data.footer.text = `${member_id}`
                    message.edit({ embeds: message.embeds })
                    return module.exports.watchMessage(message, bot, db)
                }
                //check
                else if (r.emoji.name === '✅') {
                    //add 100 emote
                    message.react('💯')
                    //set embed color to green
                    embed.setColor('#00ff00')
                    embed.setFooter({ text: `Accepted by ${reactor.displayName}` })
                    embed.setTimestamp()
                    message.edit({ embeds: [embed] })
                    //log in veri-log
                    let veriEmbed = new Discord.EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription(`${member} was manually verified by ${reactor}`)
                    message.guild.channels.cache.get(settings.channels.verificationlog).send({ embeds: [veriEmbed] })
                    //set nickname
                    let tag = member.user.username
                    let nick = ''
                    if (tag == ign) {
                        nick = ign.toLowerCase()
                        if (tag == nick) {
                            nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
                        }
                    } else nick = ign
                    await member.setNickname(nick)
                    //give verified raider role
                    setTimeout(async () => {
                        await member.roles.add(settings.roles.raider)
                        if (settings.backend.giveeventroleonverification) member.roles.add(settings.roles.eventraider)
                        if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) await member.roles.remove(settings.roles.unverified)
                    }, 1000)
                    //dm user
                    member.user.send(`You have been successfully verified in \`${message.guild.name}\`. Welcome! AFK-Checks work a little big different here, so make sure to read through the FAQ to learn more.${settings.backend.roleassignment ? ` To get pinged for specific afk checks, head over to <#${settings.channels.roleassignment}>` : null}`)
                    //remove from watching embed
                    watching.splice(watching.indexOf(u.id), 1)
                    //remove them from expelled list
                    db.query(`DELETE FROM veriblacklist WHERE id = '${member.id}' OR id = '${ign}'`)

                    this.manualVerifyLog(message, u.id, bot, db)

                    //train machine leaning model
                    // TestAlt.trainFromIGN(ign, 0)
                }
                //x
                else if (r.emoji.name === '❌') {
                    //create next reaction collector
                    let reasonCollector = new Discord.ReactionCollector(message, { filter: (r, u) => u.id == reactor.id && (r.emoji.name === '1️⃣' || r.emoji.name === '2️⃣' || r.emoji.name === '3️⃣' || r.emoji.name === '4️⃣' || r.emoji.name === '🔒') })
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
                        if (r.emoji.name === '🔒') {
                            message.embeds[0].data.footer.text = `${member_id}`
                            message.edit({ embeds: message.embeds })
                            return module.exports.watchMessage(message, bot, db)
                        }
                        //1
                        else if (r.emoji.name === '1️⃣') {
                            //add to expelled
                            db.query(`INSERT INTO veriblacklist (id, modid, guildid, reason) VALUES ('${member.id}', '${reactor.id}', '${message.guild.id}', 'Reacted with 1️⃣ to verification.'),('${ign.toLowerCase()}', '${reactor.id}', '${message.guild.id}', 'Reacted with 1️⃣ to verification.')`)
                            //dm user, tell to appeal to reactor
                            member.user.send(`You were denied from verifying in \`${message.guild.name}\`. Please contact ${reactor} \`${reactor.user.tag}\` to appeal`)
                            //set embed color to red, add wave emote
                            denyMessage('1️⃣')
                        }
                        //2
                        else if (r.emoji.name === '2️⃣') {
                            //add to expelled
                            db.query(`INSERT INTO veriblacklist (id, modid, guildid, reason) VALUES ('${member.id}', '${reactor.id}', '${message.guild.id}', 'Reacted with 2️⃣ to verification.'),('${ign.toLowerCase()}', '${reactor.id}', '${message.guild.id}', 'Reacted with 2️⃣ to verification.')`)

                            //set nickname
                            let tag = member.user.username
                            let nick = ''
                            if (tag == ign) {
                                nick = ign.toLowerCase()
                                if (tag == nick) {
                                    nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
                                }
                            } else nick = ign

                            let er_msg = '';
                            const role = member.guild.roles.cache.get(settings.roles.eventraider);
                            if (role && settings.backend.giveEventRoleOnDenial2) {
                                await member.setNickname(nick)
                                //give user event raider role
                                setTimeout(async () => {
                                    await member.roles.add(settings.roles.eventraider)
                                    if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) await member.roles.remove(settings.roles.unverified)
                                }, 1000)
                                er_msg = 'For now, you have been given access to the events section to participate in non-Lost Halls dungeons.';
                            } else {
                                db.query(`INSERT INTO veriblacklist (id, modid, guildid, reason) VALUES ('${member.id}', '${reactor.id}', '${message.guild.id}', 'Reacted with 2️⃣ to verification.'),('${ign.toLowerCase()}', '${reactor.id}', '${message.guild.id}', 'Reacted with 2️⃣ to verification.')`)
                            }
                            //dm user and explain event boi
                            member.user.send(`Your application to the server ${message.guild.name} has been denied. Because your account has been flagged, we ask that you continue to play on your account for an additional two weeks before contacting ${reactor} \`${reactor.user.tag} | ${reactor.displayName}\` to appeal. ${er_msg}`)
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
                            db.query(`INSERT INTO veriblacklist (id, modid) VALUES ('${member.id}', '${reactor.id}', '${message.guild.id}', 'Reacted with 4️⃣ to verification.')`)
                            //dm user that they were denied
                            member.user.send(`You were denied from verifying in \`${message.guild.name}\``)
                            //update embed
                            denyMessage('4️⃣')
                        }
                        function denyMessage(e) {
                            //set embed color to red, add wave emote
                            embed.setColor(`#ff0000`)
                            embed.setFooter({ text: `Denied using ${e} by ${reactor.displayName}` })
                            message.edit({ embeds: [embed] })
                            message.react('👋')
                            //send to verilog
                            let denyEmbed = new Discord.EmbedBuilder()
                                .setColor(`#ff0000`)
                                .setDescription(`${member} \`${member.displayName }\` was denied by ${reactor} \`${reactor.displayName }\` using ${e}`)
                                .setTimestamp()
                            message.guild.channels.cache.get(settings.channels.verificationlog).send({ embeds: [denyEmbed] })
                            //remove from watching embed
                            watching.splice(watching.indexOf(u.id), 1)
                            //log verification for quota on denied
                            this.manualVerifyLog(message, u.id, bot, db)

                            //train from ign
                            // TestAlt.trainFromIGN(ign, 1)
                        }
                    })
                }
            })
        })
    },
    async reVerify(u, guild, bot, db) {
        return new Promise(async (res, rej) => {
            //check to see if they are in other servers   
            let nicks = []
            await bot.guilds.cache.each(async g => {
                if (bot.emojiServers.includes(g.id)) return
                if (bot.devServers.includes(g.id)) return
                let member = await g.members.cache.get(u.id)
                let settings = bot.settings[g.id]
                if (!settings) return
                if (member && member.nickname && member.roles.cache.has(settings.roles.raider)) {
                    let nick = member.nickname.replace(/[^a-z|]/gi, '').split('|')
                    for (let i of nick) {
                        if (guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(i.toLowerCase()))) continue;
                        nicks.push(i)
                    }
                }
            })
            if (nicks.length <= 0) return res(false)
            let uniqueNames = [... new Set(nicks)]

            //ask which nick is their main
            let embed = new Discord.EmbedBuilder()
                .setColor('#015c21')
                .setTitle('Reverification')
                .setDescription('You have verified with ViBot before. Would you like to reverify under one of the following names?')
                .setFooter({ text: 'React with one of the following numbers, or :x:' })
            let i = 0
            uniqueNames.forEach(nick => {
                if (i >= 9) return
                embed.addFields([{ name: numberToEmoji(i), value: nick, inline: true }])
                i++;
            })
            let m = await u.send({ embeds: [embed] })
            let reactionCollector = new Discord.ReactionCollector(m, { filter: (r, u) => !u.bot })
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
    async manualVerifyLog(message, authorid, bot, db) {
        let settings = bot.settings[message.guild.id]
        let currentweekverificationname, verificationtotalname
        for (let i in VerificationCurrentWeek) {
            i = VerificationCurrentWeek[i]
            if (message.guild.id == i.id && !i.disabled) {
                currentweekverificationname = i.verificationcurrentweek
                verificationtotalname = i.verificationtotal
            }
        }
        if (!currentweekverificationname || !verificationtotalname) return
        db.query(`UPDATE users SET ${verificationtotalname} = ${verificationtotalname} + 1, ${currentweekverificationname} = ${currentweekverificationname} + 1 WHERE id = '${authorid}'`)
        const guildQuota = quotas[message.guild.id]
        if (!guildQuota) return
        const parseQuota = guildQuota.quotas.filter(q => q.id == "security")[0]
        if (parseQuota) quota.update(message.guild, db, bot, settings, guildQuota, parseQuota)
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
            if (rows.length != 0) resolve(rows[0])
            else resolve(false)
        })
    })
}

const CheckFilter = (r, u) => r.emoji.name === '✅' && !u.bot
const XFilter = (r, u) => r.emoji.name === '❌' && !u.bot
const CheckXFilter = (r, u) => (r.emoji.name === '✅' || r.emoji.name === '❌') && !u.bot