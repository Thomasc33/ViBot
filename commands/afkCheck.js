//imports
const botSettings = require('../settings.json');
const Discord = require('discord.js');
const fs = require('fs')
const ErrorLogger = require('../logError')
const Channels = require('./vibotChannels')
const realmEyeScrape = require('../realmEyeScrape');
const points = require('./points');
const KeyRoles = require('./keyRoles');
const keyRoles = require('./keyRoles');

//globals
var activeVetRun = false;
var activeRun = false;
var currentReg;
var currentVet;
var bot;

module.exports = {
    name: 'afk',
    description: 'The new version of the afk check',
    requiredArgs: 1,
    args: '<c/v/fsv> <location>',
    role: 'almostrl',
    async execute(message, args, bott, db) {
        let settings = bott.settings[message.guild.id]
        if (args.length == 0) return;
        bot = bott
        if (message.channel.id === settings.channels.raidcommands) var isVet = false;
        else if (message.channel.name === settings.channels.vetcommands) var isVet = true;
        else return message.channel.send(`Try again, but in <@#${settings.channels.raidcommands}> or <@#${settings.channels.vetcommands}>`);
        if (args.length < 2) return message.channel.send(`Command entered incorrectly -> ${botSettings.prefix}${this.name} ${this.args}`);
        if (isVet && activeVetRun) return message.channel.send(`There is already a run active. If this is an error, do \`;allowrun\``);
        else if (activeRun) return message.channel.send(`There is already a run active. If this is an error, do \`;allowrun\``);
        switch (args[0].charAt(0).toLowerCase()) {
            case 'c': var run = 1; break;
            case 'v': var run = 2; break;
            case 'f': var run = 3; break;
            default: return message.channel.send(`Command entered incorrectly -> ${botSettings.prefix}${this.name} ${this.args}`);
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
        if (this.isVet) this.raidStatus = this.message.guild.channels.cache.get(settings.channels.vetstatus)
        else this.raidStatus = this.message.guild.channels.cache.get(settings.channels.raidstatus)
        if (this.isVet) this.dylanBotCommands = this.message.guild.channels.cache.get(settings.channels.vetcommands)
        else this.dylanBotCommands = this.message.guild.channels.cache.get(settings.channels.raidcommands)
        if (this.isVet) this.verifiedRaiderRole = this.message.guild.roles.cache.get(settings.roles.vetraider)
        else this.verifiedRaiderRole = this.message.guild.roles.cache.get(settings.roles.raider)
        if (this.isVet) activeVetRun = true;
        else activeRun = true;
        this.staffRole = message.guild.roles.cache.get(settings.roles.almostrl)
        this.afkChannel = message.guild.channels.cache.get(settings.voice.afk)
        this.dylanBotInfo = message.guild.channels.cache.get(settings.channels.runlogs)
        this.officialRusher = message.guild.roles.cache.get(settings.roles.rusher)
        this.nitroBooster = message.guild.roles.cache.get(settings.roles.nitro)
        this.leaderOnLeave = message.guild.roles.cache.get(settings.roles.lol)
        this.minutes;
        this.seconds;
        this.nitro = []
        this.key = null
        this.vials = []
        this.rushers = []
        this.endedBy
        this.mystics = []
        this.brains = []
        this.time = settings.numerical.afktime
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
            .setAuthor(`Cult Started by ${this.message.member.nickname} in ${this.channel.name}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name**
If you have a key react with <${botSettings.emote.LostHallsKey}>
To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
If you plan on rushing, react with the <${botSettings.emote.Plane}>
If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}> to get into VC`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        if (this.message.author.avatarURL()) this.embedMessage.author.iconURL = this.message.author.avatarURL()
        if (this.settings.backend.points) this.embedMessage.setDescription(this.embedMessage.description.concat(`\nTo use points for early location, react with 🎟️
            To end the AFK check as a leader, react to ❌`))
        else this.embedMessage.setDescription(this.embedMessage.description.concat(`\nTo end the AFK check as a leader, react to ❌`))
        this.afkCheckEmbed.edit(this.embedMessage);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        cultReact(this.afkCheckEmbed, this.settings);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle(`AFK Check control panel for \`${this.channel.name}\``)
            .setFooter(`❌ to abort. 🔑 for fake key react`)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current rushers`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
                { name: `Nitro Boosters`, value: `None yet!` }
            )
        if (this.settings.backend.points) this.leaderEmbed.addField(`Point Users`, `None yet!`)

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
                this.useNitro(u, 3)
            }
            //points
            if (r.emoji.name === '🎟️') {
                this.pointsUse(u, 4)
            }
            //end
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
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
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.abortAfk();
            }
            if (r.emoji.name === '🔑') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
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
            .setAuthor(`Void Started by ${this.message.member.nickname} in ${this.channel.name}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.voidd}>
If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}> to get into VC`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        if (this.message.author.avatarURL()) this.embedMessage.author.iconURL = this.message.author.avatarURL()
        if (this.settings.backend.points) this.embedMessage.setDescription(this.embedMessage.description.concat(`\nTo use points for early location, react with 🎟️
        To end the AFK check as a leader, react to ❌`))
        else this.embedMessage.setDescription(this.embedMessage.description.concat(`\nTo end the AFK check as a leader, react to ❌`))
        this.afkCheckEmbed.edit(this.embedMessage);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        voidReact(this.afkCheckEmbed, this.settings);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setTitle(`AFK Check control panel for \`${this.channel.name}\``)
            .setFooter(`❌ to abort. 🔑 for fake key react`)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current vials`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
                { name: `Nitro Boosters`, value: `None yet!` }
            )
        if (this.settings.backend.points) this.leaderEmbed.addField(`Point Users`, `None yet!`)

        this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
        this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));

        this.mainReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, voidFilter);

        this.mainReactionCollector.on("collect", (r, u) => {
            let reactor = this.message.guild.members.cache.get(u.id);
            if (u.bot) return;
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
                this.useNitro(u, 3)
            }
            //points
            if (r.emoji.name === '🎟️') {
                this.pointsUse(u, 4)
            }
            //end
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
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
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.abortAfk();
            }
            if (r.emoji.name === '🔑') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
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
            .setAuthor(`Fullskip Void Started by ${this.message.member.nickname} in ${this.channel.name}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.SkipBoi}>
If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
If you have 85+ MHeal and a 8/8 Mystic, react with <${botSettings.emote.Mystic}>
If you are an 8/8 trickster with a brain, react with <${botSettings.emote.Brain}>
If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}> to get into VC`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        if (this.message.author.avatarURL()) this.embedMessage.author.iconURL = this.message.author.avatarURL()
        if (this.settings.backend.points) this.embedMessage.setDescription(this.embedMessage.description.concat(`\nTo use points for early location, react with 🎟️
        To end the AFK check as a leader, react to ❌`))
        else this.embedMessage.setDescription(this.embedMessage.description.concat(`\nTo end the AFK check as a leader, react to ❌`))
        this.afkCheckEmbed.edit(this.embedMessage);

        this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: true, VIEW_CHANNEL: true })

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        fsvReact(this.afkCheckEmbed, this.settings);

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
                { name: `Nitro Boosters`, value: `None yet!` }
            )
        if (this.settings.backend.points) this.leaderEmbed.addField(`Point Users`, `None yet!`)

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
                this.useNitro(u, 5)
            }
            //points
            if (r.emoji.name === '🎟️') {
                this.pointsUse(u, 6)
            }
            //end
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
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
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.abortAfk();
            }
            if (r.emoji.name === '🔑') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
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
        let DirectMessage = await u.send(`You reacted as <${botSettings.emote.LostHallsKey}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => { if (r.message == 'Cannot send messages to this user') this.dylanBotCommands.send(`<@!${u.id}> tried to react with <${botSettings.emote.LostHallsKey}> but their DMs are private`) })
        let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
        await DirectMessage.react("✅");
        dmReactionCollector.on("collect", (r, u) => {
            if (this.key != null) return;
            this.key = u;
            u.send(`The location for this run has been set to \`${this.location}\`, get there and confirm key with ${this.message.member.nickname}`);
            if (this.leaderEmbed.fields[0].value == `None yet!`) {
                this.leaderEmbed.fields[0].value = `<${botSettings.emote.LostHallsKey}>: <@!${u.id}>`;
            } else this.leaderEmbed.fields[0].value += `\n<${botSettings.emote.LostHallsKey}>: ${`<@!${u.id}>`}`;
            this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
            this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
            this.earlyLocation.push(u);
            clearInterval(endAfter);
            dmReactionCollector.stop();
            let keyMember = this.message.guild.members.cache.get(u.id)
            let tempKeyPopper = this.message.guild.roles.cache.get(this.settings.roles.tempkey)
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
            let DirectMessage = await u.send(`You reacted as <${botSettings.emote.Vial}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => { if (r.message == 'Cannot send messages to this user') this.dylanBotCommands.send(`<@!${u.id}> tried to react with <${botSettings.emote.Vial}> but their DMs are private`) });
            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);

            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.vials.length > 2 || this.vials.includes(u)) return;
                this.vials.push(u);
                u.send(`The location for this run has been set to \`${this.location}\`, get there and confirm vial with ${this.message.member.nickname}`);
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
            let DirectMessage = await u.send(`You reacted as <${botSettings.emote.Plane}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => { if (r.message == 'Cannot send messages to this user') this.dylanBotCommands.send(`<@!${u.id}> tried to react with <${botSettings.emote.Plane}> but their DMs are private`) });
            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);

            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.rushers.length > 2 || this.rushers.includes(u)) return;
                this.rushers.push(u);
                u.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
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
            let DirectMessage = await u.send(`You reacted as <${botSettings.emote.Mystic}>. If your mystic is 8/8 and you have an 85 magic heal pet, then press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => { if (r.message == 'Cannot send messages to this user') this.dylanBotCommands.send(`<@!${u.id}> tried to react with <${botSettings.emote.Mystic}> but their DMs are private`) });
            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", async (r, u) => {
                if (this.mystics.length > 2 || this.mystics.includes(u)) return;
                let found = false;
                let characters = await realmEyeScrape.getUserInfo(this.message.guild.members.cache.get(u.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]).catch(er => found = true)
                if (characters.characters) characters.characters.forEach(c => {
                    if (c.class == 'Mystic' && c.stats == '8/8') {
                        found = true;
                        this.mystics.push(u)
                        u.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
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
                    let prompt = await u.send(`I could not find any 8/8 mystics under \`${this.message.guild.members.cache.get(u.id).nickname.replace(/[^a-z|]/gi, '').split('|')[0]}\`. React with :white_check_mark: if you do have an 8/8 mystic on another account`)
                    let reactionCollector = new Discord.ReactionCollector(prompt, dmReactionFilter);
                    await prompt.react('✅')
                    reactionCollector.on('collect', (r, u) => {
                        this.mystics.push(u)
                        u.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
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
            let DirectMessage = await u.send(`You reacted as <${botSettings.emote.Brain}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => { if (r.message == 'Cannot send messages to this user') this.dylanBotCommands.send(`<@!${u.id}> tried to react with <${botSettings.emote.Brain}> but their DMs are private`) });

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.brains.length > 2 || this.brains.includes(u)) return;
                this.brains.push(u);
                u.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
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
    async useNitro(u, index) {
        let reactor = this.message.guild.members.cache.get(u.id);
        if (this.earlyLocation.includes(u)) {
            reactor.send(`The location for this run has been set to \`${this.location}\``);
            return;
        }
        if (reactor.roles.highest.position >= this.leaderOnLeave.position) {
            reactor.send(`The location for this run has been set to \`${this.location}\``);
            this.earlyLocation.push(u);
            return;
        }
        if (this.nitro.length + 1 > this.settings.numerical.nitrocount) return;
        if (reactor.roles.cache.has(this.nitroBooster.id)) {
            if (reactor.voice.channel && reactor.voice.channel.id == this.channel.id) {
                reactor.send('Nitro has changed and only gives garunteed spot in VC. You are already in the VC so this use hasn\'t been counted').catch(er => this.dylanBotCommands.send(`<@!${u.id}> tried to react with <${botSettings.emote.shard}> but their DMs are private`))
            } else {
                await this.db.query(`SELECT * FROM users WHERE id = '${u.id}'`, async (err, rows) => {
                    if (err) ErrorLogger.log(err, bot)
                    if (rows.length == 0) return await this.db.query(`INSERT INTO users (id) VALUES('${u.id}')`)
                    if (Date.now() - this.settings.numerical.nitrocooldown > parseInt(rows[0].lastnitrouse)) {
                        //reactor.send(`The location for this run has been set to \`${this.location}\``);
                        //this.earlyLocation.push(u);
                        reactor.voice.setChannel(this.channel.id).catch(er => { reactor.send('Please join a voice channel to get moved in') })
                        this.nitro.push(u)
                        if (this.leaderEmbed.fields[index].value == `None yet!`) this.leaderEmbed.fields[index].value = `<@!${u.id}> `;
                        else this.leaderEmbed.fields[index].value += `, <@!${u.id}>`
                        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        this.db.query(`UPDATE users SET lastnitrouse = '${Date.now()}' WHERE id = ${u.id}`)
                    } else {
                        let lastUse = Math.round((Date.now() - rows[0].lastnitrouse) / 60000)
                        reactor.send(`Nitro perks have been limited to once an hour. Your last use was \`${lastUse}\` minutes ago`).catch(er => this.dylanBotCommands.send(`<@!${u.id}> tried to react with <${botSettings.emote.shard}> but their DMs are private`))
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
        this.db.query(`SELECT points FROM users WHERE id = '${u.id}'`, async (err, rows) => {
            if (err) return
            if (rows.length == 0) return this.db.query(`INSERT INTO users (id) VALUES('${u.id}')`)
            if (rows[0].points < this.settings.points.earlylocation) return
            pointEmbed.setDescription(`You currently have \`${rows[0].points}\` points\nEarly location costs \`${this.settings.points.earlylocation}\``)
            let dms = await u.createDM().catch()
            let m = await dms.send(pointEmbed).catch(er => this.dylanBotCommands.send(`<@!${u.id}> tried to react with 🎟️ but their DMs are private`))
            let reactionCollector = new Discord.ReactionCollector(m, (r, u) => !u.bot && (r.emoji.name == '❌' || r.emoji.name == '✅'))
            reactionCollector.on('collect', async (r, u) => {
                if (r.emoji.name == '❌') m.delete()
                else if (r.emoji.name == '✅') {
                    let er, success = true
                    let leftOver = await points.buyEarlyLocaton(u, this.db, this.settings).catch(r => { er = r; success = false })
                    if (success) {
                        await dms.send(`The location for this run has been set to \`${this.location}\`\nYou now have \`${leftOver}\` points left over`).catch(er => this.dylanBotCommands.send(`<@!${u.id}> tried to react with 🎟️ but their DMs are private`))
                        if (this.leaderEmbed.fields[index].value == 'None yet!') this.leaderEmbed.fields[index].value = `<@!${u.id}>`
                        else this.leaderEmbed.fields[index].value += `, <@!${u.id}>`
                        this.earlyLocation.push(u)
                        await this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        await this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                        await m.delete()
                    }
                    else dms.send(`There was an issue using the points: \`${er}\``)(er => this.dylanBotCommands.send(`<@!${u.id}> tried to react with 🎟️ but their DMs are private`))
                }
            })
            await m.react('✅')
            await m.react('❌')
        })
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
            if (!member.voice.channel) continue;
            if (member.voice.channel.name == 'lounge' || member.voice.channel.name == 'Veteran Lounge' || member.voice.channel.name.includes('drag')) {
                await member.voice.setChannel(this.channel.id).catch(er => { });
            }
        }
        for (let i in this.nitro) {
            let u = this.nitro[i];
            let member = this.message.guild.members.cache.get(u.id);
            if (!member.voice.channel) continue;
            if (member.voice.channel.name == 'lounge' || member.voice.channel.name == 'Veteran Lounge' || member.voice.channel.name.includes('drag')) {
                await member.voice.setChannel(this.channel.id).catch(er => { });
            }
        }
    }
    async endAfk() {
        //stop reaction collectors and timers
        this.mainReactionCollector.stop();
        this.panelReactionCollector.stop();
        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        //lock channel
        await this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: true })
        if (!this.isVet) {
            setTimeout(() => this.channel.setPosition(this.afkChannel.position), 1000)
        }

        //update embeds/messages
        if (this.key != null) this.embedMessage
            .setDescription(`This afk check has been ended.\nThank you to <@!${this.key.id}> for popping a <${botSettings.emote.LostHallsKey}> for us!\nIf you get disconnected during the run, **JOIN LOUNGE** *then* DM me \`join\` to get back in`)
            .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        else this.embedMessage
            .setDescription(`This afk check has been ended.\nIf you get disconnected during the run, **JOIN LOUNGE** *then* DM me \`join\` to get back in`)
            .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)

        this.leaderEmbed.setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        this.afkCheckEmbed.edit('', this.embedMessage).catch(er => ErrorLogger.log(er, bot))
            .then(this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot)))
            .then(this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot)))
            .then(this.afkControlPanelCommands.reactions.removeAll())

        //reset global variable
        if (this.isVet) activeVetRun = false;
        else activeRun = false;

        //store afk check information
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

        //send embed to history
        let historyEmbed = new Discord.MessageEmbed()
            .setColor(this.embedMessage.hexColor)
            .setTitle(this.embedMessage.author.name)
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
            if (this.key) {
                let points = this.settings.points.keypop
                if (this.message.guild.members.cache.get(this.key.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${this.key.id}'`)
            }
            //vial point logging
            if (this.vials.length > 0) {
                this.vials.forEach(async u => {
                    let points = this.settings.points.vialpop
                    if (this.message.guild.members.cache.get(u.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                    await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u.id}'`)
                })
            }
            //rusher point logging
            if (this.vials.length > 0) {
                this.vials.forEach(async u => {
                    let points = this.settings.points.rushing
                    if (this.message.guild.members.cache.get(u.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                    await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u.id}'`)
                })
            }
            //mystic point logging
            if (this.vials.length > 0) {
                this.vials.forEach(async u => {
                    let points = this.settings.points.mystic
                    if (this.message.guild.members.cache.get(u.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                    await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u.id}'`)
                })
            }
            //brain point logging
            if (this.vials.length > 0) {
                this.vials.forEach(async u => {
                    let points = this.settings.points.brain
                    if (this.message.guild.members.cache.get(u.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                    await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u.id}'`)
                })
            }
        }

        //log run 1 minute after afk check
        setTimeout(() => {
            if (this.channel.members.size != 0) {
                let query = `UPDATE users SET `
                if (this.run == 1) query = query.concat('cultRuns = cultRuns + 1 WHERE ')
                else query = query.concat('voidRuns = voidRuns + 1 WHERE ')
                this.channel.members.each(m => query = query.concat(`id = '${m.id}' OR `))
                query = query.substring(0, query.length - 4)
                this.db.query(query, err => {
                    if (err) ErrorLogger.log(err, bot)
                })
                if (this.settings.backend.points) {
                    //give points to everyone in run
                    let regular = []
                    let nitros = []
                    this.channel.members.each(m => {
                        if (m.roles.cache.has(this.nitroBooster.id)) nitros.push(m)
                        else regular.push(m)
                    })
                    //regular raiders point logging
                    let regularQuery = `UPDATE users SET points = points + ${this.settings.points.perrun} WHERE `
                    regular.forEach(m => regularQuery = regularQuery.concat(`id = '${m.id}' OR `))
                    regularQuery = regularQuery.substring(0, regularQuery.length - 4)
                    this.db.query(regularQuery, err => { if (err) ErrorLogger.log(err, bot) })
                    //nitro raiders point logging
                    let nitroQuery = `UPDATE users SET points = points + ${this.settings.points.perrun * this.settings.points.nitromultiplier} WHERE `
                    regular.forEach(m => nitroQuery = nitroQuery.concat(`id = '${m.id}' OR `))
                    nitroQuery = nitroQuery.substring(0, nitroQuery.length - 4)
                    this.db.query(nitroQuery, err => { if (err) ErrorLogger.log(err, bot) })
                }
            }
            if (this.key) {
                this.db.query(`UPDATE users SET keypops = keypops + 1 WHERE id = '${this.key.id}'`)
                keyRoles.checkUser(this.message.guild.members.cache.get(this.key.id), bot, this.db)
            }
        }, 1000)
    }
    async abortAfk() {
        this.mainReactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        await this.channel.updateOverwrite(this.verifiedRaiderRole.id, { CONNECT: false, VIEW_CHANNEL: false })
        setTimeout(() => this.channel.setPosition(this.channel.parent.children.filter(c => c.type == 'voice').size - 1), 1000)

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
        if (this.leaderEmbed) {
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
        }

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
        let channel = await template.clone()
        setTimeout(() => channel.setParent(message.guild.channels.cache.filter(c => c.type == 'category').find(c => c.name.toLowerCase() === parent)), 1000)
        setTimeout(() => channel.setPosition(0), 2000)
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
        let m = await vibotChannels.send(`${message.member}`, embed)
        await m.react('❌')
        setTimeout(() => { Channels.watchMessage(m, bot, settings) }, 5000)
        if (!channel) rej('No channel was made')
        res(channel);
    })

}
//React functions
async function cultReact(message, settings) {
    try {
        message.react(botSettings.emote.LostHallsKey)
            .then(message.react(botSettings.emote.Warrior))
            .then(message.react(botSettings.emote.Paladin))
            .then(message.react(botSettings.emote.Knight))
            .then(message.react(botSettings.emote.TomeofPurification))
            .then(message.react(botSettings.emote.MarbleSeal))
            .then(message.react(botSettings.emote.Plane))
            .then(message.react(botSettings.emote.shard))
        if (settings.backend.points) await message.react('🎟️')
        await message.react('❌')
    } catch (er) { ErrorLogger.log(er, bot) }
}
async function voidReact(message, settings) {
    try {
        message.react(botSettings.emote.LostHallsKey)
            .then(message.react(botSettings.emote.Vial))
            .then(message.react(botSettings.emote.Warrior))
            .then(message.react(botSettings.emote.Paladin))
            .then(message.react(botSettings.emote.Knight))
            .then(message.react(botSettings.emote.TomeofPurification))
            .then(message.react(botSettings.emote.MarbleSeal))
            .then(message.react(botSettings.emote.shard))
        if (settings.backend.points) await message.react('🎟️')
        await message.react('❌')
    } catch (er) { ErrorLogger.log(er, bot) }
}
async function fsvReact(message, settings) {
    try {
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
        if (settings.backend.points) await message.react('🎟️')
        await message.react('❌')
    } catch (er) { ErrorLogger.log(er, bot) }
}

//reaction filters
const keyXFilter = (r, u) => (r.emoji.name === '❌' || r.emoji.name === '🔑') && !u.bot;
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;
const cultFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Plane || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌' || r.emoji.name === '🎟️'
const voidFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌' || r.emoji.name === '🎟️'
const fsvFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.id === botSettings.emoteIDs.mystic || r.emoji.id === botSettings.emoteIDs.brain || r.emoji.name === '❌' || r.emoji.name === '🎟️'