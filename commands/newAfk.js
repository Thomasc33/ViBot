//imports
const botSettings = require('../settings.json');
const Discord = require('discord.js');
const fs = require('fs')
const ErrorLogger = require('../logError')
const Locker = require('./lock');
const Unlocker = require('./unlock')
const Channels = require('./vibotChannels')
const realmEyeScrape = require('../realmEyeScrape');
const { rejects } = require('assert');

//globals
var activeVetRun = false;
var activeRun = false;
var currentReg;
var currentVet;
var bot;

module.exports = {
    name: 'newafk',
    description: 'The new version of the afk check',
    args: '<c/v/fsv> <location>',
    role: 'Almost Raid Leader',
    async execute(message, args, bott, db) {
        let settings = bott.settings[message.guild.id]
        if (args.length == 0) return;
        bot = bott
        if (message.channel.name === 'dylanbot-commands') var isVet = false;
        else if (message.channel.name === 'veteran-bot-commands') var isVet = true;
        else return message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
        if (args.length < 2) return message.channel.send("Command entered incorrectly -> ;newafk <c/v/fsv> <location>");
        if (isVet && activeVetRun) return message.channel.send("There is already a run active. If this is an error, do \`;allownewrun\`");
        else if (activeRun) return message.channel.send("There is already a run active. If this is an error, do \`;allownewrun\`");
        switch (args[0].charAt(0).toLowerCase()) {
            case 'c':
                var run = 1;
                break;
            case 'v':
                var run = 2;
                break;
            case 'f':
                var run = 3;
                break;
            default:
                message.channel.send("Command entered incorrectly -> ;newafk <c/v/fsv> <location>");
                return;
        }
        let location = "";
        for (i = 1; i < args.length; i++) location = location.concat(args[i]) + ' ';
        location = location.trim();
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        let channel = await createChannel(isVet, message, run)
            .catch(er => { ErrorLogger.log(er, bot); return message.channel.send('There was an issue creating the channel. Please try again') })
        if (isVet) currentVet = new afk(run, location, message, isVet, db, channel, settings);
        else currentReg = new afk(run, location, message, isVet, db, channel, settings);
        message.channel.send('Channel created successfully. Beginning afk check in 10 seconds')
        if (isVet) setTimeout(beginRun, 10000, true)
        else setTimeout(beginRun, 10000, false)
    },
    changeLocation(location, isVet, channel) {
        if (isVet) {
            if (activeVetRun) {
                currentVet.changeLoc(location);
            } else {
                channel.send("There is not a run currently going on at the moment")
                return;
            }
        } else {
            if (activeRun) {
                currentReg.changeLoc(location);
            } else {
                channel.send("There is not a run currently going on at the moment")
                return;
            }
        }
    },
    allowRun(isVet) {
        if (isVet) activeVetRun = false;
        else activeRun = false;
    }
}

async function beginRun(isVet) {
    if (isVet) currentVet.start();
    else currentReg.start();
}

class afk {
    constructor(run, location, message, isVet, db, channel, settings) {
        this.settings = settings;
        this.channel = channel;
        this.run = run;
        this.db = db;
        this.location = location;
        this.message = message;
        this.isVet = isVet;
        if (this.isVet) this.raidStatus = this.message.guild.channels.cache.find(c => c.name === settings.vetstatus);
        else this.raidStatus = this.message.guild.channels.cache.find(c => c.name === settings.raidstatus);
        if (this.isVet) this.dylanBotCommands = this.message.guild.channels.cache.find(c => c.name === settings.vetcommands);
        else this.dylanBotCommands = this.message.guild.channels.cache.find(c => c.name === settings.raidcommands);
        if (this.isVet) this.verifiedRaiderRole = this.message.guild.roles.cache.find(r => r.name === settings.vetraider);
        else this.verifiedRaiderRole = this.message.guild.roles.cache.find(r => r.name === settings.raider);
        if (this.isVet) activeVetRun = true;
        else activeRun = true;
        this.afkChannel = message.guild.channels.cache.find(c => c.name === 'afk');
        this.dylanBotInfo = message.guild.channels.cache.find(c => c.name === settings.runinfo);
        this.officialRusher = message.guild.roles.cache.find(r => r.name === settings.rusher);
        this.nitroBooster = message.guild.roles.cache.find(r => r.name === settings.nitro);
        this.leaderOnLeave = message.guild.roles.cache.find(r => r.name === settings.lol);
        this.minutes;
        this.seconds;
        this.nitro = []
        this.key = null
        this.vials = []
        this.rushers = []
        this.endedBy
        this.mystics = []
        this.brains = []
        this.time = botSettings.afkTimeLimit;
        this.postTime = 20;
        this.earlyLocation = [];
        this.raider = [];
        this.sendMessage();
    }

    async sendMessage() {
        let runType = 'Unspecified'
        let location
        switch (this.run) {
            case 1: //cult
                runType = 'Cult'
                break;
            case 2: //void
                runType = 'Void'
                break;
            case 3: //full skip
                runType = 'Fullskip Void'
                break;
            default: return;
        }
        switch (this.location.substring(0, 2)) {
            case 'us':
                location = ':flag_us:'
                break;
            case 'eu':
                location = ':flag_eu:'
                break;
        }
        if (location) this.afkCheckEmbed = await this.raidStatus.send(`@here A \`${runType}\` (${location}) afk will be starting in 10 seconds by ${this.message.member}. Prepare to join raiding \`${this.channel.name}\` *Now located above lounge*. **You do not need to react to anything**`).catch(er => ErrorLogger.log(er, bot));
        else this.afkCheckEmbed = await this.raidStatus.send(`@here A \`${runType}\` afk will be starting in 10 seconds by ${this.message.member}. Prepare to join raiding \`${this.channel.name}\` *Now located above lounge*. **You do not need to react to anything**`).catch(er => ErrorLogger.log(er, bot));
    }

    async start() {
        //begin afk check
        switch (this.run) {
            case 1: //cult
                this.cult()
                break;
            case 2: //void
                this.voidd()
                break;
            case 3: //full skip
                this.fsv()
                break;
            default: return;
        }
    }

    async cult() {
        //Raid status message
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setAuthor(`Cult Started by ${this.message.member.nickname} in ${this.channel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name**
                If you have a key react with <${botSettings.emote.LostHallsKey}>
                To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
                If you plan on rushing, react with the <${botSettings.emote.Plane}>
                If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
                To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        this.afkCheckEmbed.edit(this.embedMessage);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        cultReact(this.afkCheckEmbed);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle(`AFK Check control panel for \`${this.channel.name}\``)
            .setFooter(`❌ to abort. 🔑 for fake key react`)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current rushers`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            );

        this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
        this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));

        this.mainReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, cultFilter);

        this.mainReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            //key
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (this.key != null) return;
                this.confirmKey(u, r);
            }
            //rusher
            if (r.emoji.id === botSettings.emoteIDs.Plane) {
                if (!reactor.roles.cache.has(this.officialRusher.id)) {
                    reactor.send(`Only Official Rushers get early location`);
                    return;
                }
                if (this.rusherCount > 3) {
                    reactor.send(`Too many rushers have already received location`);
                    return;
                }
                this.confirmRush(u, r);
            }
            //nitro
            if (r.emoji.id === botSettings.emoteIDs.shard) {
                if (this.earlyLocation.includes(u)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    return;
                }
                if (this.nitro.length + 1 > botSettings.nitroCount) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitro.length - 1] = u;
                    if (this.leaderEmbed.fields[3].value == `None yet!`) {
                        this.leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[3].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.endedBy = u;
                this.endAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌')
            .then(this.afkControlPanelCommands.react('🔑'))
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, keyXFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.endedBy = u;
                this.abortAfk();
            }
            if (r.emoji.name === '🔑') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.leaderEmbed.fields[0].value = `None yet!`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.key = null
            }
        });

    }

    async voidd() {
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setAuthor(`Void Started by ${this.message.member.nickname} in ${this.channel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.voidd}>
            If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
            To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
            If you are a ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
            To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        this.afkCheckEmbed.edit(this.embedMessage);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        voidReact(this.afkCheckEmbed);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setTitle(`AFK Check control panel for \`${this.channel.name}\``)
            .setFooter(`❌ to abort. 🔑 for fake key react`)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current vials`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            );

        this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
        this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));

        this.mainReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, voidFilter);

        this.mainReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            //key
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (this.key != null) return;
                this.confirmKey(u, r);
            }
            //vial
            if (r.emoji.id === botSettings.emoteIDs.Vial) {
                if (this.vialCount + 1 > 3) return;
                this.confirmVial(u, r);
            }
            //nitro
            if (r.emoji.id === botSettings.emoteIDs.shard) {
                if (this.earlyLocation.includes(u)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    return;
                }
                if (reactor.roles.highest.position >= this.leaderOnLeave.position) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.earlyLocation.push(u);
                    return;
                }
                if (this.nitro.length + 1 > botSettings.nitroCount) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitro.length - 1] = u;
                    if (this.leaderEmbed.fields[3].value == `None yet!`) {
                        this.leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[3].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.endedBy = u;
                this.endAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌')
            .then(this.afkControlPanelCommands.react('🔑'))
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, keyXFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.endedBy = u;
                this.abortAfk();
            }
            if (r.emoji.name === '🔑') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.leaderEmbed.fields[0].value = `None yet!`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.key = null
            }
        });
    }

    async fsv() {
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setAuthor(`Fullskip Void Started by ${this.message.member.nickname} in ${this.channel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.SkipBoi}>
            If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
            To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
            If you have 85+ MHeal and a 8/8 Mystic, react with <${botSettings.emote.Mystic}>
            If you are an 8/8 trickster with a brain, react with <${botSettings.emote.Brain}>
            If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
            To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        this.afkCheckEmbed.edit(this.embedMessage);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        fsvReact(this.afkCheckEmbed);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setTitle(`AFK Check control panel for \`${this.channel.name}\``)
            .setFooter(`❌ to abort. 🔑 for fake key react`)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current vials`, value: `None yet!` },
                { name: `Our current tricksters`, value: `None yet!` },
                { name: `Our current mystics`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            )

        this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
        this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));

        this.mainReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, fsvFilter);

        this.mainReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            //key
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (this.key != null) return;
                this.confirmKey(u, r);
            }
            //vial
            if (r.emoji.id === botSettings.emoteIDs.Vial) {
                if (this.vialCount + 1 > 3) return;
                this.confirmVial(u, r);
            }
            //mystic
            if (r.emoji.id === botSettings.emoteIDs.mystic) {
                if (this.mysticCount + 1 > 3) return;
                this.confirmMystic(u, r);
            }
            //brain
            if (r.emoji.id === botSettings.emoteIDs.brain) {
                if (this.brains.length + 1 > 3) return;
                this.confirmBrain(u, r);
            }
            //nitro
            if (r.emoji.id === botSettings.emoteIDs.shard) {
                if (this.earlyLocation.includes(u)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    return;
                }
                if (reactor.roles.highest.position >= this.leaderOnLeave.position) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.earlyLocation.push(u);
                    return;
                }
                if (this.nitro.length + 1 > botSettings.nitroCount) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitro.length - 1] = u;
                    if (this.leaderEmbed.fields[5].value == `None yet!`) {
                        this.leaderEmbed.fields[5].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[5].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.endedBy = u;
                this.endAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌')
            .then(this.afkControlPanelCommands.react('🔑'))
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, keyXFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.endedBy = u;
                this.abortAfk();
            }
            if (r.emoji.name === '🔑') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === this.settings.arl).position) return;
                this.leaderEmbed.fields[0].value = `None yet!`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.key = null
            }
        });
    }

    async confirmKey(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                clearInterval(endAfter);
                return;
            }
        }, 60000)
        let dm = await u.createDM().catch(r => ErrorLogger.log(er, bot))
        let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.LostHallsKey}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => ErrorLogger.log(er, bot));

        let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
        await DirectMessage.react("✅");
        dmReactionCollector.on("collect", (r, u) => {
            if (this.key != null) return;
            this.key = u;
            dm.send(`The location for this run has been set to \`${this.location}\`, get there and confirm key with ${this.message.member.nickname}`);
            if (this.leaderEmbed.fields[0].value == `None yet!`) {
                this.leaderEmbed.fields[0].value = `<${botSettings.emote.LostHallsKey}>: <@!${u.id}>`;
            } else this.leaderEmbed.fields[0].value += `\n<${botSettings.emote.LostHallsKey}>: ${`<@!${u.id}>`}`;
            this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
            this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
            this.earlyLocation.push(u);
            clearInterval(endAfter);
            dmReactionCollector.stop();
            let keyMember = this.message.guild.members.cache.get(u.id)
            let tempKeyPopper = this.message.guild.roles.cache.find(r => r.name === this.settings.tempkey)
            if (tempKeyPopper && keyMember) keyMember.roles.add(tempKeyPopper.id)
        });
    }
    async confirmVial(u, r) {
        let endAfter = setInterval(function () {
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
        try {
            let dm = await u.createDM().catch();
            let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.Vial}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch();

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);

            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.vials.length > 2 || this.vials.includes(u)) return;
                this.vials.push(u);
                dm.send(`The location for this run has been set to \`${this.location}\`, get there and confirm vial with ${this.message.member.nickname}`);
                if (this.leaderEmbed.fields[1].value == `None yet!`) {
                    this.leaderEmbed.fields[1].value = `<${botSettings.emote.Vial}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[1].value += `\n<${botSettings.emote.Vial}>: ${`<@!${u.id}>`}`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) { }
    }
    async confirmRush(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                clearInterval(endAfter);
                return;
            }
        }, 60000)
        try {
            let dm = await u.createDM().catch();
            let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.Plane}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch();

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);

            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.rushers.length > 2 || this.rushers.includes(u)) return;
                this.rushers.push(u);
                dm.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
                if (this.leaderEmbed.fields[1].value == `None yet!`) {
                    this.leaderEmbed.fields[1].value = `<${botSettings.emote.Plane}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[1].value += `\n<${botSettings.emote.Plane}>: ${`<@!${u.id}>`}`;
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) { }
    }
    async confirmMystic(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                if (reactionCollector) reactionCollector.stop()
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                clearInterval(endAfter);
                return;
            }
        }, 60000)
        try {
            let dm = await u.createDM();
            let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.Mystic}>. If your mystic is 8/8 and you have an 85 magic heal pet, then press :white_check_mark: to confirm. Ignore this message otherwise`);
            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", async (r, u) => {
                if (this.mystics.length > 2 || this.mystics.includes(u)) return;
                let found = false;
                let characters = await realmEyeScrape.getUserInfo(this.message.guild.members.cache.get(u.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]).catch(er => found = true)
                if (characters) characters.characters.forEach(c => {
                    if (c.class == 'Mystic' && c.stats == '8/8') {
                        found = true;
                        this.mystics.push(u)
                        dm.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
                        if (this.leaderEmbed.fields[3].value == `None yet!`) {
                            this.leaderEmbed.fields[3].value = `<${botSettings.emote.Mystic}>: <@!${u.id}>`;
                        } else this.leaderEmbed.fields[3].value += `\n<${botSettings.emote.Mystic}>: ${`<@!${u.id}>`}`
                        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        this.earlyLocation.push(u);
                        clearInterval(endAfter);
                        dmReactionCollector.stop();
                    }
                })
                if (!found) {
                    let prompt = await dm.send(`I could not find any 8/8 mystics under \`${this.message.guild.members.cache.get(u.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]}\`. React with :white_check_mark: if you do have an 8/8 mystic on another account`)
                    let reactionCollector = new Discord.ReactionCollector(prompt, dmReactionFilter);
                    await prompt.react('✅')
                    reactionCollector.on('collect', (r, u) => {
                        this.mystics.push(u)
                        dm.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
                        if (this.leaderEmbed.fields[3].value == `None yet!`) {
                            this.leaderEmbed.fields[3].value = `<${botSettings.emote.Mystic}>: <@!${u.id}>`;
                        } else this.leaderEmbed.fields[3].value += `\n<${botSettings.emote.Mystic}>: ${`<@!${u.id}>`}`
                        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        this.earlyLocation.push(u);
                        clearInterval(endAfter);
                        dmReactionCollector.stop();
                    })
                }

            });
        } catch (er) { }
    }
    async confirmBrain(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                clearInterval(endAfter);
                return;
            }
        }, 60000)
        try {
            let dm = await u.createDM().catch();
            let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.Brain}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch();

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.brains.length > 2 || this.brains.includes(u)) return;
                this.brains.push(u);
                dm.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
                if (this.leaderEmbed.fields[2].value == `None yet!`) {
                    this.leaderEmbed.fields[2].value = `<${botSettings.emote.Brain}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[2].value += `\n<${botSettings.emote.Brain}>: ${`<@!${u.id}>`}`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) { }
    }
    async updateAfkCheck() {
        this.time = this.time - 5;
        if (this.time == 0) {
            this.endedBy = bot.user;
            this.endAfk();
            return;
        }
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        if (this.embedMessage == null) return;
        this.embedMessage.setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        this.afkCheckEmbed.edit(this.embedMessage).catch(er => ErrorLogger.log(er, bot));
    }
    async moveIn() {
        for (let i in this.earlyLocation) {
            let u = this.earlyLocation[i];
            let member = this.message.guild.members.cache.get(u.id);
            try {
                if (member.voice.channel.name == 'lounge' || member.voice.channel.name == 'Veteran Lounge' || member.voice.channel.name.contains('drag')) {
                    member.edit({ channel: this.channel }).catch(er => { });
                }
            } catch (er) { }
        }
    }
    async endAfk() {
        this.mainReactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: true })
        if (!this.isVet) {
            this.channel.setPosition(this.afkChannel.position)
        }

        if (this.key != null) {
            this.embedMessage.setDescription(`This afk check has been ended.
        Thank you to <@!${this.key.id}> for popping a <${botSettings.emote.LostHallsKey}> for us!`)
                .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        } else {
            this.embedMessage.setDescription(`This afk check has been ended.`)
                .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        }
        this.leaderEmbed.setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)

        this.afkCheckEmbed.edit('', this.embedMessage).catch(er => ErrorLogger.log(er, bot))
        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot))
        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot))
        this.afkControlPanelCommands.reactions.removeAll()

        if (this.isVet) activeVetRun = false;
        else activeRun = false;

        let earlyLocationIDS = []
        for (let i in this.earlyLocation) earlyLocationIDS.push(this.earlyLocation[i].id)
        let raiders = []
        this.channel.members.array().forEach(m => raiders.push(m.id))
        if (this.key) {
            bot.afkChecks[this.channel.id] = {
                isVet: this.isVet,
                location: this.location,
                key: this.key.id,
                leader: this.message.author.id,
                earlyLocation: earlyLocationIDS,
                raiders: raiders,
                time: Date.now(),
                runType: this.run
            }
        } else bot.afkChecks[this.channel.id] = {
            isVet: this.isVet,
            location: this.location,
            leader: this.message.author.id,
            earlyLocation: earlyLocationIDS,
            raiders: raiders,
            time: Date.now(),
            runType: this.run
        }
        fs.writeFileSync('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
            if (err) ErrorLogger.log(err, bot)
        })
        setTimeout(() => {
            this.channel.members.each(m => {
                try {
                    this.db.query(`SELECT * FROM users WHERE id = '${m.id}'`, async (err, rows) => {
                        if (rows[0] == undefined) await this.db.query(`INSERT INTO users (id, ign) VALUES('${m.id}', '${m.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}')`)
                        if (this.run == 1) {
                            this.db.query(`UPDATE users SET cultRuns = '${parseInt(rows[0].cultRuns) + 1}' WHERE id = '${m.id}'`)
                        } else {
                            this.db.query(`UPDATE users SET voidRuns = '${parseInt(rows[0].voidRuns) + 1}' WHERE id = '${m.id}'`)
                        }
                        if (err) { ErrorLogger(err, bot); return; }
                    })
                } catch (er) {
                    ErrorLogger(er, bot);
                }
            })

            if (this.key != null) {
                try {
                    this.db.query(`SELECT * FROM users WHERE id = '${this.key.id}'`, (err, rows) => {
                        if (rows[0] == undefined) return;
                        this.db.query(`UPDATE users SET keypops = '${parseInt(rows[0].keypops) + 1}' WHERE id = '${this.key.id}'`)
                    })
                } catch (er) {
                    ErrorLogger(er, bot)
                }
            }
        }, 60000)
    }
    async abortAfk() {
        this.mainReactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: false })
        this.channel.setPosition(this.channel.parent.children.filter(c => c.type == 'voice').size - 1)

        this.embedMessage.setDescription(`This afk check has been aborted`)
            .setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        this.leaderEmbed.setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)

        this.afkCheckEmbed.edit('', this.embedMessage).catch(er => ErrorLogger.log(er, bot))
        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot))
        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot))

        let earlyLocationIDS = []
        for (let i in this.earlyLocation) earlyLocationIDS.push(this.earlyLocation[i].id)
        let raiders = []
        this.channel.members.array().forEach(m => raiders.push(m.id))
        if (this.key) {
            bot.afkChecks[this.channel.id] = {
                isVet: this.isVet,
                location: this.location,
                key: this.key.id,
                leader: this.message.author.id,
                earlyLocation: earlyLocationIDS,
                raiders: raiders,
                time: Date.now(),
                runType: this.run
            }
        } else bot.afkChecks[this.channel.id] = {
            isVet: this.isVet,
            location: this.location,
            leader: this.message.author.id,
            earlyLocation: earlyLocationIDS,
            raiders: raiders,
            time: Date.now(),
            runType: this.run
        }
        fs.writeFileSync('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
            if (err) ErrorLogger.log(err, bot)
        })

        if (this.isVet) activeVetRun = false;
        else activeRun = false;
    }
    async changeLoc(locationn) {
        this.location = locationn;

        //update afk control panel
        switch (this.run) {
            case 1:
                this.leaderEmbed.fields[2].value = this.location;
                break;
            case 2:
                this.leaderEmbed.fields[2].value = this.location;
                break;
            case 3:
                this.leaderEmbed.fields[4].value = this.location;
                break;
        }
        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));

        //send location to everyone that already had it
        var arrayLength = this.earlyLocation.length;
        try {
            for (i = 0; i < arrayLength; i++) {
                let u = this.earlyLocation[i];
                let dm = await u.createDM();
                await dm.send(`The location has been changed to \`${this.location}\`. Get there ASAP`);
            }
        } catch (er) {
            console.log(er)
            return;
        }
    }
}
async function createChannel(isVet, message, run) {
    let settings = bot.settings[message.guild.id]
    return new Promise(async (res, rej) => {
        //channel creation
        if (isVet) {
            var parent = 'veteran raiding';
            var template = message.guild.channels.cache.find(c => c.name === settings.vettemplate);
            var raider = message.guild.roles.cache.find(r => r.name === settings.vetraider)
            var vibotChannels = message.guild.channels.cache.find(c => c.name === botSettings.ActiveVetName)
        }
        else {
            var parent = 'raiding';
            var template = message.guild.channels.cache.find(c => c.name === settings.raidingtemplate);
            var raider = message.guild.roles.cache.find(r => r.name === settings.raider)
            var vibotChannels = message.guild.channels.cache.find(c => c.name === botSettings.ActiveRaidingName)
        }
        let channel = await template.clone()
        setTimeout(async function () {
            await channel.setParent(message.guild.channels.cache.filter(c => c.type == 'category').find(c => c.name.toLowerCase() === parent))
            channel.setPosition(0)
        }, 1000)
        await message.member.voice.setChannel(channel).catch(er => { })
        if (run == 1) { await channel.setName(`${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s Cult`) }
        if (run == 2) { await channel.setName(`${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s Void`) }
        if (run == 3) { await channel.setName(`${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s Full-Skip Void`) }

        //allows raiders to view
        channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))

        //Embed to remove
        let embed = new Discord.MessageEmbed()
            .setTitle(`${message.member.nickname}'s Run`)
            .setDescription('Whenever the run is over. React with the ❌ to delete the channel. View the timestamp for more information')
            .setFooter(channel.id)
            .setTimestamp()
        let m = await vibotChannels.send(embed)
        await m.react('❌')
        setTimeout(() => { Channels.update(message.guild, bot) }, 5000)
        if (!channel) rej('No channel was made')
        res(channel);
    })

}
//React functions
async function cultReact(message) {
    message.react(botSettings.emote.LostHallsKey)
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .then(message.react(botSettings.emote.Plane))
        .then(message.react(botSettings.emote.shard))
        .then(message.react('❌'))
        .catch(er => ErrorLogger.log(er, bot));
}
async function voidReact(message) {
    message.react(botSettings.emote.LostHallsKey)
        .then(message.react(botSettings.emote.Vial))
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .then(message.react(botSettings.emote.shard))
        .then(message.react('❌'))
        .catch(er => ErrorLogger.log(er, bot));
}
async function fsvReact(message) {
    message.react(botSettings.emote.LostHallsKey)
        .then(message.react(botSettings.emote.Vial))
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .then(message.react(botSettings.emote.Brain))
        .then(message.react(botSettings.emote.Mystic))
        .then(message.react(botSettings.emote.shard))
        .then(message.react('❌'))
        .catch(er => ErrorLogger.log(er, bot));
}

//reaction filters
const keyXFilter = (r, u) => (r.emoji.name === '❌' || r.emoji.name === '🔑') && !u.bot;
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;
const cultFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Plane || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const voidFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const fsvFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.id === botSettings.emoteIDs.mystic || r.emoji.id === botSettings.emoteIDs.brain || r.emoji.name === '❌'