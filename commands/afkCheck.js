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
var emitter = new EventEmitter()

var runs = [] //{channel: id, afk: afk instance}

module.exports = {
    name: 'afk',
    // alias: ['nafk'],
    description: 'The new version of the afk check',
    requiredArgs: 1,
    args: '<run symbol> (key count) <location>',
    role: 'almostrl',
    getNotes(guildid, member) {
        return `${afkTemplates[guildid] ? Object.keys(afkTemplates[guildid]).map(afk => `\`${afkTemplates[guildid][afk].symbol}\``).join(', ') : 'None for guild'}${afkTemplates[member.id] ? `, ${Object.keys(afkTemplates[member.id]).map(afk => `\`${afkTemplates[member.id][afk].symbol}\``).join(', ')}` : ''}`
    },
    emitter,
    getRunType,
    requestReactionHandler,
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
        //clear out runs array
        destroyInactiveRuns();
        let shift = args.shift();
        let symbol = shift.charAt(0).toLowerCase();
        let isAdvanced = false;
        if (symbol == 'a') {
            symbol += shift.charAt(1).toLowerCase();
            isAdvanced = true;
        }
        //Check Run Type
        let runType = getRunType(symbol, message.guild.id);
        if (isAdvanced && !bot.settings[message.guild.id].backend.allowAdvancedRuns) return
        if (!runType && message.member.roles.highest.position < message.guild.roles.cache.get(bot.settings[message.guild.id].roles.vetrl).position) return message.channel.send('Run Type Not Recognized')
        if (!runType) runType = await getTemplate(message, afkTemplates, shift).catch(er => message.channel.send(`Unable to get template. Error: \`${er}\``))
        if (!runType) return

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
            else this.raidStatus = this.guild.channels.cache.get(this.settings.channels.raidstatus)
            if (this.afkInfo.isVet) this.commandChannel = this.guild.channels.cache.get(this.settings.channels.vetcommands)
            else this.commandChannel = this.guild.channels.cache.get(this.settings.channels.raidcommands)
            if (this.afkInfo.isVet) this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.vetraider)
            else this.verifiedRaiderRole = this.guild.roles.cache.get(this.settings.roles.raider)
            this.staffRole = guild.roles.cache.get(this.afkInfo.isEvent ? this.settings.roles.eventrl : this.settings.roles.almostrl)
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
        this.openInteractions = []
        this.raiders = []
        this.pointsUsers = []
        this.supporters = []
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
            const avsan = /^[aeiou]/i.test(this.afkInfo.runName) ? 'An' : 'A';

            let embed = new Discord.MessageEmbed()
                .setColor(this.afkInfo.embed.color)
                .setDescription(`${avsan} \`${this.afkInfo.runName}\`${flag ? `in (${flag})` : ''} will begin in ${Math.round(this.afkInfo.startDelay / 1000)} seconds. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : `Be prepared to join \`${this.channel.name}\``}`)
            if (this.afkInfo.embed.thumbnail) embed.setThumbnail(this.afkInfo.embed.thumbnail)
            this.raidStatusMessage = await this.raidStatus.send({
                content: `${this.settings.roles[this.afkInfo.pingRole] ? `<@&${this.settings.roles[this.afkInfo.pingRole]}> @here` : `@here`}, ${this.afkInfo.runName}${flag ? ` (${flag})` : ''}. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : ''}`,
                embeds: [embed]
            })
        } else {
            this.raidStatusMessage = await this.raidStatus.send(`${this.settings.roles[this.afkInfo.pingRole] ? `<@&${this.settings.roles[this.afkInfo.pingRole]}> @here` : `@here`}, \`${this.afkInfo.runName}\`${flag ? ` (${flag})` : ''} is beginning now. ${this.afkInfo.twoPhase ? `Only reactables will be moved in at first. After everything is confirmed, the channel will open up.` : `Please join ${this.channel.name}`}`)
            this.start()
        }
    }

    async start() {
        //create/send leader embed
        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor(this.afkInfo.embed.color || "#fefefe")
            .setTitle(`${this.message.member.nickname}'s ${this.afkInfo.runName}`)
            .addField('Our current keys', 'None!')
            .setFooter(`Click ❌ to abort${this.afkInfo.twoPhase ? ', Click ✅ to open the channel' : ''}`)
        if (this.afkInfo.vialReact) this.leaderEmbed.addField('Our current vials', 'None!')
        this.afkInfo.earlyLocationReacts.forEach(r => this.leaderEmbed.addField(`Our current ${r.shortName}`, 'None!'))
        this.leaderEmbed.addField('Location', this.afkInfo.location)
            .addField('Other Early Location', 'None!')
            .addField('Nitro', 'None!')
        let lar = new Discord.MessageActionRow({
            components: [{
                type: 'BUTTON',
                label: '❌ Abort',
                style: 'DANGER',
                customId: 'abort'
            }]
        })
        if (this.afkInfo.twoPhase) lar.addComponents({
            type: 'BUTTON',
            label: '✅ Open Channel',
            style: 'SUCCESS',
            customId: 'openvc'
        })
        this.leaderEmbedMessage = await this.commandChannel.send({ embeds: [this.leaderEmbed], components: [lar] })
        this.runInfoMessage = await this.runInfoChannel.send({ embeds: [this.leaderEmbed] })

        //add interaction collectors
        this.leaderInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.leaderEmbedMessage, interactionType: 'MESSAGE_COMPONENT', componentType: 'BUTTON' })
        this.leaderInteractionCollector.on('collect', (interaction) => this.leaderInteractionHandler(interaction))

        const avsan = /^[aeiou]/i.test(this.afkInfo.runName) ? 'An' : 'A';

        //send messages
        this.mainEmbed = new Discord.MessageEmbed(this.afkInfo.embed);
        this.mainEmbed.setAuthor(`${avsan} ${this.afkInfo.runName} Has Been Started in ${this.channel.name}`)
            .setColor(this.afkInfo.embed.color)
            .setFooter(`Time Remaining: ${Math.floor(this.time / 60)} minutes and ${this.time % 60} seconds`)
            .setTimestamp(Date.now())
        if (this.message.author.avatarURL()) this.mainEmbed.author.iconURL = this.message.author.avatarURL()
        if (this.afkInfo.reqsImageUrl) this.mainEmbed.setImage(this.afkInfo.reqsImageUrl)
        else if (this.afkInfo.isAdvanced && !this.afkInfo.isExalt && this.settings.strings.hallsAdvancedReqsImage) this.mainEmbed.setImage(this.settings.strings.hallsAdvancedReqsImage);
        else if (this.afkInfo.isAdvanced && this.afkInfo.isExalt && this.settings.strings.exaltsAdvancedReqsImage) this.mainEmbed.setImage(this.settings.strings.exaltsAdvancedReqsImage);
        if (this.afkInfo.embed.thumbnail && !this.afkInfo.embed.removeThumbnail) this.mainEmbed.setThumbnail(this.afkInfo.embed.thumbnail)
        this.mainEmbed.description = this.mainEmbed.description.replace('{voicechannel}', `${this.channel}`)
        const rules = `<#${this.settings.channels.raidingrules}>` || '#raiding-rules';

        if (this.afkInfo.isAdvanced)
            this.mainEmbed.description += `\n\n**__Advanced Runs__**\nThis is an **advanced run**, meaning there are extended requirements you **MUST** meet. You must be both **__8/8__** and follow the requirements sheet listed below.\n\nBasic raiding rules from ${rules} will still apply.\n\nIf you are caught not meeting these requirements, you will be removed from the run and suspended.`

        this.raidStatusMessage.edit({ embeds: [this.mainEmbed] })
        if (this.bot.afkChecks[this.channel.id])
            this.bot.afkChecks[this.channel.id].url = this.raidStatusMessage.url

        //unlock channel
        if (!this.afkInfo.twoPhase) {
            this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })
            if (this.eventBoi) this.channel.permissionOverwrites.edit(this.eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true })
        }

        //create reaction collector
        this.raidStatusInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.raidStatusMessage, interactionType: 'MESSAGE_COMPONENT', componentType: 'BUTTON' })
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
        if (this.openInteractions.includes(interaction.user.id)) { console.log(`${interaction.member.nickname} tried to open another interaction while one was pending`); return interaction.deferUpdate() }
        if (interaction.customId == this.afkInfo.keyEmoteID) {
            this.confirmSelection(interaction, 0, 'key', this.afkInfo.keyCount)
        }
        else if (this.afkInfo.vialReact && interaction.customId == this.afkInfo.vialEmoteID) this.confirmSelection(interaction, 1, 'vial', 3)
        else if (interaction.customId === 'nitro') return this.useNitro(interaction, this.leaderEmbed.fields.length - 1)
        else if (interaction.customId === 'supporter') return this.supporterUse(interaction, this.leaderEmbed.fields.length - 2)
        else if (interaction.customId === 'points') return this.pointsUse(interaction, this.leaderEmbed.fields.length - 2)
        else if (interaction.customId === 'start') {
            if (this.guild.members.cache.get(interaction.user.id).roles.highest.position >= this.staffRole.position) {
                this.endedBy = interaction.user;
                interaction.deferUpdate()
                return this.postAfk()
            }
        }
        else if (interaction.customId === 'end') {
            if (this.guild.members.cache.get(interaction.user.id).roles.highest.position >= this.staffRole.position) {
                this.endedBy = interaction.user;
                interaction.deferUpdate()
                return this.abortAfk()
            }
        }
        else if (interaction.customId === 'openvc') {
            if (this.afkInfo.twoPhase) {
                if (this.guild.members.cache.get(interaction.user.id).roles.highest.position >= this.staffRole.position) {
                    interaction.reply({ content: 'Channel will open shortly...', ephemeral: true })
                    this.leaderEmbed.footer.text = `React with ❌ to abort, Channel is opening...`
                    this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] })
                    let tempM = await this.raidStatus.send(`<#${this.channel.id}> will open in 5 seconds...`)
                    setTimeout(async (afk) => {
                        await tempM.edit(`${afk.channel.name} is open!`)
                        await afk.channel.permissionOverwrites.edit(afk.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })
                        if (afk.eventBoi) await afk.channel.permissionOverwrites.edit(afk.eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true })
                    }, 5000, this)
                    setTimeout(async tempM => { tempM.delete() }, 20000, tempM)
                    for (let i of this.afkInfo.reacts) await this.raidStatusMessage.react(i)
                } else {
                    interaction.deferUpdate()
                    this.removeFromActiveInteractions(interaction.user.id)
                }
            }
        }
        else for (let i in this.afkInfo.earlyLocationReacts) {
            let react = this.afkInfo.earlyLocationReacts[i]
            if (react.emoteID == interaction.customId) {
                if (react.requiredRole && !interaction.member.roles.cache.has(this.settings.roles[react.requiredRole])) { console.log(`${interaction.member.nickname} tried to react but was missing the role`); return interaction.deferUpdate() }
                this.confirmSelection(interaction, +i + +1, react.shortName, react.limit, react.noConfirm, react.noLocation)
            }
        }
    }

    async reactionHandler(r, u) {
        if (r.emoji.name.toLowerCase() == 'knight') this.knights.push(u)
        else if (r.emoji.name.toLowerCase() == 'warrior') this.warriors.push(u)
        else if (r.emoji.name.toLowerCase() == 'paladin') this.pallies.push(u)
    }

    /**
     * 
     * @param {Discord.MessageComponentInteraction} interaction 
     */
    async leaderInteractionHandler(interaction) {
        if (!interaction.isButton()) { console.log(`${interaction.member.nickname} had a non button iteraction`); return interaction.deferUpdate() }
        if (interaction.customId === 'abort') {
            this.endedBy = interaction.user;
            interaction.deferUpdate()
            this.abortAfk()
        } else if (interaction.customId === 'openvc') {
            if (this.afkInfo.twoPhase) {
                interaction.reply({ content: 'Channel will open shortly...', ephemeral: true })
                this.leaderEmbed.footer.text = `React with ❌ to abort, Channel is opening...`
                this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] })
                let tempM = await this.raidStatus.send(`<#${this.channel.id}> will open in 5 seconds...`)
                setTimeout(async (afk) => {
                    await tempM.edit(`${afk.channel.name} is open!`)
                    await afk.channel.permissionOverwrites.edit(afk.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })
                    if (afk.eventBoi) await afk.channel.permissionOverwrites.edit(afk.eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true })
                }, 5000, this)
                setTimeout(async tempM => { tempM.delete() }, 20000, tempM)
                for (let i of this.afkInfo.reacts) await this.raidStatusMessage.react(i)
            }
        }
    }

    async addButtons() {
        // Arrays to hold emotes
        const actionRows = []
        const reacts = []
        let curRow = []
        function addButton(button) {
            if (curRow.length >= 5) { actionRows.push(curRow); curRow = [] }
            let b = new Discord.MessageButton({ ...button })
            curRow.push(b)
        }

        // Organize reacts into above arrays
        if (this.afkInfo.headcountEmote && this.afkInfo.headcountOnAfk) reacts.push(this.afkInfo.headcountEmote)
        addButton({ emoji: this.afkInfo.keyEmoteID, style: 'PRIMARY', customId: this.afkInfo.keyEmoteID })
        if (this.afkInfo.vialReact) addButton({ emoji: this.afkInfo.vialEmoteID, style: 'SECONDARY', customId: this.afkInfo.vialEmoteID })
        for (let i of this.afkInfo.earlyLocationReacts) addButton({ emoji: i.emoteID, style: 'SECONDARY', customId: i.emoteID })
        if (!this.afkInfo.twoPhase) for (let i of this.afkInfo.reacts) reacts.push(i)
        //split row
        actionRows.push(curRow); curRow = []
        addButton({ emoji: '701491230349066261', style: 'SECONDARY', label: 'Nitro', customId: 'nitro' })
        if (this.settings.backend.supporter) addButton({ emoji: '752368122551337061', label: 'ViBot Supporter', style: 'SUCCESS', customId: 'supporter' })
        if (this.settings.backend.points) addButton({ label: '🎟️ Use Tickets', style: 'SECONDARY', customId: 'points' })
        //split row
        actionRows.push(curRow); curRow = []
        addButton({ label: '✅ Start Run', style: 'SUCCESS', customId: 'start' })
        addButton({ label: '❌ Abort Run', style: 'DANGER', customId: 'end' })
        if (this.afkInfo.twoPhase) addButton({ label: '✅ Open Channel', style: 'SUCCESS', customId: 'openvc' })

        // Add buttons and reacts
        if (curRow.length > 0) actionRows.push(curRow)
        const components = []
        for (let i of actionRows) { let n = new Discord.MessageActionRow({ components: i }); components.push(n) }
        await this.raidStatusMessage.edit({ components: components })
        for (let i of reacts) await this.raidStatusMessage.react(i)
    }

    /**
     * 
     * @param {Discord.MessageComponentInteraction} interaction 
     * @param {Number} index 
     * @param {String} type 
     * @param {Number} limit
     */
    async confirmSelection(interaction, index, type, limit, noConfirm = false, noLocation = false) {
        let embed = new Discord.MessageEmbed({ color: this.mainEmbed.hexColor, description: 'placeholder' })
        this.openInteractions.push(interaction.user.id)

        // Prompt
        let id = interaction.customId
        let emote = this.bot.emojis.cache.get(id)
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

            //allow another interaction
            afk.removeFromActiveInteractions(interaction.user.id)

            //give location
            if (!noLocation) {
                let s = `The location for this run has been set to \`${afk.afkInfo.location}\`, get there ASAP! Join lounge to be moved into the channel.`
                embed.setDescription(s)
                if (firstCall) interaction.reply({ embeds: [embed], ephemeral: true })
                else interaction.editReply({ embeds: [embed], components: [] })
            } else {
                embed.setDescription(`You are confirmed to be the puzzle solver :)`)
                if (firstCall) interaction.reply({ embeds: [embed], ephemeral: true })
                else interaction.editReply({ embeds: [embed], components: [] })
            }

            //add to leader embed
            if (afk.afkInfo.vialReact && !(type == 'key' || type == 'vial')) index++;
            if (afk.leaderEmbed.fields[index].value == `None!`) {
                afk.leaderEmbed.fields[index].value = `${emote}: <@!${interaction.user.id}>`;
            } else afk.leaderEmbed.fields[index].value += `\n${emote}: ${`<@!${interaction.user.id}>`}`
            afk.leaderEmbedMessage.edit({ embeds: [afk.leaderEmbed] }).catch(er => ErrorLogger.log(er, afk.bot));
            afk.runInfoMessage.edit({ embeds: [afk.leaderEmbed] }).catch(er => ErrorLogger.log(er, afk.bot));

            //end interval
            if (endAfter) clearInterval(endAfter);
        }
        function checkType(afk) { //true = spot open
            //key, vial, other
            switch (type) {
                case 'key':
                    if (afk.keys.length >= limit || afk.keys.includes(interaction.member.id)) return false; else return true;
                case 'vial':
                    if (afk.vials.length >= limit || afk.vials.includes(interaction.member.id)) return false; else return true;
                default:
                    if (afk.reactables[type].users.length >= limit || afk.reactables[type].users.includes(interaction.member.id)) return false; else return true;
            }
        }

        // If confirmation not needed, just send the location
        if (noConfirm) return sendLocation(this, true)

        // Otherwise prompt for confirmation

        // Will end the confirmation automatically after 60s to save resources
        let endAfter = setInterval(() => {
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
                embed.setDescription(`Too many people have already reacted and confirmed for that. Try another react or try again next run.`)
                interaction.reply({ embeds: [embed], ephemeral: true })
                return this.removeFromActiveInteractions(interaction.member.id)
            }
            let reactInfo
            for (let r of this.afkInfo.earlyLocationReacts) {
                if (type == r.shortName) reactInfo = r;
            }

            embed.setDescription(`You reacted as ${emote}\n${(reactInfo && reactInfo.checkRealmEye) ? `If you have a(n) ${reactInfo.checkRealmEye.class} that is ${reactInfo.checkRealmEye.ofEight || 8}/8${reactInfo.checkRealmEye.orb ? ` and has a tier ${reactInfo.checkRealmEye.orb} orb` : ''}${reactInfo.checkRealmEye.mheal ? ` and a pet with at least ${reactInfo.checkRealmEye.mheal} mheal` : ``}` : ''}\nPress ✅ to confirm your reaction. Otherwise press ❌`)
            let ar = new Discord.MessageActionRow({ components: [{ type: 'BUTTON', customId: 'confirm', style: 'SUCCESS', label: '✅ Confirm' }, { type: 'BUTTON', customId: 'abort', style: 'DANGER', label: '❌ Cancel' }] })
            await interaction.reply({ embeds: [embed], ephemeral: true, components: [ar] })
            let em = await interaction.fetchReply()

            let dmIntereactionCollector = new Discord.InteractionCollector(this.bot, { message: em, interactionType: 'MESSAGE_COMPONENT', componentType: 'BUTTON' })

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

                    //check realmeye if applicable
                    if (reactInfo && reactInfo.checkRealmEye) {
                        let found = false;
                        let characters = await realmEyeScrape.getUserInfo(this.message.guild.members.cache.get(interaction.user.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]).catch(er => found = true)
                        if (characters.characters) characters.characters.forEach(c => {
                            if (!found && (c.class == 'Mystic' && c.stats == '8/8')) {
                                found = true;
                            }
                        })
                        if (!found) {
                            embed.setDescription(`I could not find any 8/8 mystics under \`${this.message.guild.members.cache.get(interaction.user.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]}\`. React with :white_check_mark: if you do have an 8/8 mystic on another account`)
                            interaction.editReply({ embeds: [embed] })
                            let subInteractionCollector = new Discord.InteractionCollector(this.bot, { message: em, interactionType: 'MESSAGE_COMPONENT', componentType: 'BUTTON' })
                            subInteractionCollector.on('collect', subSubInteraction => {
                                if (subSubInteraction.customId == 'confirm') sendLocation(this)
                            })
                        } else sendLocation(this)
                    } else sendLocation(this)
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
    async useNitro(interaction, index) {
        let embed = new Discord.MessageEmbed({ color: this.mainEmbed.hexColor, description: 'placeholder' })
        let reactor = interaction.member
        if (this.earlyLocation.includes(interaction.user)) {
            embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
            interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return;
        }
        if (reactor.roles.highest.position >= this.leaderOnLeave.position) {
            embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
            interaction.reply({ embeds: [embed], ephemeral: true })
            this.earlyLocation.push(interaction.user);
            this.removeFromActiveInteractions(interaction.user.id)
            return;
        }
        for (let i of this.settings.lists.earlyLocation) { //custom early location roles
            if (reactor.roles.cache.has(i)) {
                embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
                interaction.reply({ embeds: [embed], ephemeral: true })
                this.earlyLocation.push(interaction.user);
                this.removeFromActiveInteractions(interaction.user.id)
                return
            }
        }
        if (this.nitro.length + 1 > this.settings.numerical.nitrocount) {
            embed.setDescription('Too many Nitro Boosters have already received location for this run. Try again in the next run!');
            interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }
        if (reactor.roles.cache.has(this.nitroBooster.id)) {
            if (reactor.voice.channel && reactor.voice.channel.id == this.channel.id) {
                embed.setDescription(`Nitro benefits in \`${this.message.guild.name}\` only gives garunteed spot in VC. You are already in the VC so this use hasn\'t been counted`);
                interaction.reply({ embeds: [embed], ephemeral: true })
                this.removeFromActiveInteractions(interaction.user.id)
            } else {
                await this.db.query(`SELECT * FROM users WHERE id = '${interaction.user.id}'`, async (err, rows) => {
                    if (err) ErrorLogger.log(err, bot)
                    this.removeFromActiveInteractions(interaction.user.id)
                    if (rows.length == 0) return await this.db.query(`INSERT INTO users (id) VALUES('${interaction.user.id}')`)
                    if (Date.now() - this.settings.numerical.nitrocooldown > parseInt(rows[0].lastnitrouse)) {
                        if (this.settings.backend.nitroearlylocation) {
                            embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
                            interaction.reply({ embeds: [embed], ephemeral: true })
                            this.earlyLocation.push(interaction.user);
                        }
                        let moved = true
                        await reactor.voice.setChannel(this.channel.id).catch(er => { moved = false })
                        if (!this.settings.backend.nitroearlylocation) {
                            if (moved) embed.setDescription('You have been moved into the voice channel. If you get disconnected while the afk check is up, join lounge and you will get moved in automatically.')
                            else embed.setDescription('Join the lounge to be moved in to the raiding channel')
                            interaction.reply({ embeds: [embed], ephemeral: true })
                        }
                        this.nitro.push(interaction.user)
                        if (this.leaderEmbed.fields[index].value == `None!`) this.leaderEmbed.fields[index].value = `<@!${interaction.user.id}> `;
                        else this.leaderEmbed.fields[index].value += `, <@!${interaction.user.id}>`
                        this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot));
                        this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot));
                        emitter.on('Ended', (channelID, aborted) => {
                            if (channelID == this.channel.id) {
                                if (!aborted) this.db.query(`UPDATE users SET lastnitrouse = '${Date.now()}' WHERE id = ${interaction.user.id}`)
                            }
                        })
                    } else {
                        let lastUse = Math.round((Date.now() - rows[0].lastnitrouse) / 60000)
                        embed.setDescription(`Nitro perks are limited to once an hour. Your last use was \`${lastUse}\` minutes ago`)
                        interaction.reply({ embeds: [embed], ephemeral: true })
                        this.removeFromActiveInteractions(interaction.user.id)
                    }
                })
            }
        }
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
        if (this.pointsUsers.length >= ticketLimit) return;
        let embed = new Discord.MessageEmbed()
            .setColor(this.mainEmbed.hexColor)
            .setFooter(`React with ✅ to confirm, or ❌ to cancel`)
        let ar = new Discord.MessageActionRow({ components: [{ type: 'BUTTON', customId: 'confirm', style: 'SUCCESS', label: '✅ Confirm' }, { type: 'BUTTON', customId: 'abort', style: 'DANGER', label: '❌ Cancel' }] })
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
            let interactionCollector = new Discord.InteractionCollector(this.bot, { message: m, interactionType: 'MESSAGE_COMPONENT', componentType: 'BUTTON' })
            interactionCollector.on('collect', async int => {
                if (int.customId == 'abort') {
                    embed.setDescription('Cancelled. You can dismiss this message')
                    if (embed.footer) delete embed.footer
                    if (embed.author) delete embed.author
                    interaction.editReply({ embeds: [embed], components: [] })
                    this.removeFromActiveInteractions(interaction.user.id)
                }
                else if (int.customId == 'confirm') {
                    if (this.pointsUsers.length >= ticketLimit) {
                        embed.setDescription('Unfortunately too many people have used their points for this run. No points have been deducted.')
                        if (embed.footer) delete embed.footer
                        if (embed.author) delete embed.author
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.user.id)
                        return
                    }
                    let er, success = true
                    let leftOver = await points.buyEarlyLocaton(interaction.user, this.db, earlyLocationCost, this.afkInfo, this.bot, this.message.guild).catch(r => { er = r; success = false })
                    if (success) {
                        this.removeFromActiveInteractions(interaction.user.id)
                        embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\`\nYou now have \`${leftOver}\` points left over. Join lounge to be moved into the channel.`)
                        if (embed.footer) delete embed.footer
                        if (embed.author) delete embed.author
                        interaction.editReply({ embeds: [embed], components: [] })
                        if (this.leaderEmbed.fields[index].value == 'None!') this.leaderEmbed.fields[index].value = `<@!${interaction.user.id}>`
                        else this.leaderEmbed.fields[index].value += `, <@!${interaction.user.id}>`
                        this.pointsUsers.push(interaction.user)
                        this.earlyLocation.push(interaction.user)
                        await this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, bot));
                        await this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, bot));
                        emitter.on('Ended', (channelID, aborted) => {
                            if (aborted && channelID == this.channel.id) {
                                dms.send(`The afk check was aborted, you have been refunded ${earlyLocationCost} points`)
                                this.db.query(`UPDATE users SET points = points + ${earlyLocationCost} WHERE id = ${interaction.user.id}`)
                            }
                        })
                    }
                    else {
                        embed.setDescription(`There was an issue using the points: \`${er}\``)
                        if (embed.footer) delete embed.footer
                        if (embed.author) delete embed.author
                        interaction.editReply({ embeds: [embed], components: [] })
                        this.removeFromActiveInteractions(interaction.user.id)
                    }
                }
            })
        })
    }

    /**
     * 
     * @param {Discord.MessageComponentInteraction} interaction
     * @param {Number} index 
     */
    async supporterUse(interaction, index) {
        let embed = new Discord.MessageEmbed({ color: this.mainEmbed.hexColor, description: 'placeholder', footer: { text: 'Thank you for supporting ViBot ❤️' } })
        let reactor = this.message.guild.members.cache.get(interaction.user.id);
        if (this.earlyLocation.includes(interaction.user)) {
            embed.setDescription(`The location for this run has been set to \`${this.afkInfo.location}\``)
            interaction.reply({ embeds: [embed], ephemeral: true })
            this.removeFromActiveInteractions(interaction.user.id)
            return
        }
        let tier = await patreonHelper.getTier(interaction.user, this.bot, this.tokenDB)
        if (this.supporters.length >= this.bot.settings[this.message.guild.id].numerical.supporterlimit) {
            if ([0, 1, 2].includes(tier)) {
                embed.setDescription('Unfortunately, all spots for early location have been taken.')
                interaction.reply({ embeds: [embed], ephemeral: true })
                this.removeFromActiveInteractions(interaction.user.id)
                return
            }
            else if (tiers == -1) return
        }
        switch (tier) {
            case -1:
                return;
            case 0:
                return giveLocation(this, null);
            case 1:
                return giveLocation(this, 2);
            case 2:
                return giveLocation(this, 4);
            case 3:
                this.simp = u
                return giveLocation(this, null);
            default:
                return;
        }
        function giveLocation(afkcheck, cooldown) {
            this.removeFromActiveInteractions(interaction.user.id)
            let moved = true
            reactor.voice.setChannel(afkcheck.channel.id).catch(er => { moved = false })
            embed.setDescription(`The location for this run has been set to \`${afkcheck.afkInfo.location}\`\n\n${moved ? 'You have been moved into the raiding channel. If you get moved out during the AFK check, join lounge and you will be moved back in automatically' : 'To be moved into the raiding channel join lounge. You will be moved automatically (allow a few seconds)'}`)
            interaction.reply({ embeds: [embed], ephemeral: true })
            afkcheck.earlyLocation.push(interaction.user);
            afkcheck.supporters.push(interaction.user)
            if (afkcheck.leaderEmbed.fields[index].value == `None!`) afkcheck.leaderEmbed.fields[index].value = `<@!${interaction.user.id}> `;
            else afkcheck.leaderEmbed.fields[index].value += `, <@!${interaction.user.id}>`
            afkcheck.leaderEmbedMessage.edit({ embeds: [afkcheck.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot));
            afkcheck.runInfoMessage.edit({ embeds: [afkcheck.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot));
            if (cooldown) {
                afkcheck.tokenDB.query(`SELECT * FROM patreon WHERE id = '${interaction.user.id}'`, (err, rows) => {
                    if (rows.length == 0) afkcheck.tokenDB.query(`INSERT INTO patreon (id, lastuse) VALUES ('${interaction.user.id}', '${Date.now() + (3600000 * cooldown)}')`, (err, rows) => { })
                    else afkcheck.tokenDB.query(`UPDATE patreon SET lastuse = '${Date.now() + (3600000 * cooldown)}' WHERE id = '${interaction.user.id}'`, (err, rows) => { })
                })
            }
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
        for (let u of this.nitro) {
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
        this.channel.members.each(async u => {
            if (!this.raiders.includes(u.id)) {
                let reactor = this.message.guild.members.cache.get(u.id)
                if (reactor.roles.highest.position >= this.leaderOnLeave.position) return;
                await reactor.voice.setChannel(this.afkChannel).catch(er => { })
            }
        });

        //start post afk timer
        this.timer = await setInterval(() => { this.updatePost() }, 5000);

        //lock vc
        this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: true })
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true })

        //Get buttons ready for post afk check
        let ar = new Discord.MessageActionRow({
            components: [{
                type: 'BUTTON',
                label: '✅ Start Now',
                style: 'SUCCESS',
                customId: 'start'
            }, {
                type: 'BUTTON',
                label: '❌ Cancel Run',
                style: 'DANGER',
                customId: 'abort'
            }]
        })

        //post afk check embed
        this.mainEmbed.setDescription(`__**Post AFK Move-in**__\nIf you got moved out of vc, or missed the afk check:\n**1.** Join lounge\n**2** Click on ${this.bot.emojis.cache.get(this.afkInfo.headcountEmote)} to get moved in.\n__Time Remaining:__ ${this.postTime} seconds.`)
            .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`);
        this.raidStatusMessage.edit({ content: null, embeds: [this.mainEmbed], components: [ar] }).catch(er => console.log(er));

        this.postAfkInteractionCollector = new Discord.InteractionCollector(this.bot, { message: this.raidStatusMessage, interactionType: 'MESSAGE_COMPONENT', componentType: 'BUTTON' })
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

        this.mainEmbed.setDescription(`__**Post AFK Move-in**__\nIf you got moved out of vc, or missed the afk check:\n**1.** Join lounge\n**2** Click on ${this.bot.emojis.cache.get(this.afkInfo.headcountEmote)} to get moved in.\n__Time Remaining:__ ${this.postTime} seconds.`);
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
        await this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: true })
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true })
        if (this.afkInfo.newChannel && !this.isVet) {
            this.channel.setPosition(this.afkChannel.position)
        }
        const rules = `<#${this.settings.channels.raidingrules}>` || '#raiding-rules';
        //update embeds/messages
        this.mainEmbed.setDescription(`This afk check has been ended.\n${this.keys.length > 0 ? `Thank you to ${this.keys.map(k => `<@!${k}> `)} for popping a ${this.bot.emojis.cache.get(this.afkInfo.keyEmoteID)} for us!\n` : ''}${this.simp ? `Thank you to <@!${this.simp.id}> for being a ViBot SIMP` : ''}If you get disconnected during the run, **JOIN LOUNGE** *then* DM ${this.bot.user} \`join\` to get back in`)
            .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)

        if (this.afkInfo.isAdvanced)
            this.mainEmbed.description += `\n\n**__Advanced Runs__**\nThis is an **advanced run**, meaning there are extended requirements you **MUST** meet. You must be both **__8/8__** and follow the requirements sheet listed below.\n\nBasic raiding rules from ${rules} will still apply.\n\nIf you are caught not meeting these requirements, you will be removed from the run and suspended.`

        this.leaderEmbed.setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname} at`)
            .setTimestamp();
        this.raidStatusMessage.edit({ content: null, embeds: [this.mainEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot))
            .then(this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot)))
            .then(this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot)))
            .then(this.leaderEmbedMessage.reactions.removeAll())

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
                else historyEmbed.fields[4].value == 'None!' ? historyEmbed.fields[4].value = `<@!${m}>` : historyEmbed.fields[4].value += `, <@!${m}>`
            }
        })
        historyEmbed.setFooter(`${this.channel.id} • ${this.raidStatusMessage.id} • ${this.leaderEmbedMessage.id} • ${raiders.length} Raiders`)
        this.message.guild.channels.cache.get(this.settings.channels.history).send({ embeds: [historyEmbed] })
        this.message.guild.channels.cache.get(this.settings.channels.runlogs).send({ embeds: [historyEmbed] })

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
                if (this.guild.members.cache.get(u).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
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
                    if (this.message.guild.members.cache.get(u).roles.cache.has(this.nitroBooster.id)) points = +points * +this.settings.points.nitromultiplier
                    this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u}'`, er => { if (er) console.log('error logging reactable points in ', this.guild.id) })
                    pointsLog.push({
                        uid: u,
                        points: points,
                        reason: r,
                    })
                })
            }
            pointLogger.pointLogging(pointsLog, this.message.guild, this.bot, this.mainEmbed)
        }

        //log key
        for (let u of this.keys) {
            if (this.afkInfo.keyLogName) this.db.query(`UPDATE users SET ${this.afkInfo.keyLogName} = ${this.afkInfo.keyLogName} + 1 WHERE id = '${u}'`, er => {
                if (er) console.log(`${this.afkInfo.keyLogName} missing from ${this.guild.name} ${this.guild.id}`)
            })
            keyRoles.checkUser(this.guild.members.cache.get(u), this.bot, this.db)
        }

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
                    let nitros = []
                    afkCheck.channel.members.each(m => {
                        if (m.roles.cache.has(afkCheck.nitroBooster.id)) nitros.push(m)
                        else regular.push(m)
                    })
                    //regular raiders point logging
                    if (afkCheck.settings.points.perrun != 0) {
                        let regularQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun} WHERE `
                        regular.forEach(m => { regularQuery = regularQuery.concat(`id = '${m.id}' OR `) })
                        regularQuery = regularQuery.substring(0, regularQuery.length - 4)
                        afkCheck.db.query(regularQuery, er => { if (er) console.log('error logging points for run completes in ', afkCheck.guild.id) })
                        //nitro raiders point logging
                        let nitroQuery = `UPDATE users SET points = points + ${afkCheck.settings.points.perrun * afkCheck.settings.points.nitromultiplier} WHERE `
                        nitros.forEach(m => nitroQuery = nitroQuery.concat(`id = '${m.id}' OR `))
                        nitroQuery = nitroQuery.substring(0, nitroQuery.length - 4)
                        afkCheck.db.query(nitroQuery, er => { if (er) console.log('error logging points for run (nitro) completes in ', afkCheck.guild.id) })
                    }
                }
            }
        }

        //mark afk check as over
        setTimeout(() => { emitter.emit('Ended', this.channel.id, false) }, 2000);
        this.active = false;
    }

    async abortAfk() {
        this.ended = true
        if (this.raidStatusInteractionCollector) this.raidStatusInteractionCollector.stop();
        if (this.leaderInteractionCollector) this.leaderInteractionCollector.stop();
        if (this.raidStatusReactionCollector) this.raidStatusReactionCollector.stop();
        if (this.moveInTimer) clearInterval(this.moveInTimer);
        if (this.timer) clearInterval(this.timer);
        if (this.updateVC) clearInterval(this.updateVC)

        await this.channel.permissionOverwrites.edit(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: false })
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { CONNECT: false, VIEW_CHANNEL: false })
        if (this.afkInfo.newChannel && !this.isVet) {
            this.channel.setPosition(this.afkChannel.position)
        }
        this.mainEmbed.setImage(null);
        this.mainEmbed.setDescription(`This afk check has been aborted`)
            .setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        this.leaderEmbed.setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname} at`)
            .setTimestamp();

        this.raidStatusMessage.edit({ content: null, embeds: [this.mainEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot))
        this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed], components: [] }).catch(er => ErrorLogger.log(er, this.bot))
        this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot))

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
                if (err) ErrorLogger.log(err, this.bot)
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
        this.raidStatus.send({ embeds: [groupEmbed] })
    }

    async changeLocation(location) {
        this.afkInfo.location = location;

        if (!this.leaderEmbed) return

        this.leaderEmbed.fields[this.leaderEmbed.fields.length - 3].value = this.afkInfo.location;

        this.leaderEmbedMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot));
        this.runInfoMessage.edit({ embeds: [this.leaderEmbed] }).catch(er => ErrorLogger.log(er, this.bot));

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
        if (runInfo.isVet) {
            var parent = settings.categories.veteran;
            var template = message.guild.channels.cache.get(settings.voice.vettemplate)
            var raider = message.guild.roles.cache.get(settings.roles.vetraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
        } else if (runInfo.isEvent) {
            if (runInfo.isExalt && settings.backend.exaltsInRSA) {
                var parent = settings.categories.raiding;
                var template = message.guild.channels.cache.get(settings.voice.eventtemplate)
                var raider = message.guild.roles.cache.get(settings.roles.raider)
                var vibotChannels = message.guild.channels.cache.get(settings.channels.raidingchannels)
            } else {
                var parent = settings.categories.event;
                var template = message.guild.channels.cache.get(settings.voice.eventtemplate)
                var raider = message.guild.roles.cache.get(settings.roles.raider)
                var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
                var vibotChannels = message.guild.channels.cache.get(settings.channels.eventchannels)
            }
        } else {
            var parent = settings.categories.raiding;
            var template = message.guild.channels.cache.get(settings.voice.raidingtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.raider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.raidingchannels)
        }
        if (!template) return rej(`Template channel not found`)
        let channel = await template.clone({
            name: `${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s ${runInfo.runType}`,
            parent: message.guild.channels.cache.filter(c => c.type == 'GUILD_CATEGORY').find(c => c.name.toLowerCase() === parent).id,
            userLimit: runInfo.vcCap
        }).then(c => c.setPosition(0))

        await message.member.voice.setChannel(channel).catch(er => { })

        //allows raiders to view
        channel.permissionOverwrites.edit(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        if (eventBoi) channel.permissionOverwrites.edit(eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))

        //Embed to remove
        let embed = new Discord.MessageEmbed()
            .setDescription(`Whenever the run is over. React with the ❌ to delete the channel. View the timestamp for more information\nLocation: \`${runInfo.location}\``)
            .setFooter(channel.id)
            .setTimestamp()
            .setTitle(channel.name)
            .setColor(runInfo.embed.color)
        let m = await vibotChannels.send({ content: `${message.member}`, embeds: [embed] })
        await m.react('❌')
        setTimeout(() => { Channels.watchMessage(m, bot, settings) }, 5000)
        if (!channel) rej('No channel was made')
        res(channel);
    })
}

/**
 * 
 * @param {String} char 
 * @param {String} guildid 
 * @returns {Object} RunType
 */
function getRunType(char, guildid) {
    for (let i in afkTemplates[guildid]) if (afkTemplates[guildid][i].symbol == char) return afkTemplates[guildid][i]
    return null

}

async function getTemplate(message, afkTemplates, runType) {
    return new Promise(async (res, rej) => {
        if (afkTemplates[message.author.id] && afkTemplates[message.author.id][runType.toLowerCase()]) return res(afkTemplates[message.author.id][runType.toLowerCase()])
        else rej(`No templates for user under: ${runType}`)
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

function requestReactionHandler(r, u, channelId) {
    for (let i of runs) {
        if (i.channel == channelId) {
            i.afk.reactionHandler(r, u)
            return
        }
    }
}