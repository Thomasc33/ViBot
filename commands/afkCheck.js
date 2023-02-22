const Discord = require('discord.js')
const botSettings = require('../settings.json')
const Channels = require('./vibotChannels')
const fs = require('fs')
const ErrorLogger = require('../lib/logError')
const realmEyeScrape = require('../lib/realmEyeScrape');
const points = require('./points');
const keyRoles = require('./keyRoles');
const restart = require('./restart')
const EventEmitter = require('events').EventEmitter
const pointLogger = require('../lib/pointLogger')
const patreonHelper = require('../lib/patreonHelper')
const afkTemplates = require('../afkTemplates.json')
const bannedNames = require('../data/bannedNames.json')
var emitter = new EventEmitter()
require(`../lib/extensions`)

var runs = [] //{channel: id, afk: afk instance}
var registeredWithRestart = false;
var registeredWithVibotChannels = false;

module.exports = {
    name: 'afk',
    // alias: ['nafk'],
    description: 'The new version of the afk check',
    requiredArgs: 1,
    args: '<run symbol> (key count) (#/raiding vc) <location>',
    role: 'almostrl',
    getNotes(guildid, member) {
        return `${afkTemplates[guildid] ? Object.keys(afkTemplates[guildid]).map(afk => `\`${afkTemplates[guildid][afk].symbol}\``).join(', ') : 'None for guild'}${afkTemplates[member.id] ? `, ${Object.keys(afkTemplates[member.id]).map(afk => `\`${afkTemplates[member.id][afk].symbol}\``).join(', ')}` : ''}`
    },
    emitter,
    getRunType,
    requestButtonHandler,
    get runs() {
        return [...runs];
    },
    /**
     * Main Execution Function
     * @param {Discord.Message} message
     * @param {String[]} args
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     * @param {import('mysql').Connection} tokenDB
     */
    async execute(message, args, bot, db, tokenDB, event) {
        let settings = bot.settings[message.guild.id]
        if (!registeredWithRestart) {
            restart.registerAFKCheck(module.exports);
            registeredWithRestart = true;
        }
        if (!registeredWithVibotChannels) {
            Channels.registerAFKCheck(module.exports);
            registeredWithVibotChannels = true;
        }
        //clear out runs array
        destroyInactiveRuns();
        let shift = args.shift();
        let symbol = shift.toLowerCase();
        let isAdvanced = false;
        if (symbol[0] == 'a') {
            isAdvanced = true;
        }
        let raidingVC;
        if (settings.backend.useStaticVCForRaiding) { raidingVC = args[0]; args.shift(); }
        //Check Run Type
        let runType = getRunType(symbol, message.guild.id);
        if (isAdvanced && !bot.settings[message.guild.id].backend.allowAdvancedRuns) return
        if (!runType && message.member.roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles.vetrl).position) return message.channel.send('Run Type Not Recognized')
        if (!runType) runType = await getTemplate(message, afkTemplates, shift)
        if (!runType) return await message.channel.send(`Could not find run type ${symbol}`)

        //Check for keycount
        let keyCount
        if (!isNaN(parseInt(args[0]))) {
            keyCount = parseInt(args[0])
            args.shift()
        }

        //create afkInfo from templates
        let runInfo = { ...runType }
        if (keyCount) runInfo.keyCount = keyCount

        //is advanced run
        runInfo.isAdvanced = isAdvanced;

        //isVet
        runInfo.isVet = message.channel.parent.name.toLowerCase() == bot.settings[message.guild.id].categories.veteran ? true : false;

        //set Raid Leader
        runInfo.raidLeader = message.author.id;

        //get/set location
        let location = ''
        for (i = 0; i < args.length; i++) location = location.concat(args[i]) + ' ';
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (location == '') location = 'None'
        runInfo.location = location.trim();

        //set guildid
        runInfo.guild = message.guild.id;

        //get/set channel
        let channel = null;
        if (settings.backend.useStaticVCForRaiding) {
            runInfo.channel = settings.voice["raiding" + raidingVC]
            channel = bot.channels.cache.get(runInfo.channel)
            if (!channel) return message.channel.send(`Unable to create/find the channel you are in`)
        } else {
            if (runInfo.newChannel) channel = await createChannel(runInfo, message, bot)
            else channel = message.member.voice.channel;
            if (!channel) return message.channel.send(`Unable to create/find the channel you are in`)
            else runInfo.channel = channel.id;
        }

        //begin afk check
        let afkModule = new afkCheck(runInfo, bot, db, message.guild, channel, message, tokenDB)
        runs.push({ channel: channel.id, afk: afkModule })
        if (runInfo.startDelay > 0) setTimeout(begin, runInfo.startDelay, afkModule)
    },
    async eventAfkExecute(message, args, bot, db, tokenDB, event, isVet, raidingVC) {
        settings = bot.settings[message.guild.id]
        if (!registeredWithRestart) {
            restart.registerAFKCheck(module.exports);
            registeredWithRestart = true;
        }
        if (!registeredWithVibotChannels) {
            Channels.registerAFKCheck(module.exports);
            registeredWithVibotChannels = true;
        }
        args.shift();
        //clear out runs array
        destroyInactiveRuns();

        //copy event template
        let runInfo = { ...event }

        //isVet
        runInfo.isVet = isVet;

        //set Raid Leader
        runInfo.raidLeader = message.author.id;

        //get/set location
        let location = args.join(' ')
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (location == '') location = 'None'
        runInfo.location = location.trim();

        //set guildid
        runInfo.guild = message.guild.id;

        //get/set channel
        let channel = null;
        if (settings.backend.useStaticVCForRaiding) {
            runInfo.channel = settings.voice["raiding" + raidingVC]
            channel = bot.channels.cache.get(runInfo.channel)
            if (!channel) return message.channel.send(`Unable to create/find the channel you are in`)
        } else {
            if (runInfo.newChannel) channel = await createChannel(runInfo, message, bot)
            else channel = message.member.voice.channel;
            if (!channel) return message.channel.send(`Unable to create/find the channel you are in`)
            else runInfo.channel = channel.id;
        }

        //begin afk check
        let afkModule = new afkCheck(runInfo, bot, db, message.guild, channel, message, tokenDB)
        runs.push({ channel: channel.id, afk: afkModule })
        if (runInfo.startDelay > 0) setTimeout(begin, runInfo.startDelay, afkModule)
    },
    changeLocation(location, channelID) {
        for (const run of runs) {
            if (run.channel == channelID) {
                run.afk.changeLocation(location);
                return;
            }
        }
        return 'Run not found';
    },
    async checkRuns() {
        let activeRuns = []
        for (let i of runs)
            if (i.afk.active) activeRuns.push(i.channel)
        return activeRuns
    },
    //used by vibotChannels to abort runs when channels are closed
    async returnRunByID(channel_id) {
        for (let i of runs) {
            if (i.afk.active && i.channel == channel_id) { return i.afk; }
        }
        return undefined;
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
     * @param {String} afkInfo.keyEmote
     * @param {String} afkInfo.vialEmote
     * @param {String} afkInfo.keyLogName
     * @param {String} afkInfo.headcountEmote
     * @param {Boolean} afkInfo.isVet
     * @param {Boolean} afkInfo.twoPhase
     * @param {Boolean} afkInfo.isEvent
     * @param {Boolean} afkInfo.isAdvanced
     * @param {Boolean} afkInfo.isSplit
     * @param {Boolean} afkInfo.newChannel
     * @param {Boolean} afkInfo.vialReact
     * @param {Boolean} afkInfo.postAfkCheck
     * @param {Booelan} afkInfo.headcountOnAfk
     * @param {Number} afkInfo.startDelay
     * @param {Number} afkInfo.vcCap
     * @param {Number} afkInfo.timeLimit
     * @param {String[]} afkInfo.earlyLocationReacts
     * @param {String} afkInfo.earlyLocationReacts.class
     * @param {String} afkInfo.earlyLocationReacts.ofEight
     * @param {String[]} afkInfo.reacts
     * @param {Discord.EmbedBuilder} afkInfo.embed
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     * @param {Discord.Guild} guild
     * @param {Discord.VoiceChannel} channel
     * @param {Discord.Message} message
     */
    constructor(afkInfo, bot, db, guild, channel, message, tokenDB) {
        this.settings = bot.settings[guild.id]
        this.afkInfo = afkInfo;
        if (!this.settings.backend.allowAdvancedRuns)
            this.afkInfo.isAdvanced = false;

        this.bot = bot;
        this.db = db;
        this.guild = guild;
        this.channel = channel;
        this.message = message;
        this.tokenDB = tokenDB
        if (this.afkInfo.isEvent && !(this.afkInfo.isExalt && this.settings.backend.exaltsInRSA)) {
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
            else if (this.afkInfo.isExalt) this.raidStatus = this.guild.channels.cache.get(!isNaN(this.settings.channels.exaltstatus) ? this.settings.channels.exaltstatus : this.settings.channels.eventstatus)
            else this.raidStatus = this.guild.channels.cache.get(this.settings.channels.raidstatus)
            if (this.afkInfo.isVet) this.commandChannel = this.guild.channels.cache.get(this.settings.channels.vetcommands)
            else this.commandChannel = this.guild.channels.cache.get(this.settings.channels.raidcommands)
            if (this.afkInfo.isVet) this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.vetraider)
            else this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.raider)
            this.staffRole = guild.roles.cache.get(this.afkInfo.isEvent ? this.settings.roles.eventrl : this.settings.roles.almostrl)
        }
        this.afkChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'afk')
        if (!this.afkChannel) this.afkChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'lounge')
        this.runInfoChannel = guild.channels.cache.get(this.settings.channels.runlogs)
        this.officialRusher = guild.roles.cache.get(this.settings.roles.rusher)
        this.perkRoles = this.settings.lists.perkRoles.map(role => guild.roles.cache.get(this.settings.roles[role]))
        this.leaderOnLeave = guild.roles.cache.get(this.settings.roles.lol)
        this.trialRaidLeader = guild.roles.cache.get(this.settings.roles.trialrl)
        this.keys = []
        this.earlyReacts = {}
        this.moddedKeys = false
        this.vials = []
        this.earlyLocation = []
        this.openInteractions = []
        this.raiders = []
        this.pointsUsers = []
        this.supporter = []
        this.supporterReacts = []
        this.endedBy
        this.time = this.afkInfo.timeLimit
        this.postTime = 20;
        this.reactables = {}
        this.active = true;
        if (this.afkInfo.earlyLocationReacts) {
            for (let i of this.afkInfo.earlyLocationReacts) {
                this.reactables[i.shortName] = { users: [], points: i.pointsGiven }
            }
        }
        this.partneredMessageSent = false
        this.partneredMessage = null
        this.partneredPings = null
        this.knights = []
        this.warriors = []
        this.pallies = []
        this.bot.afkChecks[this.channel.id] = {
            timeLeft: this.time,
            isVet: this.isVet,
            //location: this.afkInfo.location, disabled until it is needed
            //keys: [],
            leader: this.message.author.id,
            leaderNick: this.message.member.displayName.replace(/[^a-z|]/gi, '').split('|')[0],
            //earlyLocation: earlyLocationIDS,
            //raiders: raiders,
            time: Date.now(),
            runType: this.afkInfo,
            active: true,
            vcSize: this.channel.members.size,
        }
        if (!this.afkInfo.hasOwnProperty('embed')) { this.afkInfo.embed = {} }
        this.afkInfo.embed.description = ""
        if (this.channel) { this.afkInfo.embed.description += `To join, **click here** ${this.channel}\n` }
        if (this.afkInfo.keyEmote) { this.afkInfo.embed.description += `If you have a key react with ${this.bot.storedEmojis[this.afkInfo.keyEmote].text}\n` }
        if (this.afkInfo.vialEmote) { this.afkInfo.embed.description += `If you have a vial react with ${this.bot.storedEmojis[this.afkInfo.vialEmote].text}\n` }
        if (this.afkInfo.earlyLocationReacts.length >= 1) {
            this.afkInfo.embed.description += `If you have any of the following react with ${this.afkInfo.earlyLocationReacts.map(
                emoji => this.bot.storedEmojis[emoji.emote].text
            ).join(', ')}\n`
        }
        if (this.afkInfo.reacts.length >= 1) {
            this.afkInfo.embed.description += `If you have any of the following react with it to indicate you are bringing it ${this.afkInfo.reacts.map(
                emoji => this.bot.storedEmojis[emoji].text
            ).join(', ')}\n`
        }
        if (this.perkRoles.length >= 1) {
            this.afkInfo.embed.description += `If you have any of the following roles ${this.perkRoles.map(
                role => role
            ).join(', ')} react with ${this.bot.storedEmojis['NitroBooster'].text}\n`
        }
        fs.writeFileSync('./afkChecks.json', JSON.stringify(this.bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.bot, this.guild) })
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
        const pings = this.afkInfo.pingRole ? (typeof this.afkInfo.pingRole != "string" ? this.afkInfo.pingRole.map(r => `<@&${this.settings.roles[r]}>`).join(' ') : `<@&${this.settings.roles[this.afkInfo.pingRole]}>`) + ' @here' : '@here';

        if (this.afkInfo.startDelay > 0) {
            const avsan = /^[aeiou]/i.test(this.afkInfo.runName) ? 'An' : 'A';

            let embed = new Discord.EmbedBuilder()
                .setColor(this.afkInfo.embed.color)
                .setDescription(`${avsan} \`${this.afkInfo.runName}\`${flag ? `in (${flag})` : ''} will begin in ${Math.round(this.afkInfo.startDelay / 1000)} seconds. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : `Be prepared to join \`${this.channel.name}\``}`)
            if (this.afkInfo.embed.thumbnail) embed.setThumbnail(this.afkInfo.embed.thumbnail)
            this.raidStatusMessage = await this.raidStatus.send({
                content: `${pings}, ${this.afkInfo.runName}${flag ? ` (${flag})` : ''}. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : ''}`,
                embeds: [embed]
            })
        } else {
            this.raidStatusMessage = await this.raidStatus.send(`${pings}, \`${this.afkInfo.runName}\`${flag ? ` (${flag})` : ''} is beginning now. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : `Please join ${this.channel.name}`}`)
            this.start()
        }
        if (this.afkInfo.partneredServerPing) {
            function getPartneredServers(guildId, bot) {
                for (let i in bot.partneredServers) {
                    if (bot.partneredServers[i].guildId == guildId) { return bot.partneredServers[i]}
                }
                return null
            }
            let partneredServer = getPartneredServers(this.message.guild.id, this.bot)
            if (partneredServer) {
                const partneredSettings = this.bot.settings[partneredServer.id]
                let otherServer = this.bot.guilds.cache.find(g => g.id == partneredServer.id)
                let partneredChannel;
                let otherServerCache = otherServer.channels.cache
                let settingCategories = this.settings.categories
                let parentName = this.message.channel.parent.name.toLowerCase()
                if (parentName === settingCategories.raiding.toLowerCase()) partneredChannel = otherServerCache.get(partneredSettings.channels.raidstatus)
                else if (parentName === settingCategories.veteran.toLowerCase()) partneredChannel = otherServerCache.get(partneredSettings.channels.vetstatus)
                else partneredChannel = otherServerCache.get(partneredSettings.channels.eventstatus)
                if (this.afkInfo.partneredServerPingPriority) partneredChannel = otherServerCache.get(partneredSettings.channels[this.afkInfo.partneredServerPingPriority])
                this.partneredPings = this.afkInfo.pingRole ? (typeof this.afkInfo.pingRole != "string" ? this.afkInfo.pingRole.map(r => `<@&${partneredSettings.roles[r]}>`).join(' ') : `<@&${partneredSettings.roles[this.afkInfo.pingRole]}>`) + ' @here' : '@here';
                this.partneredMessageSent = true
                this.partneredMessage = await partneredChannel.send(`${this.partneredPings},  **${this.afkInfo.runName}** is starting inside of **${this.message.guild.name}** in ${this.channel} at \`\`${this.afkInfo.location}\`\``)
            }
        }
    }

    async start() {
        this.leaderEmbed = new Discord.EmbedBuilder()
            .setColor(this.afkInfo.embed.color || "#fefefe")
            .setTitle(`${this.message.member.nickname}'s ${this.afkInfo.runName}`)
            .setFooter({ text: `${this.afkInfo.twoPhase ? 'Click ✅ to open the channel, ' : ''}Click ❌ to abort, Click 🔑 for keys to be logged as Modded` })
            .setDescription(`**Raid Leader: ${this.message.member} \`\`${this.message.member.nickname}\`\`\nVC: ${this.channel}\nLocation:** \`\`${this.afkInfo.location}\`\``)
        if (this.afkInfo.keyEmote) this.leaderEmbed.addFields({ name: `${this.bot.storedEmojis[this.afkInfo.keyEmote].text} Keys`, value: 'None!', inline: true})
        if (this.afkInfo.vialReact) this.leaderEmbed.addFields({ name: '<:VialOfPureDarkness:1050494410770632794> Vials', value: 'None!', inline: true})
        this.afkInfo.earlyLocationReacts.forEach(r => this.leaderEmbed.addFields({ name: `${this.bot.storedEmojis[r.emote].text} ${r.shortName}`, value: 'None!', inline: true }))
        this.leaderEmbed.addFields([
            { name: '🗺️ Early Location', value: 'None!', inline: true },
            { name: `${this.bot.storedEmojis.NitroBooster.text} Supporters`, value: 'None!', inline: true },
        ])

        let lar;
        if (this.afkInfo.twoPhase) {
            lar = new Discord.ActionRowBuilder()
                .addComponents([
                    new Discord.ButtonBuilder()
                        .setLabel('✅ Open Channel')
                        .setStyle(3)
                        .setCustomId('openvc'),
                    new Discord.ButtonBuilder()
                        .setLabel('❌ Abort')
                        .setStyle(4)
                        .setCustomId('end'),
                    new Discord.ButtonBuilder()
                        .setLabel('🔑 Modded')
                        .setStyle(1)
                        .setCustomId('modded')
                ])
        } else {
            lar = new Discord.ActionRowBuilder()
                .addComponents([
                    new Discord.ButtonBuilder()
                        .setLabel('✅ Start Run')
                        .setStyle(3)
                        .setCustomId('start'),
                    new Discord.ButtonBuilder()
                        .setLabel('❌ Abort')
                        .setStyle(4)
                        .setCustomId('end'),
                    new Discord.ButtonBuilder()
                        .setLabel('🔑 Modded')
                        .setStyle(1)
                        .setCustomId('modded')
                ])
        }
        this.leaderEmbedMessage = await this.commandChannel.send({ embeds: [this.leaderEmbed], components: [lar] })
        this.runInfoMessage = await this.runInfoChannel.send({ embeds: [this.leaderEmbed] })

        //add interaction collectors
        this.leaderInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.leaderEmbedMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.leaderInteractionCollector.on('collect', (interaction) => this.interactionHandler(interaction))

        const avsan = /^[aeiou]/i.test(this.afkInfo.runName) ? 'An' : 'A';

        //send messages
        this.mainEmbed = new Discord.EmbedBuilder(this.afkInfo.embed);
        this.mainEmbed.setAuthor({ name: `${avsan} ${this.afkInfo.runName} Has Been Started in ${this.channel.name}` })
            .setColor(this.afkInfo.embed.color)
            .setFooter({ text: `Time Remaining: ${Math.floor(this.time / 60)} minutes and ${this.time % 60} seconds` })
            .setTimestamp(Date.now())
        if (this.message.author.avatarURL()) this.mainEmbed.data.author.iconURL = this.message.author.avatarURL()
        if (this.afkInfo.reqsImageUrl) this.mainEmbed.setImage(this.afkInfo.reqsImageUrl)
        else if (this.afkInfo.isAdvanced && !this.afkInfo.isExalt && this.settings.strings.hallsAdvancedReqsImage) this.mainEmbed.setImage(this.settings.strings.hallsAdvancedReqsImage);
        else if (this.afkInfo.isAdvanced && this.afkInfo.isExalt && this.settings.strings.exaltsAdvancedReqsImage) this.mainEmbed.setImage(this.settings.strings.exaltsAdvancedReqsImage);
        if (this.afkInfo.embed.thumbnail && !this.afkInfo.embed.removeThumbnail) this.mainEmbed.setThumbnail(this.afkInfo.embed.thumbnail)
        // Weird workaround for v14 bug (thumbnail has to be {url} instead of url string)
        if (this.mainEmbed.data.thumbnail && typeof (this.mainEmbed.data.thumbnail) == 'string') this.mainEmbed.setThumbnail(this.mainEmbed.data.thumbnail)
        if (this.afkInfo.twoPhase)
            this.mainEmbed.data.description = this.mainEmbed.data.description.replace("To join, **click here** {voicechannel}\n", "");
        else
            this.mainEmbed.data.description = this.mainEmbed.data.description.replace('{voicechannel}', `${this.channel}`);
        const rules = `<#${this.settings.channels.raidingrules}>` || '#raiding-rules';

        if (this.afkInfo.isAdvanced)
            this.mainEmbed.data.description += `\n\n**__Advanced Runs__**\nThis is an **advanced run**, meaning there are extended requirements you **MUST** meet. You must be both **__8/8__** and follow the requirements sheet listed below.\n\nBasic raiding rules from ${rules} will still apply.\n\nIf you are caught not meeting these requirements, you will be removed from the run and suspended.`

        this.raidStatusMessage.edit({ embeds: [this.mainEmbed] })
        if (this.bot.afkChecks[this.channel.id])
            this.bot.afkChecks[this.channel.id].url = this.raidStatusMessage.url

        //unlock channel
        if (!this.afkInfo.twoPhase) {
            this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { Connect: true, ViewChannel: true })
            if (this.eventBoi) this.channel.permissionOverwrites.edit(this.eventBoi.id, { Connect: true, ViewChannel: true })
        }

        //create reaction collector
        this.raidStatusInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.raidStatusInteractionCollector.on('collect', interaction => this.interactionHandler(interaction))
        this.raidStatusReactionCollector = new Discord.ReactionCollector(this.raidStatusMessage, { filter: (r, u) => !u.bot })
        this.raidStatusReactionCollector.on('collect', (r, u) => this.reactionHandler(r, u))

        //add reactions
        this.addButtons()

        //start timers
        this.moveInTimer = await setInterval(() => this.moveIn(), 10000);
        this.timer = await setInterval(() => this.timerInterval(), 5000);
        this.updateVC = await setInterval(() => this.updateVCNumber(), 500);
    }

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     */
    async interactionHandler(interaction) {
        if (!interaction.isButton()) return;
        if (this.openInteractions.includes(interaction.user.id)) return interaction.deferUpdate()
        if (interaction.customId == this.afkInfo.keyEmote) {
            this.confirmSelection(interaction, 0, 'key', this.afkInfo.keyCount)
        }
        else if (this.afkInfo.vialReact && interaction.customId == this.afkInfo.vialEmote) this.confirmSelection(interaction, 1, 'vial', 3)
        else if (interaction.customId === 'supporter') return this.useSupporter(interaction, this.leaderEmbed.data.fields.length - 1)
        else if (interaction.customId === 'points') return this.pointsUse(interaction, this.leaderEmbed.data.fields.length - 2)
        else if (interaction.customId === 'start') {
            if (this.guild.members.cache.get(interaction.user.id).roles.highest.position >= this.staffRole.position) {
                this.endedBy = interaction.user;
                interaction.deferUpdate()
                return this.postAfk()
            } else { return interaction.reply({ ephemeral: true, content: 'You are not a staff member' }) }
        }
        else if (interaction.customId === 'end') {
            if (this.guild.members.cache.get(interaction.user.id).roles.highest.position >= this.staffRole.position) {
                this.endedBy = interaction.user;
                interaction.deferUpdate()
                return this.abortAfk()
            } else { return interaction.reply({ ephemeral: true, content: 'You are not a staff member' }) }
        }
        else if (interaction.customId === 'modded') {
            if (this.keys.length == 0) { return interaction.reply({ ephemeral: true, content: 'There are no key reacts' }) }
            if (this.guild.members.cache.get(interaction.user.id).roles.highest.position < this.staffRole.position) { return interaction.reply({ ephemeral: true, content: 'You are not a staff member' }) }
            let confirmEmbed = new Discord.EmbedBuilder()
                .setColor(this.afkInfo.embed.color)
                .setDescription(`Are you sure you wanna add 1 Modded Pop for each key?`)
            interaction.channel.send({ embeds: [confirmEmbed] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(interaction.user.id)) {
                    this.moddedKeys = true
                    let temp_leader_components = this.leaderEmbedMessage.components;
                    for (let i = 0; i < temp_leader_components.length; i++) {
                        for (let j = 0; j < temp_leader_components[i].components.length; j++) {
                            if (temp_leader_components[i].components[j].customId === 'modded') {
                                temp_leader_components[i].components[j] = new Discord.ButtonBuilder({ label: '🔑 Modded', customId: 'modded', disabled: true, style: Discord.ButtonStyle.Secondary });
                            }
                        }
                    }
                    this.leaderEmbedMessage = await this.leaderEmbedMessage.edit({ components: temp_leader_components })
                    const embed = new Discord.EmbedBuilder()
                        .setColor(this.afkInfo.embed.color)
                        .setDescription(`These have recieved modded pops\n<@!${this.keys.join('>, <@!')}>`)
                    interaction.reply({ ephemeral: true, embeds: [embed], components: [], content: "" })
                    confirmMessage.delete();
                } else return confirmMessage.delete();
            })
        }
        else if (interaction.customId === 'openvc') {
            if (this.afkInfo.twoPhase) {
                if (this.guild.members.cache.get(interaction.user.id).roles.highest.position >= this.staffRole.position) {
                    interaction.deferUpdate();
                    let temp_rs_components = this.raidStatusMessage.components;
                    for (let i = 0; i < temp_rs_components.length; i++) {
                        for (let j = 0; j < temp_rs_components[i].components.length; j++) {
                            if (temp_rs_components[i].components[j].customId === 'openvc') {
                                temp_rs_components[i].components[j] = new Discord.ButtonBuilder({ label: '✅ Start Run', style: Discord.ButtonStyle.Success, customId: 'start' });
                            }
                        }
                    }
                    let temp_leader_components = this.leaderEmbedMessage.components;
                    for (let i = 0; i < temp_leader_components.length; i++) {
                        for (let j = 0; j < temp_leader_components[i].components.length; j++) {
                            if (temp_leader_components[i].components[j].customId === 'openvc') {
                                temp_leader_components[i].components[j] = new Discord.ButtonBuilder({ label: '✅ Start Run', style: Discord.ButtonStyle.Success, customId: 'start' });
                            }
                        }
                    }
                    this.raidStatusMessage = await this.raidStatusMessage.edit({ components: temp_rs_components });
                    this.leaderEmbed.data.footer.text = `Channel is opening...`
                    this.leaderEmbedMessage = await this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed], components: temp_leader_components })
                    let tempM = await this.raidStatus.send(`${this.channel} will open in 5 seconds...`);
                    setTimeout(async (afk) => {
                        await afk.channel.permissionOverwrites.edit(afk.verifiedRaiderRole.id, { Connect: true, ViewChannel: true })
                        if (afk.eventBoi) await afk.channel.permissionOverwrites.edit(afk.eventBoi.id, { Connect: true, ViewChannel: true })
                        afk.raidStatusMessage = await afk.raidStatusMessage.edit({ embed: afk.mainEmbed });
                        await tempM.edit(`<#${this.channel.id}> is open!`);
                        this.leaderEmbed.data.footer.text = `Channel is open.`
                        this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] })
                    }, 5000, this)
                    setTimeout(async tempM => { tempM.delete(); }, 20000, tempM);
                    for (let i of this.afkInfo.reacts) try { await this.raidStatusMessage.react(this.bot.storedEmojis[i].id) } catch (error) { ErrorLogger.log(error, this.bot, this.guild) }
                } else {
                    interaction.reply({ ephemeral: true, content: 'You are not a staff member' })
                    interaction.deferUpdate()
                    this.removeFromActiveInteractions(interaction.user.id)
                }
            }
        }
        else for (let i in this.afkInfo.earlyLocationReacts) {
            let react = this.afkInfo.earlyLocationReacts[i]
            if (react.emote == interaction.customId) {
                if (react.requiredRole && !interaction.member.roles.cache.has(this.settings.roles[react.requiredRole])) return interaction.deferUpdate()
                this.confirmSelection(interaction, +i + +1, react.shortName, react.limit, react.noConfirm, react.noLocation)
            }
        }
    }

    async buttonHandler(interaction, limit) {
        if (!interaction.isButton()) return;
        if (interaction.customId == this.afkInfo.keyEmote) {
            this.confirmSelection(interaction, 0, 'key', limit, false, false, true, this.afkInfo.keyCount)
        }
        else if (interaction.customId == this.afkInfo.vialEmote) this.confirmSelection(interaction, 1, 'vial', limit, false, false, true, 3)
        else for (let i in this.afkInfo.earlyLocationReacts) {
            let react = this.afkInfo.earlyLocationReacts[i]
            if (interaction.customId == react.emote) {
                if (react.requiredRole && !interaction.member.roles.cache.has(this.settings.roles[react.requiredRole])) return interaction.deferUpdate()
                this.confirmSelection(interaction, +i + +1, react.shortName, limit, react.noConfirm, react.noLocation, true, react.limit)
            }
        }
    }

    async reactionHandler(r, u) {
        if (r.emoji.name.toLowerCase() == 'knight') this.knights.push(u)
        else if (r.emoji.name.toLowerCase() == 'warrior') this.warriors.push(u)
        else if (r.emoji.name.toLowerCase() == 'paladin') this.pallies.push(u)
    }

    async addButtons() {
        // Arrays to hold emotes
        const actionRows = []
        const reacts = []
        let curRow = []
        function addButton(button) {
            if (curRow.length >= 5) { actionRows.push(curRow); curRow = [] }
            let b = new Discord.ButtonBuilder({ ...button })
            curRow.push(b)
        }

        // Organize reacts into above arrays
        if (this.afkInfo.headcountEmote && this.afkInfo.headcountOnAfk) reacts.push(this.afkInfo.headcountEmote)
        if (this.afkInfo.keyEmote) addButton({ emoji: this.bot.storedEmojis[this.afkInfo.keyEmote].id, label: `0/${this.afkInfo.keyCount}`, style: Discord.ButtonStyle.Primary, customId: this.afkInfo.keyEmote })
        if (this.afkInfo.vialReact) addButton({ emoji: this.bot.storedEmojis[this.afkInfo.vialEmote].id, label: `0/3`, style: Discord.ButtonStyle.Secondary, customId: this.afkInfo.vialEmote })
        if (this.afkInfo.earlyLocationReacts.length > 0) for (let i of this.afkInfo.earlyLocationReacts) addButton({ emoji: this.bot.storedEmojis[i.emote].id, label: `0/${i.limit}`, style: i.buttonStyle ? i.buttonStyle : Discord.ButtonStyle.Secondary, customId: i.emote })
        if (!this.afkInfo.twoPhase) for (let i of this.afkInfo.reacts) reacts.push(i)
        //split row
        if (curRow.length > 0) { actionRows.push(curRow); curRow = [] }
        if (this.settings.backend.supporter) addButton({ emoji: this.bot.storedEmojis['NitroBooster'].id, label: 'Supporter', style: Discord.ButtonStyle.Success, customId: 'supporter' })
        if (this.settings.backend.points) addButton({ label: '🎟️ Use Tickets', style: Discord.ButtonStyle.Secondary, customId: 'points' })
        //split row
        if (curRow.length > 0) { actionRows.push(curRow); curRow = [] }
        if (this.afkInfo.twoPhase) addButton({ label: '✅ Open Channel', style: Discord.ButtonStyle.Success, customId: 'openvc' })
        else addButton({ label: '✅ Start Run', style: Discord.ButtonStyle.Success, customId: 'start' })
        addButton({ label: '❌ Abort Run', style: Discord.ButtonStyle.Danger, customId: 'end' })

        // Add buttons and reacts
        if (curRow.length > 0) actionRows.push(curRow)
        const components = []
        for (let i of actionRows) { let n = new Discord.ActionRowBuilder({ components: i }); components.push(n) }
        await this.raidStatusMessage.edit({ components: components })
        for (let i of reacts) try { await this.raidStatusMessage.react(this.bot.storedEmojis[i].id) } catch (error) { ErrorLogger.log(error, this.bot, this.guild) }
    }

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     * @param {Number} index
     * @param {String} type
     * @param {Number} limit
     */
    async confirmSelection(interaction, index, type, limit, noConfirm = false, noLocation = false, request = false, origLimit = 0) {
        let embed = new Discord.EmbedBuilder({ description: 'placeholder' })
        this.openInteractions.push(interaction.user.id)

        // Prompt
        let emote = this.bot.storedEmojis[interaction.customId].text
        /**
         *
         * @param {afkCheck} afk
         * @param {*} firstCall
         * @returns
         */
        function sendLocation(afk, firstCall = false) {
            //check for full
            if (!checkType(afk)) return
            //set into type

            setType(afk)

            function setType(afk) {
                //key, vial, other
                switch (type.toLowerCase()) {
                    case 'key':
                        afk.keys.push(interaction.user.id)
                        break;
                    case 'vial':
                        afk.vials.push(interaction.user.id)
                        break;
                    default:
                        afk.reactables[type].users.push(interaction.user.id)
                        break;
                }
                afk.earlyLocation.push(interaction.user);
            }

            let current_limit = request ? getLength(afk) - origLimit : getLength(afk)

            // Disable button if react limit is hit
            if (current_limit >= limit) interaction.message.editButton(interaction.component.customId, `${current_limit}/${limit}`, true)
            else interaction.message.editButton(interaction.component.customId, `${current_limit}/${limit}`)

            //allow another interaction
            afk.removeFromActiveInteractions(interaction.user.id)

            //give location
            if (!noLocation) {
                let s = `The location for this run has been set to \`${afk.afkInfo.location}\`, get there ASAP! Join lounge to be moved into the channel.`
                embed.setDescription(s)
                if (firstCall) interaction.reply({ embeds: [embed], ephemeral: true })
                else interaction.editReply({ embeds: [embed], components: [] })
            } else {
                embed.setDescription(`You do not get location for this reaction. Join lounge to be moved into the channel.`)
                if (firstCall) interaction.reply({ embeds: [embed], ephemeral: true })
                else interaction.editReply({ embeds: [embed], components: [] })
            }

            //add to leader embed
            if (!afk.afkInfo.keyEmote) index--;
            if (afk.afkInfo.vialReact && !(type == 'key' || type == 'vial')) index++;
            if (afk.leaderEmbed.data.fields[index].value == `None!`) {
                afk.leaderEmbed.data.fields[index].value = `${emote}: <@!${interaction.user.id}>`;
            } else afk.leaderEmbed.data.fields[index].value += `\n${emote}: ${`<@!${interaction.user.id}>`}`
            afk.leaderEmbedMessage.edit({ embeds: [afk.leaderEmbed] }).catch(er => ErrorLogger.log(er, afk.bot, this.guild));
            afk.runInfoMessage.edit({ embeds: [afk.leaderEmbed] }).catch(er => ErrorLogger.log(er, afk.bot, this.guild));

            //end interval
            if (endAfter) clearInterval(endAfter);
        }
        function checkType(afk) { //true = spot open
            //key, vial, other
            let lenLimit = request ? origLimit + limit : limit
            switch (type) {
                case 'key':
                    if (afk.keys.length >= lenLimit || afk.keys.includes(interaction.member.id)) return false; else return true;
                case 'vial':
                    if (afk.vials.length >= lenLimit || afk.vials.includes(interaction.member.id)) return false; else return true;
                default:
                    if (afk.reactables[type].users.length >= lenLimit || afk.reactables[type].users.includes(interaction.member.id)) return false; else return true;
            }
        }
        function getLength(afk) { //true = spot open
            //key, vial, other
            switch (type) {
                case 'key':
                    return afk.keys.length
                case 'vial':
                    return afk.vials.length
                default:
                    return afk.reactables[type].users.length
            }
        }

        let endAfter = null

        // If confirmation not needed, just send the location
        if (noConfirm) return sendLocation(this, true)

        // Otherwise prompt for confirmation

        // Will end the confirmation automatically after 60s to save resources
        endAfter = setInterval(() => {
            try {
                dmIntereactionCollector.stop();
                embed.setDescription('Reaction took too long to receive, or another vial already confirmed. Re-react to try again')
                interaction.editReply({ embeds: [embed], components: [] })
                clearInterval(endAfter);
                this.removeFromActiveInteractions(interaction.member.id)
                return;
            } catch (er) {
                clearInterval(endAfter);
                return;
            }
        }, 60000)


        try {
            if (!checkType(this)) {
                let current_limit = request ? getLength(this) - origLimit : getLength(this)
                if (current_limit >= limit) interaction.message.editButton(interaction.component.customId, `${current_limit}/${limit}`, true)
                else interaction.message.editButton(interaction.component.customId, `${current_limit}/${limit}`)
                embed.setDescription(`Too many people have already reacted and confirmed for that. Try another react or try again next run.`)
                interaction.reply({ embeds: [embed], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            let reactInfo
            for (let r of this.afkInfo.earlyLocationReacts) {
                if (type == r.shortName) reactInfo = r;
            }

            let emoteName = null
            if (reactInfo && reactInfo.shortName) emoteName = reactInfo.shortName
            if (type == "key") emoteName = 'Key'
            if (type == "vial") emoteName = 'Vial'

            embed.setDescription(
                reactInfo && reactInfo.confirmationMessage ?
                    `You reacted as ${emote} **${emoteName}**\n\n${reactInfo.confirmationMessage}\n\nPress ✅ to confirm your reaction. Otherwise press ❌` :
                    `You reacted as ${emote} **${emoteName}**\nPress ✅ to confirm your reaction. Otherwise press ❌`
            )

            if (reactInfo && reactInfo.confirmationMedia) embed.setImage(reactInfo.confirmationMedia)

            let ar = new Discord.ActionRowBuilder().addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('✅ Confirm')
                    .setStyle(3)
                    .setCustomId('confirm'),
                new Discord.ButtonBuilder()
                    .setLabel('❌ Cancel')
                    .setStyle(4)
                    .setCustomId('abort')
            ])
            await interaction.reply({ embeds: [embed], ephemeral: true, components: [ar] })
            let em = await interaction.fetchReply()
            
            embed.setImage(null)

            //Update Rushers table
            if (reactInfo && reactInfo.requiredRole == 'rusher') {
                let today = new Date()
                this.db.query(`UPDATE rushers SET time = ${today.valueOf()} WHERE id = '${interaction.user.id}' and guildid = '${this.guild.id}'`)
            }

            let dmIntereactionCollector = new Discord.InteractionCollector(this.bot, { message: em, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })

            dmIntereactionCollector.on("collect", async subInteraction => {
                //Stop collector
                dmIntereactionCollector.stop();

                if (subInteraction.customId === 'confirm') {
                    //check type
                    if (!checkType(this)) {
                        clearInterval(endAfter);
                        embed.setDescription('Someone else confirmed before you')
                        this.removeFromActiveInteractions(interaction.user.id)
                        return interaction.editReply({ embeds: [embed], components: [] })
                    }

                    sendLocation(this)
                } else {
                    embed.setDescription('Cancelled. You can dismiss this message')
                    interaction.editReply({ embeds: [embed], components: [] })
                    this.removeFromActiveInteractions(interaction.user.id)
                }
            });

        } catch (er) { console.log(er) }
    }

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     * @param {Number} index
     */
    async useSupporter(interaction, index) {
        let embed = new Discord.EmbedBuilder({ description: 'placeholder' }).setColor(this.afkInfo.embed.color)
        let reactor = interaction.member
        if (this.earlyLocation.includes(interaction.user)) {
            embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }
        if (reactor.roles.highest.position >= this.trialRaidLeader.position) {
            embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.earlyLocation.push(interaction.user);
            this.removeFromActiveInteractions(interaction.user.id)
            return;
        }
        for (let i of this.settings.lists.earlyLocation) { //custom early location roles
            if (reactor.roles.cache.has(i)) {
                embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
                await interaction.reply({ embeds: [embed], ephemeral: true })
                this.earlyLocation.push(interaction.user);
                this.removeFromActiveInteractions(interaction.user.id)
                return
            }
        }
        if (this.supporter.length + 1 > this.settings.numerical.supporterlimit) {
            interaction.message.editButton(interaction.component.customId, null, true)
            embed.setDescription('Too many Supporters have already received location for this run. Try again in the next run!');
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }
        if (!interaction.member.roles.cache.hasAny(...this.perkRoles.map(role => role.id))) {
            embed.setDescription(`You are not eligible for this reaction`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }
        if (reactor.voice.channel && reactor.voice.channel.id == this.channel.id) {
            embed.setDescription(`Supporter benefits in \`${interaction.guild.name}\` only gives guaranteed spot in VC. You are already in the VC so this use hasn\'t been counted`);
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }

        let supporterRole = interaction.member.supporterHierarchy(this.settings)
        if (!supporterRole) {
            embed.setDescription(`You are not eligible for this reaction`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }
        if (this.supporter.length + 1 > this.settings.supporter[`supporterLimit${supporterRole}`]) {
            embed.setDescription(`Too many Supporters have already received location for this run. Try again in the next run!`)
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }
        let cooldown = this.settings.supporter[`supporterCooldownSeconds${supporterRole}`]
        let uses = this.settings.supporter[`supporterUses${supporterRole}`]
        let lastUseCheck = Date.now() - (cooldown * 1000)
        this.db.query(`SELECT * FROM supporterusage WHERE guildid = '${interaction.guild.id}' AND userid = '${interaction.member.id}' AND utime > '${lastUseCheck}'`,
            async (err, rows) => {
            if (err) {
                ErrorLogger.log(err, this.bot, this.guild)
                this.removeFromActiveInteractions(interaction.user.id)
                return
            }
            if (rows.length >= uses) {
                let cooldown_text = ''
                if (cooldown < 3600) cooldown_text = `${(cooldown/60).toFixed(0)} minutes`
                else cooldown_text = `${(cooldown/3600).toFixed(0)} hours`
                embed.setDescription(
                    `Your perks are limited to ${uses} times every ${cooldown_text}. Your next use is available <t:${(((cooldown*1000)+parseInt(rows[0].utime))/1000).toFixed(0)}:R>`
                )
                await interaction.reply({ embeds: [embed], ephemeral: true })
                this.removeFromActiveInteractions(interaction.user.id)
                return
            }
            let moved = true
            await reactor.voice.setChannel(this.channel.id).catch(er => { moved = false })
            if (moved) embed.setDescription('You have been moved into the voice channel. If you get disconnected while the afk check is up, join lounge and you will get moved in automatically.')
            else embed.setDescription('Join the lounge to be moved in to the raiding channel')
            await interaction.reply({ embeds: [embed], ephemeral: true })
            this.supporter.push(interaction.user)
            this.supporterReacts.push(interaction.user.id)
            this.leaderEmbed.data.fields[index].value = '<@!' + this.supporterReacts.join('>,\n<@!') + '>'
            this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild));
            this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild));
            emitter.on('Ended', (channelID, aborted) => {
                if (channelID == this.channel.id) {
                    if (!aborted) this.db.query(`INSERT INTO supporterusage (guildid, userid, utime) VALUES ('${interaction.guild.id}', '${interaction.member.id}', '${Date.now()}')`);
                    else interaction.user.send(`The afk check was aborted, you have been refunded your supporter perk use.`);
                }
            })
        })
    }

    /**
     *
     * @param {Discord.MessageComponentInteraction} interaction
     * @param {Number} index
     */
    async pointsUse(interaction, index) {
        if (!this.settings.backend.points) {
            interaction.deferUpdate()
            return this.removeFromActiveInteractions(interaction.user.id)
        }
        let ticketLimit = this.settings.numerical.ticketlimit
        if (this.pointsUsers.length >= ticketLimit) {
            interaction.message.editButton(interaction.component.customId, null, true)
            return
        }
        let embed = new Discord.EmbedBuilder()
            .setColor(this.afkInfo.embed.color)
            .setFooter({ text: `React with ✅ to confirm, or ❌ to cancel` })
        let ar = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('✅ Confirm')
                .setStyle(3)
                .setCustomId('confirm'),
            new Discord.ButtonBuilder()
                .setLabel('❌ Cancel')
                .setStyle(4)
                .setCustomId('abort')
        ])
        if (interaction.user.avatarURL()) embed.setAuthor({ name: 'Please Confirm Point Usage', iconURL: interaction.user.avatarURL() })
        else embed.setAuthor({ name: 'Please Confirm Point Usage' })
        let earlyLocationCost = this.afkInfo.earlyLocationCost
        this.db.query(`SELECT points FROM users WHERE id = '${interaction.user.id}'`, async (err, rows) => {
            if (err) return
            if (rows.length == 0) return this.db.query(`INSERT INTO users (id) VALUES('${interaction.user.id}')`)
            if (rows[0].points < earlyLocationCost) return
            embed.setDescription(`You currently have \`${rows[0].points}\` points\nEarly location costs \`${earlyLocationCost}\``)
            await interaction.reply({ embeds: [embed], components: [ar], ephemeral: true })
            let m = await interaction.fetchReply()
            let interactionCollector = new Discord.InteractionCollector(this.bot, { message: m, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            interactionCollector.on('collect', async int => {
                if (int.customId == 'abort') {
                    embed.setDescription('Cancelled. You can dismiss this message')
                    if (embed.data.footer) delete embed.data.footer
                    if (embed.data.author) delete embed.data.author
                    interaction.editReply({ embeds: [embed], components: [] })
                    this.removeFromActiveInteractions(interaction.user.id)
                }
                else if (int.customId == 'confirm') {
                    if (this.pointsUsers.length >= ticketLimit) {
                        interaction.message.editButton(interaction.component.customId, null, true)
                        embed.setDescription('Unfortunately too many people have used their points for this run. No points have been deducted.')
                        if (embed.data.footer) delete embed.data.footer
                        if (embed.data.author) delete embed.data.author
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.user.id)
                        return
                    }
                    let er, success = true
                    let leftOver = await points.buyEarlyLocaton(interaction.user, this.db, earlyLocationCost, this.afkInfo, this.bot, this.message.guild).catch(r => { er = r; success = false })
                    if (success) {
                        this.removeFromActiveInteractions(interaction.user.id)
                        embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\`\nYou now have \`${leftOver}\` points left over. Join lounge to be moved into the channel.`)
                        if (embed.data.footer) delete embed.data.footer
                        if (embed.data.author) delete embed.data.author
                        interaction.editReply({ embeds: [embed], components: [] })
                        if (this.leaderEmbed.data.fields[index].value == 'None!') this.leaderEmbed.data.fields[index].value = `<@!${interaction.user.id}>`
                        else this.leaderEmbed.data.fields[index].value += `,\n<@!${interaction.user.id}>`
                        this.pointsUsers.push(interaction.user)
                        this.earlyLocation.push(interaction.user)
                        await this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, bot, this.guild));
                        await this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, bot, this.guild));
                        emitter.on('Ended', (channelID, aborted) => {
                            if (aborted && channelID == this.channel.id) {
                                this.db.query(`UPDATE users SET points = points + ${earlyLocationCost} WHERE id = ${interaction.user.id}`);
                                interaction.user.send(`The afk check was aborted, you have been refunded ${earlyLocationCost} points.`);
                            }
                        })
                    }
                    else {
                        embed.setDescription(`There was an issue using the points: \`${er}\``)
                        if (embed.data.footer) delete embed.data.footer
                        if (embed.data.author) delete embed.data.author
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.user.id)
                    }
                }
            })
        })
    }

    async timerInterval() {
        this.time = this.time - 5;
        if (this.time == 0) {
            this.endedBy = this.bot.user;
            this.postAfk();
            return;
        }
        if (!this.mainEmbed) return;
        this.mainEmbed.setFooter({ text: `Time Remaining: ${Math.floor(this.time / 60)} minutes and ${this.time % 60} seconds` });
        this.raidStatusMessage.edit({ embeds: [this.mainEmbed] })
        if (!this.bot.afkChecks[this.channel.id])
            return clearInterval(this.timerInterval);
        this.bot.afkChecks[this.channel.id].timeLeft = this.time;
        this.bot.afkChecks[this.channel.id].vcSize = this.channel.members.size;
    }

    async updateVCNumber() {
        if (!this.bot.afkChecks[this.channel.id])
            return clearInterval(this.updateVC);
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
        for (let u of this.supporter) {
            let member = this.message.guild.members.cache.get(u.id);
            if (!member.voice.channel) continue;
            if (member.voice.channel.name == 'lounge' || member.voice.channel.name == 'Veteran Lounge' || member.voice.channel.name.includes('drag')) {
                await member.voice.setChannel(this.channel.id).catch(er => { });
            }
        }
    }

    async postAfk() {
        if (!this.afkInfo.postAfkCheck) return this.endAfk();

        //stop main timer
        clearInterval(this.timer);

        //stops panel reaction collector
        this.leaderInteractionCollector.stop();

        //move out people
        if (this.afkChannel) this.channel.members.each(async u => {
            if (!this.raiders.includes(u.id)) {
                let reactor = this.message.guild.members.cache.get(u.id)
                if (reactor.roles.highest.position >= this.leaderOnLeave.position) return;
                await reactor.voice.setChannel(this.afkChannel).catch(er => { })
            }
        });

        //start post afk timer
        this.timer = await setInterval(() => { this.updatePost() }, 5000);

        //lock vc
        this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { Connect: false, ViewChannel: true })
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { Connect: false, ViewChannel: true })

        //Get buttons ready for post afk check
        let ar = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('✅ Start Now')
                .setStyle(3)
                .setCustomId('start'),
            new Discord.ButtonBuilder()
                .setLabel('❌ Cancel Run')
                .setStyle(4)
                .setCustomId('abort')
        ])

        //post afk check embed
        this.mainEmbed.setDescription(`__**Post AFK Move-in**__\nIf you got moved out of vc, or missed the afk check:\n**1.** Join lounge\n**2** Click on ${this.bot.storedEmojis[this.afkInfo.headcountEmote].text} to get moved in.\n__Time Remaining:__ ${this.postTime} seconds.`)
            .setFooter({ text: `The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}` });
        this.raidStatusMessage.edit({ content: null, embeds: [this.mainEmbed], components: [ar] }).catch(er => console.log(er));
        this.postAfkInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.raidStatusMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        this.postAfkInteractionCollector.on('collect', int => {
            if (int.member.roles.highest.position < this.staffRole.position) return int.deferUpdate()
            if (int.customId == 'abort') {
                this.endedBy = int.user
                this.abortAfk()
                int.reply({ content: 'AFK Check aborted', ephemeral: true })
                clearInterval(this.timer)
            } else if (int.customId == 'start') {
                int.deferUpdate()
                this.endAfk()
                clearInterval(this.timer)
            }
            this.postAfkInteractionCollector.stop()
        })
    }
    async updatePost() {
        if (this.ended) return
        this.postTime -= 5;
        if (this.postTime == 0) return this.endAfk();

        this.mainEmbed.setDescription(`__**Post AFK Move-in**__\nIf you got moved out of vc, or missed the afk check:\n**1.** Join lounge\n**2** Click on ${this.bot.storedEmojis[this.afkInfo.headcountEmote].text} to get moved in.\n__Time Remaining:__ ${this.postTime} seconds.`);
        this.raidStatusMessage.edit({ content: null, embeds: [this.mainEmbed] }).catch(er => console.log(er));
    }

    async endAfk() {
        this.ended = true
        //end everything
        if (this.raidStatusInteractionCollector) this.raidStatusInteractionCollector.stop();
        if (this.leaderInteractionCollector) this.leaderInteractionCollector.stop();
        if (this.raidStatusReactionCollector) this.raidStatusReactionCollector.stop();
        if (this.moveInTimer) clearInterval(this.moveInTimer);
        if (this.timer) clearInterval(this.timer);
        if (this.updateVC) clearInterval(this.updateVC)

        //split groups for split runs
        if (this.afkInfo.isSplit) await this.splitLogic();

        //lock channel
        await this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { Connect: false, ViewChannel: true })
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { Connect: false, ViewChannel: true })
        if (this.afkInfo.newChannel && !this.isVet && this.afkChannel) {
            this.channel.setPosition(this.afkChannel.position)
        }
        const rules = `<#${this.settings.channels.raidingrules}>` || '#raiding-rules';
        //update embeds/messages
        this.mainEmbed.setDescription(`This afk check has been ended.\n${this.keys.length > 0 && this.afkInfo.keyEmote ? `Thank you to ${this.keys.map(k => `<@!${k}> `)} for popping a ${this.bot.storedEmojis[this.afkInfo.keyEmote].text} for us!\n` : ''}${this.simp ? `Thank you to <@!${this.simp.id}> for being a ViBot SIMP` : ''}If you get disconnected during the run, **JOIN LOUNGE** *then* press the huge **RECONNECT** button`)
            .setFooter({ text: `The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}` })

        if (this.afkInfo.isAdvanced)
            this.mainEmbed.data.description += `\n\n**__Advanced Runs__**\nThis is an **advanced run**, meaning there are extended requirements you **MUST** meet. You must be both **__8/8__** and follow the requirements sheet listed below.\n\nBasic raiding rules from ${rules} will still apply.\n\nIf you are caught not meeting these requirements, you will be removed from the run and suspended.`

        this.leaderEmbed.setFooter({ text: `The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname} at` })
            .setTimestamp();

        this.raidStatusMessage.edit({ content: null, embeds: [this.mainEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot, this.guild))
            .then(this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot, this.guild)))
            .then(this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild)))
            .then(this.leaderEmbedMessage.reactions.removeAll())

        Channels.addReconnectButton(this.bot, this.raidStatusMessage, this.channel.id);

        //store afk check information
        let earlyLocationIDS = []
        for (let i in this.earlyLocation) earlyLocationIDS.push(this.earlyLocation[i].id)
        let raiders = []
        this.channel.members.forEach(m => raiders.push(m.id))
        this.bot.afkChecks[this.channel.id].keys = []
        this.bot.afkChecks[this.channel.id].earlyLocation = earlyLocationIDS
        this.bot.afkChecks[this.channel.id].raiders = raiders
        this.bot.afkChecks[this.channel.id].active = false
        this.bot.afkChecks[this.channel.id].endedAt = Date.now()
        this.bot.afkChecks[this.channel.id].RSAMessagePacket = { messageId: this.raidStatusMessage.id, channelId: this.raidStatusMessage.channelId };
        if (this.keys.length > 0) for (let u in this.keys) this.bot.afkChecks[this.channel.id].keys.push(u)
        if (this.afkInfo.isSplit) {
            this.bot.afkChecks[this.channel.id].split = true
            this.bot.afkChecks[this.channel.id].mainGroup = this.mainGroup
            this.bot.afkChecks[this.channel.id].mainGroup = this.splitGroup
            this.bot.afkChecks[this.channel.id].splitChannel = 'na'
        }
        fs.writeFileSync('./afkChecks.json', JSON.stringify(this.bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, this.bot, this.guild) })

        //send embed to history
        let history_run_title = "";
        if (this.afkInfo.runLogName == "voidRuns") history_run_title = " Void"
        else if (this.afkInfo.runLogName == "cultRuns") history_run_title = " Cult";
        else if (this.afkInfo.runLogName == "eventruns") history_run_title = " Event";
        let historyEmbed = new Discord.EmbedBuilder()
            .setColor(this.afkInfo.embed.color)
            .setTitle(this.message.member.nickname + history_run_title)
            .addFields([
                { name: 'Leader', value: `${this.message.member}` },
                { name: 'Ended by', value: `${this.endedBy}` },
                { name: 'Key', value: 'None!' },
                { name: 'Early Location', value: 'None!' },
                { name: 'Raiders', value: 'None!' },
                { name: 'Supporter Use', value: 'None!' },
                { name: `Points Users ${this.afkInfo.earlyLocationCost}`, value: 'None!' },
                { name: 'Points Log MID', value: 'None!' }
            ])
        let i = 2
        this.keys.forEach(m => {
            if (historyEmbed.data.fields[i].value == 'None!') historyEmbed.data.fields[i].value = `<@!${m}>`;
            else historyEmbed.data.fields[i].value += `, <@!${m}>`;
        })
        i++
        this.earlyLocation.forEach(m => {
            if (historyEmbed.data.fields[i].value == `None!`) historyEmbed.data.fields[i].value = `<@!${m.id}>`
            else historyEmbed.data.fields[i].value += `, <@!${m.id}>`
        })
        i++
        raiders.forEach(m => {
            if (historyEmbed.data.fields[i].value.length >= 1000) {
                i++
                historyEmbed.spliceFields(i, 0, { name: '-', value: `, <@!${m}>` })
            } else historyEmbed.data.fields[i].value == 'None!' ? historyEmbed.data.fields[i].value = `<@!${m}>` : historyEmbed.data.fields[i].value += `, <@!${m}>`
        });
        i++
        this.supporter.forEach(m => {
            if (historyEmbed.data.fields[i].value == `None!`) historyEmbed.data.fields[i].value = `<@!${m.id}>`
            else historyEmbed.data.fields[i].value += `, <@!${m.id}>`
        });
        i++
        this.pointsUsers.forEach(m => {
            if (historyEmbed.data.fields[i].value == `None!`) historyEmbed.data.fields[i].value = `<@!${m.id}>`
            else historyEmbed.data.fields[i].value += `, <@!${m.id}>`
        })
        i++

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
                    let unlogged = Array.from(this.channel.members.keys()).filter(e => !dbIds.includes(e))
                    for (let i in unlogged) {
                        this.db.query(`INSERT INTO users (id) VALUES('${unlogged[i]}')`, er => { if (er) console.log('error inserting unlogged members in ', this.guild.id) })
                    }
                }
            })
        }

        let pointsLog = []

        if (this.settings.backend.points) {
            //key point logging
            for (let u of this.keys) {
                let points = this.settings.points.keypop
                if (this.afkInfo.keyPopPointsOverride) points = this.afkInfo.keyPopPointsOverride
                if (this.guild.members.cache.get(u).roles.cache.hasAny(...this.perkRoles.map(role => role.id))) points = points * this.settings.points.supportermultiplier
                if (this.moddedKeys) points = points * this.settings.points.keymultiplier
                await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`, er => { if (er) console.log('error logging key points in ', this.guild.id) })
                pointsLog.push({
                    uid: u,
                    points: points,
                    reason: 'Popping Key',
                })
            }
            for (let r in this.reactables) {
                if (this.reactables[r].users) this.reactables[r].users.forEach(u => {
                    let points = +this.reactables[r].points
                    if (this.message.guild.members.cache.get(u).roles.cache.hasAny(...this.perkRoles.map(role => role.id))) points = +points * +this.settings.points.supportermultiplier
                    this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`, er => { if (er) console.log('error logging reactable points in ', this.guild.id) })
                    pointsLog.push({
                        uid: u,
                        points: points,
                        reason: r,
                    })
                })
            }
            var pointlog_mid = await pointLogger.pointLogging(pointsLog, this.message.guild, this.bot, this.mainEmbed);
        }

        if (pointlog_mid) historyEmbed.data.fields[i].value = pointlog_mid;

        historyEmbed.setFooter({ text: `${this.channel.id} • ${this.raidStatusMessage.id} • ${this.leaderEmbedMessage.id} • ${raiders.length} Raiders` })
        this.message.guild.channels.cache.get(this.settings.channels.history).send({ embeds: [historyEmbed] })
        this.message.guild.channels.cache.get(this.settings.channels.runlogs).send({ embeds: [historyEmbed] })

        //log key
        for (let u of this.keys) {
            if (this.afkInfo.keyLogName) this.db.query(`UPDATE users SET ${this.afkInfo.keyLogName} = ${this.afkInfo.keyLogName} + 1 WHERE id = '${u}'`, er => {
                if (er) console.log(`${this.afkInfo.keyLogName} missing from ${this.guild.name} ${this.guild.id}`)
            })
            if (this.moddedKeys) {
                this.db.query(`UPDATE users SET moddedPops = moddedPops + 1 WHERE id = '${u}'`, er => {
                    if (er) console.log(`${this.afkInfo.keyLogName} missing from ${this.guild.name} ${this.guild.id}`)
                })
            }
            keyRoles.checkUser(this.guild.members.cache.get(u), this.bot, this.db)
        }
        let perkRoles = this.perkRoles
        //log run 1 minute after afk check
        if (restart.restarting) log(this)
        else setTimeout(log, 60000, this)
        function log(afkCheck) {
            if (afkCheck.channel && afkCheck.channel.members.size != 0) {
                let query = `UPDATE users SET ${afkCheck.afkInfo.runLogName} = ${afkCheck.afkInfo.runLogName} + 1 WHERE `
                afkCheck.channel.members.each(m => query = query.concat(`id = '${m.id}' OR `))
                query = query.substring(0, query.length - 4)
                afkCheck.db.query(query, er => { if (er) console.log('error logging run completes in ', afkCheck.guild.id) })
                if (afkCheck.settings.backend.points) {
                    //give points to everyone in run
                    let regular = []
                    let supporters = []
                    afkCheck.channel.members.each(m => {
                        if (m.roles.cache.hasAny(...perkRoles.map(role => role.id))) supporters.push(m)
                        else regular.push(m)
                    })
                    //regular raiders point logging
                    if (afkCheck.settings.points.perrun != 0 && regular.length != 0) {
                        let regularQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun} WHERE `
                        regular.forEach(m => { regularQuery = regularQuery.concat(`id = '${m.id}' OR `) })
                        regularQuery = regularQuery.substring(0, regularQuery.length - 4)
                        afkCheck.db.query(regularQuery, er => { if (er) console.log('error logging points for run completes in ', afkCheck.guild.id) })
                    }
                    if (afkCheck.settings.points.perrun != 0 && supporters.length != 0) {
                        //supporter raiders point logging
                        let supporterQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun * afkCheck.settings.points.supportermultiplier} WHERE `;
                        supporters.forEach(m => supporterQuery = supporterQuery.concat(`id = '${m.id}' OR `));
                        supporterQuery = supporterQuery.substring(0, supporterQuery.length - 4);
                        afkCheck.db.query(supporterQuery, er => { if (er) console.log('error logging points for run (supporter) completes in ', afkCheck.guild.id) })
                    }
                }
            }
        }

        //mark afk check as over
        setTimeout(() => { emitter.emit('Ended', this.channel.id, false) }, 2000);
        this.active = false;
    }

    async abortAfk(aborted_by_vibotChannels_name) {
        this.ended = true
        if (this.raidStatusInteractionCollector) this.raidStatusInteractionCollector.stop();
        if (this.leaderInteractionCollector) this.leaderInteractionCollector.stop();
        if (this.raidStatusReactionCollector) this.raidStatusReactionCollector.stop();
        if (this.moveInTimer) clearInterval(this.moveInTimer);
        if (this.timer) clearInterval(this.timer);
        if (this.updateVC) clearInterval(this.updateVC)

        await this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { Connect: false, ViewChannel: false })
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { Connect: false, ViewChannel: false })
        if (this.afkInfo.newChannel && !this.isVet && this.afkChannel) {
            this.channel.setPosition(this.afkChannel.position)
        }
        this.mainEmbed.setImage(null);
        if (!aborted_by_vibotChannels_name) {
            this.mainEmbed.setDescription(`This afk check has been aborted`)
                .setFooter({ text: `The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}` })
            this.leaderEmbed.setFooter({ text: `The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname} at` })
                .setTimestamp();
        } else {
            this.mainEmbed.setDescription(`This afk check has been aborted`)
                .setFooter({ text: `The afk check has been aborted by ${this.message.guild.members.cache.get(aborted_by_vibotChannels_name.id).nickname}` })
            this.leaderEmbed.setFooter({ text: `The afk check was aborted because the channel was closed by ${this.message.guild.members.cache.get(aborted_by_vibotChannels_name.id).nickname} at` })
                .setTimestamp();
        }
        this.raidStatusMessage.reactions.removeAll();

        this.raidStatusMessage.edit({ content: null, embeds: [this.mainEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot, this.guild))
        this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot, this.guild))
        this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild))

        let earlyLocationIDS = []
        for (let i in this.earlyLocation) earlyLocationIDS.push(this.earlyLocation[i].id)
        let raiders = []
        this.channel.members.forEach(m => raiders.push(m.id))
        this.bot.afkChecks[this.channel.id] = {
            isVet: this.isVet,
            leader: this.message.author.id,
            earlyLocation: earlyLocationIDS,
            raiders: raiders,
            time: Date.now(),
            runType: this.run
        }
        this.bot.afkChecks[this.channel.id].active = false
        if (this.keys.length > 0)
            fs.writeFileSync('./afkChecks.json', JSON.stringify(this.bot.afkChecks, null, 4), err => {
                if (err) ErrorLogger.log(err, this.bot, this.guild)
            })


        emitter.emit('Ended', this.channel.id, true)
        this.active = false;

    }

    removeFromActiveInteractions(id) {
        let ind = this.openInteractions.indexOf(id)
        if (ind > -1) this.openInteractions.splice(ind)
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
        let groupEmbed = new Discord.EmbedBuilder()
            .setAuthor({ name: `Split Groups for ${this.channel.name}` })
            .addFields([
                { name: 'Main', value: 'None!' },
                { name: 'Split', value: 'None!' }
            ])
        if (this.message.author.avatarURL()) groupEmbed.data.author.iconURL = this.message.author.avatarURL()
        for (let i in this.mainGroup) {
            let member = this.message.guild.members.cache.get(this.mainGroup[i])
            let nick
            if (!member) nick = `<@!${this.mainGroup[i]}>`
            else nick = member.nickname
            if (groupEmbed.data.fields[0].value == 'None!') groupEmbed.data.fields[0].value = `${nick}`
            else groupEmbed.data.fields[0].value += `\n${nick}`
        }
        for (let i in this.splitGroup) {
            let member = this.message.guild.members.cache.get(this.splitGroup[i])
            let nick
            if (!member) nick = `<@!${this.splitGroup[i]}>`
            else nick = member.nickname
            if (groupEmbed.data.fields[1].value == 'None!') groupEmbed.data.fields[1].value = `${nick}`
            else groupEmbed.data.fields[1].value += `\n${nick}`
        }
        this.raidStatus.send({ embeds: [groupEmbed] })
    }

    async changeLocation(location) {
        this.afkInfo.location = location;

        if (!this.leaderEmbed) return
        this.leaderEmbed.setDescription(`**Raid Leader: ${this.message.member} \`\`${this.message.member.nickname}\`\`\nVC: ${this.channel}\nLocation:** \`\`${this.afkInfo.location}\`\``)
        this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild));
        this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot, this.guild));
        if (this.partneredMessageSent && this.partneredMessage) {
            this.partneredMessage.edit(`${this.partneredPings},  **${this.afkInfo.runName}** is starting inside of **${this.message.guild.name}** in ${this.channel} at \`\`${this.afkInfo.location}\`\``)
        }

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
        let parent, template, raider, vibotChannels, eventBoi;
        //channel creation
        if (runInfo.isVet) {
            parent = settings.categories.veteran;
            template = message.guild.channels.cache.get(settings.voice.vettemplate)
            raider = message.guild.roles.cache.get(settings.roles.vetraider)
            vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
        } else if (runInfo.isEvent) {
            if (runInfo.isExalt && settings.backend.exaltsInRSA) {
                parent = settings.categories.raiding;
                template = message.guild.channels.cache.get(settings.voice.eventtemplate)
                raider = message.guild.roles.cache.get(settings.roles.raider)
                vibotChannels = message.guild.channels.cache.get(settings.channels.raidingchannels)
            } else {
                parent = settings.categories.event;
                template = message.guild.channels.cache.get(settings.voice.eventtemplate)
                raider = message.guild.roles.cache.get(settings.roles.raider)
                eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
                vibotChannels = message.guild.channels.cache.get(settings.channels.eventchannels)
            }
        } else {
            parent = settings.categories.raiding;
            template = message.guild.channels.cache.get(settings.voice.raidingtemplate)
            raider = message.guild.roles.cache.get(settings.roles.raider)
            vibotChannels = message.guild.channels.cache.get(settings.channels.raidingchannels)
        }
        if (!template) return rej(`Template channel not found`)
        let raidLeaderDisplayName = message.member.displayName.replace(/[^a-z|]/gi, '').split('|')[0]
        let channel = await template.clone({
            name: getBannedName(raidLeaderDisplayName, message.guild.id) ? `${raidLeaderDisplayName[0]}'s ${runInfo.runType}` : `${raidLeaderDisplayName}'s ${runInfo.runType}`,
            parent: message.guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === parent).id,
            userLimit: runInfo.vcCap
        }).then(c => c.setPosition(0))

        await message.member.voice.setChannel(channel).catch(er => { })
        //allows raiders to view
        channel.permissionOverwrites.edit(raider.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild))
        channel.permissionOverwrites.edit(runInfo.raidLeader, { Connect: true, ViewChannel: true, Speak: true }).catch(er => ErrorLogger.log(er, bot, message.guild))
        if (eventBoi) channel.permissionOverwrites.edit(eventBoi.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild))

        //Embed to remove
        let embed = new Discord.EmbedBuilder()
            .setDescription(`Whenever the run is over. Click the button to delete the channel. View the timestamp for more information\nLocation: \`${runInfo.location}\``)
            .setFooter({ text: `${channel.id}` })
            .setTimestamp()
            .setTitle(channel.name)
            .setColor(runInfo.embed.color)
        setTimeout(async () => {
            let m = await vibotChannels.send({ content: `${message.member}`, embeds: [embed] });
            await Channels.addCloseChannelButtons(bot, m);
        }, 12000);
        if (!channel) rej('No channel was made')
        res(channel);
    })
}

function getBannedName(name, guildid) {
    let n = new Set(bannedNames[guildid])
    if (n.has(name.toLowerCase())) return true
    return false
}

function getRunType(char, guildid) {
    for (let i in afkTemplates[guildid]) {
        if (char.toLowerCase() == afkTemplates[guildid][i].symbol) return afkTemplates[guildid][i];
        if (afkTemplates[guildid][i].aliases) {
            if (afkTemplates[guildid][i].aliases.includes(char.toLowerCase())) return afkTemplates[guildid][i];
        }
    }
    return null
}

async function getTemplate(message, afkTemplates, runType) {
    if (afkTemplates[message.author.id] && afkTemplates[message.author.id][runType.toLowerCase()]) return afkTemplates[message.author.id][runType.toLowerCase()]
    else return null
}

async function destroyInactiveRuns() {
    for (let i of runs) {
        if (!i.afk.active) {
            delete i.afk;
        }
    }
    runs = runs.filter((v, i, r) => v.afk)
}

function requestButtonHandler(interaction, channelId, limit) {
    for (let i of runs) {
        if (i.channel == channelId) {
            i.afk.buttonHandler(interaction, limit)
            return
        }
    }
}