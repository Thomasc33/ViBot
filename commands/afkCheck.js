const Discord = require('discord.js')
const botSettings = require('../settings.json')
const Channels = require('./vibotChannels')
const fs = require('fs')
const ErrorLogger = require('../lib/logError')
const realmEyeScrape = require('../realmEyeScrape');
const points = require('./points');
const keyRoles = require('./keyRoles');
const restart = require('./restart')
const EventEmitter = require('events').EventEmitter
const Events = require('../events.json')
var emitter = new EventEmitter()

var runs = [] //{channel: id, afk: afk instance}

module.exports = {
    name: 'afk',
    description: 'The new version of the afk check',
    requiredArgs: 1,
    args: '<c/v/f/x> <location>',
    role: 'almostrl',
    emitter: emitter,
    /**
     * Main Execution Function
     * @param {Discord.Message} message 
     * @param {String[]} args 
     * @param {Discord.Client} bot 
     * @param {import('mysql').Connection} db 
     * @param {import('mysql').Connection} tokenDB 
     */
    async execute(message, args, bot, db, tokenDB, event) {
        //clear out runs array
        destroyInactiveRuns();

        //Check Run Type
        let afkTemplates = require('../afkTemplates.json')
        let runType = null;
        switch (args[0].charAt(0).toLowerCase()) {
            case 'c':
                runType = afkTemplates.cult;
                break;
            case 'v':
                runType = afkTemplates.void;
                break;
            case 'f':
                runType = afkTemplates.fullSkipVoid;
                break;
            case 'x':
                runType = afkTemplates.splitCult;
                break;
            default:
                if (message.member.roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles.vetrl).position) return message.channel.send('Run Type Not Recognized')
                else runType = await getTemplate(message, afkTemplates, args[0]).catch(er => message.channel.send(`Unable to get template. Error: \`${er}\``))
                break;
        }
        if (!runType) return

        //create afkInfo from templates

        let runInfo = { ...runType }

        //isVet
        let isVet = false
        if (message.channel.parent.name.toLowerCase().includes('veteran')) isVet = true;
        runInfo.isVet = isVet;

        //set Raid Leader
        runInfo.raidLeader = message.author.id;

        //get/set location
        let location = ''
        for (i = 1; i < args.length; i++) location = location.concat(args[i]) + ' ';
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (location == '') location = 'None'
        runInfo.location = location.trim();

        //set guildid
        runInfo.guild = message.guild.id;

        //get/set channel
        let channel = null;
        if (runInfo.newChannel) channel = await createChannel(runInfo, message, bot)
        else channel = message.member.voice.channel;
        if (!channel) return message.channel.send(`Unable to create/find the channel you are in`)
        else runInfo.channel = channel.id;

        //begin afk check
        let afkModule = new afkCheck(runInfo, bot, db, message.guild, channel, message, tokenDB)
        runs.push({ channel: channel.id, afk: afkModule })
        if (runInfo.startDelay > 0) setTimeout(begin, runInfo.startDelay, afkModule)
    },
    async eventAfkExecute(message, args, bot, db, tokenDB, event, isVet) {
        //clear out runs array
        destroyInactiveRuns();

        //copy event template
        let runInfo = { ...event }

        //isVet
        runInfo.isVet = isVet;

        //set Raid Leader
        runInfo.raidLeader = message.author.id;

        //get/set location
        let location = ''
        for (i = 1; i < args.length; i++) location = location.concat(args[i]) + ' ';
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (location == '') location = 'None'
        runInfo.location = location.trim();

        //set guildid
        runInfo.guild = message.guild.id;

        //get/set channel
        let channel = null;
        if (runInfo.newChannel) channel = await createChannel(runInfo, message, bot)
        else channel = message.member.voice.channel;
        if (!channel) return message.channel.send(`Unable to create/find the channel you are in`)
        else runInfo.channel = channel.id;

        //begin afk check
        let afkModule = new afkCheck(runInfo, bot, db, message.guild, channel, message, tokenDB)
        runs.push({ channel: channel.id, afk: afkModule })
        if (runInfo.startDelay > 0) setTimeout(begin, runInfo.startDelay, afkModule)
    },
    changeLocation(location, channelID) {
        let found = false
        for (let i of runs) {
            if (i.channel == channelID) {
                i.afk.changeLocation(location)
                found = true
            }
        }
        if (!found) return 'Run not found'
        else return null
    },
    async checkRuns() {
        let activeRuns = []
        for (let i of runs) if (i.afk.active) activeRuns.push(i.channel)
        return activeRuns
    }
}

function begin(afkModule) {
    afkModule.start();
}

class afkCheck {
    /**
     * 
     * @param {Object} afkInfo 
     * @param {String} afkInfo.runType
     * @param {String} afkInfo.runName
     * @param {String} afkInfo.guild
     * @param {String} afkInfo.channelId
     * @param {String} afkInfo.raidLeader
     * @param {String} afkInfo.location
     * @param {String} afkInfo.symbol
     * @param {String} afkInfo.reqsImageUrl 
     * @param {String} afkInfo.keyEmoteID
     * @param {String} afkInfo.vialEmoteID
     * @param {Boolean} afkInfo.isVet
     * @param {Boolean} afkInfo.twoPhase
     * @param {Boolean} afkInfo.isEvent
     * @param {Boolean} afkInfo.isSplit
     * @param {Boolean} afkInfo.newChannel
     * @param {Boolean} afkInfo.vialReact
     * @param {Boolean} afkInfo.postAfkCheck
     * @param {Number} afkInfo.startDelay
     * @param {Number} afkInfo.vcCap
     * @param {Number} afkInfo.timeLimit
     * @param {String[]} afkInfo.earlyLocationReacts
     * @param {String} afkInfo.earlyLocationReacts.class
     * @param {String} afkInfo.earlyLocationReacts.ofEight
     * @param {String[]} afkInfo.reacts
     * @param {Discord.MessageEmbed} afkInfo.embed
     * @param {Discord.Client} bot 
     * @param {import('mysql').Connection} db 
     * @param {Discord.Guild} guild 
     * @param {Discord.VoiceChannel} channel 
     * @param {Discord.Message} message 
     */
    constructor(afkInfo, bot, db, guild, channel, message, tokenDB) {
        this.settings = bot.settings[guild.id]
        this.afkInfo = afkInfo;
        this.bot = bot;
        this.db = db;
        this.guild = guild;
        this.channel = channel;
        this.message = message;
        this.tokenDB = tokenDB
        if (this.afkInfo.isEvent) {
            if (this.afkInfo.isVet) this.raidStatus = this.guild.channels.cache.get(this.settings.channels.vetstatus)
            else this.raidStatus = this.guild.channels.cache.get(this.settings.channels.eventstatus)
            if (this.afkInfo.isVet) this.commandChannel = this.guild.channels.cache.get(this.settings.channels.vetcommands)
            else this.commandChannel = this.guild.channels.cache.get(this.settings.channels.eventcommands)
            if (this.afkInfo.isVet) this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.vetraider)
            else {
                this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.raider)
                this.eventBoi = this.guild.roles.cache.get(this.settings.roles.eventraider)
            }
            this.staffRole = guild.roles.cache.get(this.settings.roles.eventrl)
        } else {
            if (this.afkInfo.isVet) this.raidStatus = this.guild.channels.cache.get(this.settings.channels.vetstatus)
            else this.raidStatus = this.guild.channels.cache.get(this.settings.channels.raidstatus)
            if (this.afkInfo.isVet) this.commandChannel = this.guild.channels.cache.get(this.settings.channels.vetcommands)
            else this.commandChannel = this.guild.channels.cache.get(this.settings.channels.raidcommands)
            if (this.afkInfo.isVet) this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.vetraider)
            else this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.raider)
            this.staffRole = guild.roles.cache.get(this.settings.roles.almostrl)
        }
        this.afkChannel = guild.channels.cache.find(c => c.name === 'afk')
        this.runInfoChannel = guild.channels.cache.get(this.settings.channels.runlogs)
        this.officialRusher = guild.roles.cache.get(this.settings.roles.rusher)
        this.nitroBooster = guild.roles.cache.get(this.settings.roles.nitro)
        this.leaderOnLeave = guild.roles.cache.get(this.settings.roles.lol)
        this.keys = []
        this.nitro = []
        this.vials = []
        this.earlyLocation = []
        this.raiders = [];
        this.endedBy
        this.time = this.afkInfo.timeLimit
        this.postTime = 20;
        this.reactables = {}
        this.active = true;
        for (let i of this.afkInfo.earlyLocationReacts) {
            this.reactables[i.shortName] = { users: [], points: i.pointsGiven }
        }
        this.knights = []
        this.warriors = []
        this.pallies = []
        this.bot.afkChecks[this.channel.id] = {
            timeLeft: this.time,
            isVet: this.isVet,
            //location: this.afkInfo.location, disabled until it is needed
            //keys: [],
            leader: this.message.author.id,
            leaderNick: this.message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0],
            //earlyLocation: earlyLocationIDS,
            //raiders: raiders,
            time: Date.now(),
            runType: this.afkInfo,
            active: true,
            vcSize: this.channel.members.size,
        }
        fs.writeFileSync('./afkChecks.json', JSON.stringify(this.bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.bot) })
        this.sendMessage()
    }

    async sendMessage() {
        let flag = null;
        switch (this.afkInfo.location.substring(0, 2)) {
            case 'us':
                flag = ':flag_us:'
                break;
            case 'eu':
                flag = ':flag_eu:'
                break;
        }
        if (this.afkInfo.startDelay > 0) {
            let embed = new Discord.MessageEmbed()
                .setColor(this.afkInfo.embed.color)
                .setDescription(`A \`${this.afkInfo.runName}\`${flag ? `in (${flag})` : ''} will begin in ${Math.round(this.afkInfo.startDelay / 1000)} seconds. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : `Be prepared to join \`${this.channel.name}\``}`)
            this.raidStatusMessage = await this.raidStatus.send(`@here ${this.afkInfo.runName}${flag ? ` (${flag})` : ''}. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : ''}`, embed)
        } else {
            this.raidStatusMessage = await this.raidStatus.send(`@here \`${this.afkInfo.runName}\`${flag ? ` (${flag})` : ''} is beginning now. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : `Please join ${this.channel.name}`}`)
            this.start()
        }
    }

    async start() {
        //create/send leader embed
        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor(this.afkInfo.embed.color)
            .setTitle(`${this.message.member.nickname}'s ${this.afkInfo.runName}`)
            .addField('Our current keys', 'None!')
            .setFooter(`React with ❌ to abort${this.afkInfo.twoPhase ? ', React with ✅ to open the channel' : ''}`)
        if (this.afkInfo.vialReact) this.leaderEmbed.addField('Our current vials', 'None!')
        this.afkInfo.earlyLocationReacts.forEach(r => this.leaderEmbed.addField(`Our current ${r.shortName}`, 'None!'))
        this.leaderEmbed.addField('Location', this.afkInfo.location)
            .addField('Other Early Location', 'None!')
            .addField('Nitro', 'None!')
        this.leaderEmbedMessage = await this.commandChannel.send(this.leaderEmbed)
        this.runInfoMessage = await this.runInfoChannel.send(this.leaderEmbed)
        this.leaderEmbedMessage.react('❌')
        if (this.afkInfo.twoPhase) this.leaderEmbedMessage.react('✅')
        this.bot.afkChecks[this.channel.id].url = this.message.url

        //add x and x-collector to leader embed
        this.leaderReactionCollector = new Discord.ReactionCollector(this.leaderEmbedMessage, (r, u) => !u.bot)
        this.leaderReactionCollector.on('collect', (r, u) => this.leaderReactionHandler(r, u))

        //send messages
        this.mainEmbed = new Discord.MessageEmbed(this.afkInfo.embed);
        this.mainEmbed.setAuthor(`A ${this.afkInfo.runName} Has Been Started in ${this.channel.name}`)
            .setColor(this.afkInfo.embed.color)
            .setFooter(`Time Remaining: ${Math.floor(this.time / 60)} minutes and ${this.time % 60} seconds`)
            .setTimestamp(Date.now())
        if (this.message.author.avatarURL()) this.mainEmbed.author.iconURL = this.message.author.avatarURL()
        if (this.afkInfo.reqsImageUrl) this.mainEmbed.setImage(this.afkInfo.reqsImageUrl)
        this.raidStatusMessage.edit(this.mainEmbed)

        //unlock channel
        if (!this.afkInfo.twoPhase) {
            this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })
            if (this.eventBoi) this.channel.updateOverwrite(this.eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true })
        }

        //create reaction collector
        this.raidStatusReactionCollector = new Discord.ReactionCollector(this.raidStatusMessage, (r, u) => !u.bot)
        this.raidStatusReactionCollector.on('collect', (r, u) => this.reactionHandler(r, u))

        //add reactions
        this.addReacts()

        //start timers
        this.moveInTimer = await setInterval(() => this.moveIn(), 10000);
        this.timer = await setInterval(() => this.timerInterval(), 5000);
        this.updateVC = await setInterval(() => this.updateVCNumber(), 500);
    }

    /**
     * 
     * @param {Discord.MessageReaction} r 
     * @param {Discord.User} u 
     */
    async reactionHandler(r, u) {
        if (r.emoji.id == this.afkInfo.keyEmoteID) this.confirmSelection(u, r, 0, 'key', this.afkInfo.keyCount)
        else if (this.afkInfo.vialReact && r.emoji.id == this.afkInfo.vialEmoteID) this.confirmSelection(u, r, 1, 'vial', 3)
        else if (r.emoji.id === '701491230349066261') return this.useNitro(u, this.leaderEmbed.fields.length - 1)
        else if (r.emoji.id === '752368122551337061') return this.supporterUse(u, this.leaderEmbed.fields.length - 2)
        else if (r.emoji.name === '🎟️') return this.pointsUse(u, this.leaderEmbed.fields.length - 2)
        else if (r.emoji.name === '❌') {
            if (this.guild.members.cache.get(u.id).roles.highest.position >= this.staffRole.position) {
                this.endedBy = u;
                return this.postAfk(u, this.leaderEmbed.fields.length - 2)
            }
        }
        else for (let i in this.afkInfo.earlyLocationReacts) {
            let react = this.afkInfo.earlyLocationReacts[i]
            if (react.emoteID == r.emoji.id) {
                if (react.requiredRole && !this.guild.members.cache.get(u.id).roles.cache.has(this.settings.roles[react.requiredRole])) return
                this.confirmSelection(u, r, +i + +1, react.shortName, react.limit)
            }
        }
        if (r.emoji.name.toLowerCase() == 'knight') this.knights.push(u)
        else if (r.emoji.name.toLowerCase() == 'warrior') this.warriors.push(u)
        else if (r.emoji.name.toLowerCase() == 'paladin') this.pallies.push(u)
    }

    /**
     * 
     * @param {Discord.MessageReaction} r 
     * @param {Discord.User} u 
     */
    async leaderReactionHandler(r, u) {
        if (r.emoji.name === '❌') {
            this.endedBy = u;
            this.abortAfk()
        } else if (r.emoji.name === '✅') {
            if (this.afkInfo.twoPhase) {
                this.leaderEmbed.footer.text = `React with ❌ to abort, Channel is opening...`
                this.leaderEmbedMessage.edit(this.leaderEmbed)
                let tempM = await this.raidStatus.send(`Channel will open in 5 seconds...`)
                setTimeout(async (afk) => {
                    await tempM.edit(`${afk.channel.name} is open!`)
                    await this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })
                    if (this.eventBoi) await this.channel.updateOverwrite(this.eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true })
                    setTimeout(tempM.delete(), 15000)
                }, 5000, [this])
            }
        }
    }

    async addReacts() {
        await this.raidStatusMessage.react(this.afkInfo.keyEmoteID)
        if (this.afkInfo.vialReact) await this.raidStatusMessage.react(this.afkInfo.vialEmoteID)
        for (let i of this.afkInfo.earlyLocationReacts) await this.raidStatusMessage.react(i.emoteID)
        for (let i of this.afkInfo.reacts) await this.raidStatusMessage.react(i)
        await this.raidStatusMessage.react('701491230349066261')
        if (this.settings.backend.supporter) await this.raidStatusMessage.react('752368122551337061')
        await this.raidStatusMessage.react('🎟️')
        await this.raidStatusMessage.react('❌')
    }

    /**
     * 
     * @param {Discord.User} u 
     * @param {Discord.MessageReaction} r 
     * @param {Number} index 
     * @param {String} type 
     * @param {Number} limit
     */
    async confirmSelection(u, r, index, type, limit) {
        let endAfter = setInterval(() => {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another vial already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                clearInterval(endAfter);
                return;
            }
        }, 60000)
        let emote = r.emoji
        try {
            if (!checkType(this)) return
            let reactInfo
            for (let r of this.afkInfo.earlyLocationReacts) {
                if (type == r.shortName) reactInfo = r;
            }
            let DirectMessage = await u.send(`You reacted as ${emote}.${(reactInfo && reactInfo.checkRealmEye) ? ` If you have a(n) ${reactInfo.checkRealmEye.class} that is ${reactInfo.checkRealmEye.ofEight}/8${reactInfo.checkRealmEye.orb ? ` and has a tier ${reactInfo.checkRealmEye.orb} orb` : ''}` : ''},${(reactInfo && reactInfo.checkRealmeye && reactInfo.checkRealmEye.mheal) ? ` and a pet with at least ${reactInfo.checkRealmEye.mheal} mheal,` : ``} press :white_check_mark: to confirm your reaction. Otherwise ignore this message`).catch(r => { if (r.message == 'Cannot send messages to this user') this.commandChannel.send(`<@!${u.id}> tried to react with <${emote}> but their DMs are private`) });
            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, (r, u) => !u.bot);

            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", async (r, u) => {
                //check type
                if (!checkType(this)) return clearInterval(endAfter);

                //check realmeye if applicable
                if (reactInfo && reactInfo.checkRealmEye) {
                    let found = false;
                    let characters = await realmEyeScrape.getUserInfo(this.message.guild.members.cache.get(u.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]).catch(er => found = true)
                    if (characters.characters) characters.characters.forEach(c => {
                        if (!found && (c.class == 'Mystic' && c.stats == '8/8')) {
                            found = true;
                        }
                    })
                    if (!found) {
                        let prompt = await u.send(`I could not find any 8/8 mystics under \`${this.message.guild.members.cache.get(u.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]}\`. React with :white_check_mark: if you do have an 8/8 mystic on another account`)
                        let reactionCollector = new Discord.ReactionCollector(prompt, (r, u) => !u.bot);
                        await prompt.react('✅')
                        reactionCollector.on('collect', (r, u) => {
                            if (r.emoji.name == '✅')
                                sendLocation(this)
                        })
                    } else sendLocation(this)
                } else sendLocation(this)
                /**
                 * 
                 * @param {afkCheck} afk 
                 */
                function sendLocation(afk) {
                    //set into type
                    setType(afk)
                    function setType(afk) {
                        //key, vial, other
                        switch (type.toLowerCase()) {
                            case 'key':
                                afk.keys.push(u.id)
                                break;
                            case 'vial':
                                afk.vials.push(u.id)
                                break;
                            default:
                                afk.reactables[type].users.push(u.id)
                                break;
                        }
                        afk.earlyLocation.push(u);
                    }
                    //give location
                    u.send(`The location for this run has been set to \`${afk.afkInfo.location}\`, get there ASAP!`);
                    //add to leader embed
                    if (afk.afkInfo.vialReact && !(type == 'key' || type == 'vial')) index++;
                    if (afk.leaderEmbed.fields[index].value == `None!`) {
                        afk.leaderEmbed.fields[index].value = `${emote}: <@!${u.id}>`;
                    } else afk.leaderEmbed.fields[index].value += `\n${emote}: ${`<@!${u.id}>`}`
                    afk.leaderEmbedMessage.edit(afk.leaderEmbed).catch(er => ErrorLogger.log(er, afk.bot));
                    afk.runInfoMessage.edit(afk.leaderEmbed).catch(er => ErrorLogger.log(er, afk.bot));
                    //end collectors
                    clearInterval(endAfter);
                    dmReactionCollector.stop();
                }
            });
            function checkType(afk) { //true = spot open
                //key, vial, other
                switch (type) {
                    case 'key':
                        if (afk.keys.length >= limit || afk.keys.includes(u.id)) return false; else return true;
                    case 'vial':
                        if (afk.vials.length >= limit || afk.vials.includes(u.id)) return false; else return true;
                    default:
                        if (afk.reactables[type].users.length >= limit || afk.reactables[type].users.includes(u.id)) return false; else return true;
                }
            }
        } catch (er) { console.log(er) }
    }

    async useNitro(u, index) {
        let reactor = this.message.guild.members.cache.get(u.id);
        if (this.earlyLocation.includes(u)) {
            reactor.send(`The location for this run has been set to \`${this.afkInfo.location}\``);
            return;
        }
        if (reactor.roles.highest.position >= this.leaderOnLeave.position) {
            reactor.send(`The location for this run has been set to \`${this.afkInfo.location}\``);
            this.earlyLocation.push(u);
            return;
        }
        if (this.nitro.length + 1 > this.settings.numerical.nitrocount) return;
        if (reactor.roles.cache.has(this.nitroBooster.id)) {
            if (reactor.voice.channel && reactor.voice.channel.id == this.channel.id) {
                reactor.send('Nitro has changed and only gives garunteed spot in VC. You are already in the VC so this use hasn\'t been counted').catch(er => this.commandChannel.send(`<@!${u.id}> tried to react with <${botSettings.emote.shard}> but their DMs are private`))
            } else {
                await this.db.query(`SELECT * FROM users WHERE id = '${u.id}'`, async (err, rows) => {
                    if (err) ErrorLogger.log(err, bot)
                    if (rows.length == 0) return await this.db.query(`INSERT INTO users (id) VALUES('${u.id}')`)
                    if (Date.now() - this.settings.numerical.nitrocooldown > parseInt(rows[0].lastnitrouse)) {
                        //reactor.send(`The location for this run has been set to \`${this.afkInfo.location}\``);
                        //this.earlyLocation.push(u);
                        reactor.voice.setChannel(this.channel.id).catch(er => { reactor.send('Please join a voice channel and you will be moved in automatically') })
                        this.nitro.push(u)
                        if (this.leaderEmbed.fields[index].value == `None!`) this.leaderEmbed.fields[index].value = `<@!${u.id}> `;
                        else this.leaderEmbed.fields[index].value += `, <@!${u.id}>`
                        this.leaderEmbedMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot));
                        this.runInfoMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot));
                        this.db.query(`UPDATE users SET lastnitrouse = '${Date.now()}' WHERE id = ${u.id}`)
                    } else {
                        let lastUse = Math.round((Date.now() - rows[0].lastnitrouse) / 60000)
                        reactor.send(`Nitro perks have been limited to once an hour. Your last use was \`${lastUse}\` minutes ago`).catch(er => this.commandChannel.send(`<@!${u.id}> tried to react with <${botSettings.emote.shard}> but their DMs are private`))
                    }
                })
            }
        }
    }

    async pointsUse(u, index) {
        if (!this.settings.backend.points) return
        let pointEmbed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setFooter(`React with ✅ to confirm, or ❌ to cancel`)
        if (u.avatarURL()) pointEmbed.setAuthor('Please Confirm Point Usage', u.avatarURL())
        else pointEmbed.setAuthor('Please Confirm Point Usage')
        let earlyLocationCost = this.afkInfo.earlyLocationCost
        this.db.query(`SELECT points FROM users WHERE id = '${u.id}'`, async (err, rows) => {
            if (err) return
            if (rows.length == 0) return this.db.query(`INSERT INTO users (id) VALUES('${u.id}')`)
            if (rows[0].points < earlyLocationCost) return
            pointEmbed.setDescription(`You currently have \`${rows[0].points}\` points\nEarly location costs \`${earlyLocationCost}\``)
            let dms = await u.createDM().catch()
            let m = await dms.send(pointEmbed).catch(er => this.commandChannel.send(`<@!${u.id}> tried to react with 🎟️ but their DMs are private`))
            let reactionCollector = new Discord.ReactionCollector(m, (r, u) => !u.bot && (r.emoji.name == '❌' || r.emoji.name == '✅'))
            reactionCollector.on('collect', async (r, u) => {
                if (r.emoji.name == '❌') m.delete()
                else if (r.emoji.name == '✅') {
                    let er, success = true
                    let leftOver = await points.buyEarlyLocaton(u, this.db, earlyLocationCost, this.afkInfo, this.bot, this.message.guild).catch(r => { er = r; success = false })
                    if (success) {
                        await dms.send(`The location for this run has been set to \`${this.afkInfo.location}\`\nYou now have \`${leftOver}\` points left over`).catch(er => this.commandChannel.send(`<@!${u.id}> tried to react with 🎟️ but their DMs are private`))
                        if (this.leaderEmbed.fields[index].value == 'None!') this.leaderEmbed.fields[index].value = `<@!${u.id}>`
                        else this.leaderEmbed.fields[index].value += `, <@!${u.id}>`
                        this.earlyLocation.push(u)
                        await this.leaderEmbedMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        await this.runInfoMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        await m.delete()
                    }
                    else dms.send(`There was an issue using the points: \`${er}\``).catch(er => this.commandChannel.send(`<@!${u.id}> tried to react with 🎟️ but their DMs are private`))
                }
            })
            await m.react('✅')
            await m.react('❌')
        })
    }

    async supporterUse(u, index) {
        let reactor = this.message.guild.members.cache.get(u.id);
        if (this.earlyLocation.includes(u)) return reactor.send(`The location for this run has been set to \`${this.afkInfo.location}\``);
        this.tokenDB.query(`SELECT * FROM tokens WHERE active = true AND user = '${u.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err)
            if (!rows || rows.length == 0) return u.send(`You are not currently a supporter. If you would like to learn more, reply with \`support\``)
            if (rows[0].hasCooldown) {
                if (!rows[0].lastuse) giveLocation(this, true)
                else if (Date.now() - botSettings.earlyLocationCooldown > parseInt(rows[0].lastuse)) giveLocation(this, true)
                else u.send(`Your early location use will be available again in \`${60 - Math.round((Date.now() - rows[0].lastuse) / 60000)}\` minutes`)
            } else giveLocation(this, false)
        })
        function giveLocation(afkcheck, cooldown) {
            reactor.send(`The location for this run has been set to \`${afkcheck.afkInfo.location}\``);
            afkcheck.earlyLocation.push(u);
            reactor.voice.setChannel(afkcheck.channel.id).catch(er => { reactor.send('Please join any voice channel to get moved in') })
            afkcheck.nitro.push(u)
            if (afkcheck.leaderEmbed.fields[index].value == `None!`) afkcheck.leaderEmbed.fields[index].value = `<@!${u.id}> `;
            else afkcheck.leaderEmbed.fields[index].value += `, <@!${u.id}>`
            afkcheck.leaderEmbedMessage.edit(afkcheck.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot));
            afkcheck.runInfoMessage.edit(afkcheck.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot));
            if (cooldown) afkcheck.tokenDB.query(`UPDATE tokens SET lastuse = '${Date.now()}' WHERE active = true AND user = '${u.id}'`)
        }
    }

    async timerInterval() {
        this.time = this.time - 5;
        if (this.time == 0) {
            this.endedBy = this.bot.user;
            this.postAfk();
            return;
        }
        if (!this.mainEmbed) return;
        this.mainEmbed.setFooter(`Time Remaining: ${Math.floor(this.time / 60)} minutes and ${this.time % 60} seconds`);
        this.raidStatusMessage.edit(this.mainEmbed)
        this.bot.afkChecks[this.channel.id].timeLeft = this.time;
        this.bot.afkChecks[this.channel.id].vcSize = this.channel.members.size;
    }

    async updateVCNumber() {
        this.bot.afkChecks[this.channel.id].vcSize = this.channel.members.size;
    }

    async moveIn() {
        for (let u of this.earlyLocation) {
            let member = this.message.guild.members.cache.get(u.id);
            if (!member.voice.channel) continue;
            if (member.voice.channel.name == 'lounge' || member.voice.channel.name == 'Veteran Lounge' || member.voice.channel.name.includes('drag')) {
                await member.voice.setChannel(this.channel.id).catch(er => { });
            }
        }
        for (let u of this.nitro) {
            let member = this.message.guild.members.cache.get(u.id);
            if (!member.voice.channel) continue;
            if (member.voice.channel.name == 'lounge' || member.voice.channel.name == 'Veteran Lounge' || member.voice.channel.name.includes('drag')) {
                await member.voice.setChannel(this.channel.id).catch(er => { });
            }
        }
    }

    async postAfk() {
        this.raidStatusReactionCollector.stop();
        this.leaderReactionCollector.stop();
        clearInterval(this.moveInTimer);
        clearInterval(this.timer);
        clearInterval(this.updateVC)

        if (!this.afkInfo.postAfkCheck) return this.endAfk();
        //ill implement later
        this.endAfk();
    }

    async endAfk() {
        //split groups for split runs
        if (this.afkInfo.isSplit) await this.splitLogic();

        //lock channel
        await this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: true })
        if (this.eventBoi) await this.channel.updateOverwrite(this.eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true })
        if (this.afkInfo.newChannel && !this.isVet) {
            this.channel.setPosition(this.afkChannel.position)
        }

        //update embeds/messages
        this.mainEmbed.setDescription(`This afk check has been ended.\n${this.keys.length > 0 ? `Thank you to ${this.keys.map(k => `<@!${k}> `)} for popping a <${botSettings.emote.LostHallsKey}> for us!\n` : ''}If you get disconnected during the run, **JOIN LOUNGE** *then* DM me \`join\` to get back in`)
            .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        this.leaderEmbed.setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname} at`)
            .setTimestamp();
        this.raidStatusMessage.edit('', this.mainEmbed).catch(er => ErrorLogger.log(er, this.bot))
            .then(this.leaderEmbedMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot)))
            .then(this.runInfoMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot)))
            .then(this.leaderEmbedMessage.reactions.removeAll())

        //store afk check information
        let earlyLocationIDS = []
        for (let i in this.earlyLocation) earlyLocationIDS.push(this.earlyLocation[i].id)
        let raiders = []
        this.channel.members.array().forEach(m => raiders.push(m.id))
        this.bot.afkChecks[this.channel.id].keys = []
        this.bot.afkChecks[this.channel.id].earlyLocation = earlyLocationIDS
        this.bot.afkChecks[this.channel.id].raiders = raiders
        this.bot.afkChecks[this.channel.id].active = false
        this.bot.afkChecks[this.channel.id].endedAt = Date.now()
        if (this.keys.length > 0) for (let u in this.keys) this.bot.afkChecks[this.channel.id].keys.push(u)
        if (this.afkInfo.isSplit) {
            this.bot.afkChecks[this.channel.id].split = true
            this.bot.afkChecks[this.channel.id].mainGroup = this.mainGroup
            this.bot.afkChecks[this.channel.id].mainGroup = this.splitGroup
            this.bot.afkChecks[this.channel.id].splitChannel = 'na'
        }
        fs.writeFileSync('./afkChecks.json', JSON.stringify(this.bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.bot) })

        //send embed to history
        let historyEmbed = new Discord.MessageEmbed()
            .setColor(this.mainEmbed.hexColor)
            .setTitle(this.message.member.nickname)
            .addField('Leader', `${this.message.member}`)
            .addField('Ended by', `${this.endedBy}`)
            .addField('Key', 'None!')
            .addField('Early Location', 'None!')
            .addField('Raiders', 'None!')
        if (this.key) historyEmbed.fields[2].value = `<@!${this.key.id}>`
        this.earlyLocation.forEach(m => {
            if (historyEmbed.fields[3].value == `None!`) historyEmbed.fields[3].value = `<@!${m.id}>`
            else historyEmbed.fields[3].value += `, <@!${m.id}>`
        })
        let bigEmbed = false
        let biggerEmbed = false
        let biggestEmbed = false
        raiders.forEach(m => {
            if (bigEmbed) {
                if (historyEmbed.fields[5].value.length >= 1000) {
                    biggerEmbed = true;
                    historyEmbed.addField('-', `, <@!${m}>`)
                }
                else historyEmbed.fields[5].value += `, <@!${m}>`
            } else if (biggerEmbed) {
                if (historyEmbed.fields[6].value.length >= 1000) {
                    biggestEmbed = true;
                    historyEmbed.addField('-', `, <@!${m}>`)
                }
                else historyEmbed.fields[6].value += `, <@!${m}>`
            } else if (biggestEmbed) {
                historyEmbed.fields[7].value += `, <@!${m}>`
            } else {
                if (historyEmbed.fields[4].value.length >= 1000) {
                    bigEmbed = true;
                    historyEmbed.addField('-', `, <@!${m}>`)
                }
                else historyEmbed.fields[4].value += `, <@!${m}>`
            }
        })
        this.message.guild.channels.cache.get(this.settings.channels.history).send(historyEmbed)
        this.message.guild.channels.cache.get(this.settings.channels.runlogs).send(historyEmbed)

        //make sure everyone in run is in db
        if (this.channel.members) {
            let loggingQuery = `SELECT id FROM users WHERE `
            this.channel.members.each(m => { loggingQuery += `id = '${m.id}' OR ` })
            loggingQuery = loggingQuery.substring(0, loggingQuery.length - 4)
            this.db.query(loggingQuery, (err, rows) => {
                if (err) return
                let dbIds = []
                for (let i in rows) dbIds.push(rows[i].id)
                if (rows.length < this.channel.members.size) {
                    let unlogged = this.channel.members.keyArray().filter(e => !dbIds.includes(e))
                    for (let i in unlogged) {
                        this.db.query(`INSERT INTO users (id) VALUES('${unlogged[i]}')`)
                    }
                }
            })
        }

        if (this.settings.backend.points) {
            //key point logging
            for (let u of this.keys) {
                let points = this.settings.points.keypop
                if (this.guild.members.cache.get(u).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`)
            }
            for (let r in this.reactables) {
                if (this.reactables[r].users) this.reactables[r].users.forEach(u => {
                    let points = +this.reactables[r].points
                    if (this.message.guild.members.cache.get(u).roles.cache.has(this.nitroBooster.id)) points = +points * +this.settings.points.nitromultiplier
                    this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`)
                })
            }
        }

        //log key
        for (let u of this.keys) {
            this.db.query(`UPDATE users SET keypops = keypops + 1 WHERE id = '${u}'`)
            keyRoles.checkUser(this.guild.members.cache.get(u), this.bot, this.db)
        }

        //log run 1 minute after afk check
        if (restart.restarting) log(this)
        else setTimeout(log, 60000, this)
        function log(afkCheck) {
            if (afkCheck.channel && afkCheck.channel.members.size != 0) {
                let query = `UPDATE users SET `
                if (afkCheck.afkInfo.vialReact) query = query.concat('voidRuns = voidRuns + 1 WHERE ')
                else query = query.concat('cultRuns = cultRuns + 1 WHERE ')
                afkCheck.channel.members.each(m => query = query.concat(`id = '${m.id}' OR `))
                query = query.substring(0, query.length - 4)
                afkCheck.db.query(query, err => {
                    if (err) ErrorLogger.log(err, this.bot)
                })
                if (afkCheck.settings.backend.points) {
                    //give points to everyone in run
                    let regular = []
                    let nitros = []
                    afkCheck.channel.members.each(m => {
                        if (m.roles.cache.has(afkCheck.nitroBooster.id)) nitros.push(m)
                        else regular.push(m)
                    })
                    //regular raiders point logging
                    if (afkCheck.settings.points.perrun != 0) {
                        let regularQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun} WHERE `
                        regular.forEach(m => regularQuery = regularQuery.concat(`id = '${m.id}' OR `))
                        regularQuery = regularQuery.substring(0, regularQuery.length - 4)
                        afkCheck.db.query(regularQuery, err => { if (err) ErrorLogger.log(err, this.bot) })
                        //nitro raiders point logging
                        let nitroQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun * afkCheck.settings.points.nitromultiplier} WHERE `
                        nitros.forEach(m => nitroQuery = nitroQuery.concat(`id = '${m.id}' OR `))
                        nitroQuery = nitroQuery.substring(0, nitroQuery.length - 4)
                        afkCheck.db.query(nitroQuery, err => { if (err) ErrorLogger.log(err, this.bot) })
                    }
                }
            }
        }

        //mark afk check as over
        setTimeout(() => { emitter.emit('Ended', this.channel.id) }, 2000);

        this.active = false;
    }

    async abortAfk() {
        this.raidStatusReactionCollector.stop();
        this.leaderReactionCollector.stop();
        clearInterval(this.moveInTimer);
        clearInterval(this.timer);
        clearInterval(this.updateVC)

        await this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: false })
        if (this.eventBoi) await this.channel.updateOverwrite(this.eventBoi.id, { CONNECT: false, VIEW_CHANNEL: false })
        setTimeout(() => this.channel.setPosition(this.channel.parent.children.filter(c => c.type == 'voice').size - 1), 1000)

        this.mainEmbed.setDescription(`This afk check has been aborted`)
            .setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        this.leaderEmbed.setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname} at`)
            .setTimestamp();

        this.raidStatusMessage.edit('', this.mainEmbed).catch(er => ErrorLogger.log(er, this.bot))
        this.leaderEmbedMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot))
        this.runInfoMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot))

        let earlyLocationIDS = []
        for (let i in this.earlyLocation) earlyLocationIDS.push(this.earlyLocation[i].id)
        let raiders = []
        this.channel.members.array().forEach(m => raiders.push(m.id))
        this.bot.afkChecks[this.channel.id] = {
            isVet: this.isVet,
            leader: this.message.author.id,
            earlyLocation: earlyLocationIDS,
            raiders: raiders,
            time: Date.now(),
            runType: this.run
        }
        if (this.keys.length > 0)
            fs.writeFileSync('./afkChecks.json', JSON.stringify(this.bot.afkChecks, null, 4), err => {
                if (err) ErrorLogger.log(err, this.bot)
            })


        emitter.emit('Ended', this.channel.id)
        this.active = false;
    }

    async splitLogic() {
        this.mainGroup = []
        this.splitGroup = []
        let vc = [];
        this.channel.members.each(m => { vc.push(m.id) })
        //assign knights to alternating groups
        for (let i = 0; i < this.knights.length; i++) {
            let id = this.knights[i].id
            if (this.mainGroup.includes(id) || this.splitGroup.includes(id)) continue
            if (i % 2 == 0) this.mainGroup.push(id)
            else this.splitGroup.push(id)
            let index = vc.indexOf(id)
            if (index > -1) vc.splice(index, 1)
        }
        for (let i = 0; i < this.warriors.length; i++) {
            let id = this.warriors[i].id
            if (this.mainGroup.includes(id) || this.splitGroup.includes(id)) continue
            if (i % 2 == 0) this.mainGroup.push(id)
            else this.splitGroup.push(id)
            let index = vc.indexOf(id)
            if (index > -1) vc.splice(index, 1)
        }
        for (let i = 0; i < this.pallies.length; i++) {
            let id = this.pallies[i].id
            if (this.mainGroup.includes(id) || this.splitGroup.includes(id)) continue
            if (i % 2 == 0) this.mainGroup.push(id)
            else this.splitGroup.push(id)
            let index = vc.indexOf(id)
            if (index > -1) vc.splice(index, 1)
        }
        //assign rl to main group
        this.mainGroup.push(this.message.author.id)
        let index = vc.indexOf(this.message.author.id)
        if (index > -1) vc.splice(index, 1)
        //assign groups
        for (let i = 0; i < vc.length; i++) {
            let id = vc[i]
            if (this.mainGroup.includes(id) || this.splitGroup.includes(id)) continue
            if (i % 2 == 0) this.mainGroup.push(id)
            else this.splitGroup.push(id)
        }
        let groupEmbed = new Discord.MessageEmbed()
            .setAuthor(`Split Groups for ${this.channel.name}`)
            .addField('Main', 'None!')
            .addField('Split', 'None!')
        if (this.message.author.avatarURL()) groupEmbed.author.iconURL = this.message.author.avatarURL()
        for (let i in this.mainGroup) {
            let member = this.message.guild.members.cache.get(this.mainGroup[i])
            let nick
            if (!member) nick = `<@!${this.mainGroup[i]}>`
            else nick = member.nickname
            if (groupEmbed.fields[0].value == 'None!') groupEmbed.fields[0].value = `${nick}`
            else groupEmbed.fields[0].value += `\n${nick}`
        }
        for (let i in this.splitGroup) {
            let member = this.message.guild.members.cache.get(this.splitGroup[i])
            let nick
            if (!member) nick = `<@!${this.splitGroup[i]}>`
            else nick = member.nickname
            if (groupEmbed.fields[1].value == 'None!') groupEmbed.fields[1].value = `${nick}`
            else groupEmbed.fields[1].value += `\n${nick}`
        }
        this.raidStatus.send(groupEmbed)
    }

    async changeLocation(location) {
        this.afkInfo.location = location;

        if (!this.leaderEmbed) return

        this.leaderEmbed.fields[this.leaderEmbed.fields.length - 3].value = this.afkInfo.location;

        this.leaderEmbedMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot));
        this.runInfoMessage.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, this.bot));

        for (let i of this.earlyLocation) {
            await i.send(`The location for this run has changed to \`${this.afkInfo.location}\``)
        }
    }
}

/**
 * 
 * @param {*} runInfo 
 * @param {Discord.Message} message 
 * @param {Discord.Client} bot 
 */
async function createChannel(runInfo, message, bot) {
    let settings = bot.settings[message.guild.id]
    return new Promise(async (res, rej) => {
        //channel creation
        if (runInfo.isEvent) {
            var parent = 'events';
            var template = message.guild.channels.cache.get(settings.voice.eventtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.raider)
            var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.eventchannels)
        }
        else if (runInfo.isVet) {
            var parent = 'veteran raiding';
            var template = message.guild.channels.cache.get(settings.voice.vettemplate)
            var raider = message.guild.roles.cache.get(settings.roles.vetraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
        }
        else {
            var parent = 'raiding';
            var template = message.guild.channels.cache.get(settings.voice.raidingtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.raider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.raidingchannels)
        }
        if (!template) return rej(`Template channel not found`)
        let channel = await template.clone({
            name: `${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s ${runInfo.runType}`,
            parent: message.guild.channels.cache.filter(c => c.type == 'category').find(c => c.name.toLowerCase() === parent).id,
            userLimit: runInfo.vcCap
        }).then(c => c.setPosition(0))

        await message.member.voice.setChannel(channel).catch(er => { })

        //allows raiders to view
        channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        if (eventBoi) channel.updateOverwrite(eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))

        //Embed to remove
        let embed = new Discord.MessageEmbed()
            .setDescription(`Whenever the run is over. React with the ❌ to delete the channel. View the timestamp for more information\nLocation: \`${runInfo.location}\``)
            .setFooter(channel.id)
            .setTimestamp()
            .setTitle(channel.name)
            .setColor(runInfo.embed.color)
        let m = await vibotChannels.send(`${message.member}`, embed)
        await m.react('❌')
        setTimeout(() => { Channels.watchMessage(m, bot, settings) }, 5000)
        if (!channel) rej('No channel was made')
        res(channel);
    })
}

async function getTemplate(message, afkTemplates, runType) {
    return new Promise(async (res, rej) => {
        let templates = []
        for (let i in afkTemplates) {
            if (i == message.author.id) templates.push(afkTemplates[i])
        }
        if (templates.length == 0) rej('No templates for user')
        for (let i in templates) {
            if (templates[i].symbol.toLowerCase() == runType.toLowerCase()) return res(templates[i])
        }
        rej(`No templates found with the identifyer \`${runType}\``)
    })
}

async function destroyInactiveRuns() {
    for (let i of runs) {
        if (!i.afk.active) {
            delete i.afk;
        }
    }
    runs = runs.filter((v, i, r) => v.afk)
}