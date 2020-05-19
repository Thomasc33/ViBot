//imports
const botSettings = require('../settings.json');
const Discord = require('discord.js');
const ErrorLogger = require('../logError')

//globals
var activeVetRun = false;
var activeRun = false;
var currentReg;
var currentVet;
var bot;

module.exports = {
    name: 'newafk',
    description: 'The new version of the afk check',
    args: '<channel> <c/v/fsv> <location>',
    role: 'Almost Raid Leader',
    async execute(message, args, bott) {
        bot = bott
        var isVet = false;
        if (message.channel.name === 'dylanbot-commands') {
            if (args[0] > botSettings.voiceChannelCount || args[0] == 0) {
                message.channel.send("Channel Number Invalid. Please try again");
                return;
            }
        } else if (message.channel.name === 'veteran-bot-commands') {
            isVet = true;
            if (args[0] > botSettings.vetVoiceChannelCount || args[0] == 0) {
                message.channel.send("Channel Number Invalid. Please try again");
                return;
            }
        } else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) return;
        if (args.length < 2) {
            message.channel.send("Command entered incorrectly -> ;afk <channel #> <c/v/fsv> <location>");
            return;
        }

        //checks for active run
        if (isVet) {
            if (activeVetRun == true) {
                message.channel.send("There is already a run active. If this is an error, do \`;allownewrun\`");
                return;
            }
        } else {
            if (activeRun == true) {
                message.channel.send("There is already a run active. If this is an error, do \`;allownewrun\`");
                return;
            }
        }

        let run = 0;
        switch (args[1].charAt(0).toLowerCase()) {
            case 'c':
                run = 1;
                break;
            case 'v':
                run = 2;
                break;
            case 'f':
                run = 3;
                break;
            default:
                message.channel.send("Command entered incorrectly -> ;afk <channel #> <c/v/fsv> <location>");
                return;
        }
        let location = "";
        for (i = 2; i < args.length; i++) {
            location = location.concat(args[i]) + ' ';
        }
        location = location.trim();
        if (location.length >= 1024) {
            message.channel.send('Location must be below 1024 characters, try again');
        }
        message.channel.send("Channel is being cleaned. AFK check will begin when cleaned")
        currentReg = new afk(args[0], run, location, message, isVet);
        if (isVet) {
            await cleanChannel(message.guild.channels.cache.find(c => c.name === `Veteran Raiding ${args[0]}` || c.name === `Veteran Raiding ${args[0]} <-- Join!`), message.guild.channels.cache.find(c => c.name === 'Veteran Lounge'), message);
            message.channel.send('Channel cleaning successful. Beginning afk check in 10 seconds')
            setTimeout(beginRun, 10000, true)
        } else {
            await cleanChannel(message.guild.channels.cache.find(c => c.name === `raiding-${args[0]}` || c.name === `raiding-${args[0]} <-- Join!`), message.guild.channels.cache.find(c => c.name === 'lounge'), message);
            message.channel.send('Channel cleaning successful. Beginning afk check in 10 seconds')
            setTimeout(beginRun, 10000, false)
        }
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
    if (isVet) {
        currentVet.start();
    } else {
        currentReg.start();
    }
}

class afk {
    constructor(channel, run, location, message, isVet) {
        this.channel = channel;
        this.run = run;
        this.location = location;
        this.message = message;
        this.isVet = isVet;
        if (this.isVet) this.raidStatus = this.message.guild.channels.cache.find(c => c.name === "veteran-status-announcements");
        else this.raidStatus = this.message.guild.channels.cache.find(c => c.name === "raid-status-announcements");
        if (this.isVet) this.dylanBotCommands = this.message.guild.channels.cache.find(c => c.name === "veteran-bot-commands");
        else this.dylanBotCommands = this.message.guild.channels.cache.find(c => c.name === "dylanbot-commands");
        if (this.isVet) activeVetRun = true;
        else activeRun = true;
        this.afkChannel = message.guild.channels.cache.find(c => c.name === 'afk');
        this.dylanBotInfo = message.guild.channels.cache.find(c => c.name === "dylanbot-info");
        this.officialRusher = message.guild.roles.cache.find(r => r.name === 'Official Rusher');
        this.nitroBooster = message.guild.roles.cache.find(r => r.name === "Nitro Booster");
        this.leaderOnLeave = message.guild.roles.cache.find(r => r.name === 'Leader on Leave');
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
        if (isVet) {
            this.voiceChannel = message.guild.channels.cache.find(c => c.name === `Veteran Raiding ${channel}` || c.name === `Veteran Raiding ${channel} <-- Join!`)
        } else {
            this.voiceChannel = message.guild.channels.cache.find(c => c.name === `raiding-${channel}` || c.name === `raiding-${channel} <-- Join!`)
        }
        this.verifiedRaiderRole;
        this.postTime = 20;
        this.earlyLocation = [];
        this.raider = [];
        this.sendMessage();
    }

    async sendMessage() {
        switch (this.run) {
            case 1: //cult
                this.afkCheckEmbed = await this.raidStatus.send(`@here A \`Cult\` afk will be starting in 10 seconds by ${this.message.member}. Prepare to join raiding \`${this.voiceChannel.name}\`. **You do not need to react to anything**`).catch(er => ErrorLogger.log(er, bot));
                break;
            case 2: //void
                this.afkCheckEmbed = await this.raidStatus.send(`@here A \`Void\` afk will be starting in 10 seconds by ${this.message.member}. Prepare to join raiding \`${this.voiceChannel.name}\`. **You do not need to react to anything**`).catch(er => ErrorLogger.log(er, bot));
                break;
            case 3: //full skip
                this.afkCheckEmbed = await this.raidStatus.send(`@here A \`Full-Skip Void\` afk will be starting in 10 seconds by ${this.message.member}. Prepare to join raiding \`${this.voiceChannel.name}\`. **You do not need to react to anything**`).catch(er => ErrorLogger.log(er, bot));
                break;
            default: return;
        }
    }

    async start() {
        //variables
        if (!this.isVet) {
            this.voiceChannel = this.message.guild.channels.cache.find(c => c.name == `raiding-${this.channel}` || c.name == `raiding-${this.channel} <-- Join!`);
            this.verifiedRaiderRole = this.message.guild.roles.cache.find(r => r.name === 'Verified Raider');
        } else if (this.isVet) {
            this.voiceChannel = this.message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${this.channel}` || c.name == `Veteran Raiding ${this.channel} <-- Join!`);
            this.verifiedRaiderRole = this.message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        } else return;
        if (this.channel == null) {
            this.message.channel.send("Could not find channel correctly, please try again");
            return;
        }

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
            .setAuthor(`Cult Started by ${this.message.member.nickname} in ${this.voiceChannel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name**
                If you have a key react with <${botSettings.emote.LostHallsKey}>
                To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
                If you plan on rushing, react with the <${botSettings.emote.Plane}>
                If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
                To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        this.afkCheckEmbed.edit(this.embedMessage);

        await unlockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet)

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        cultReact(this.afkCheckEmbed);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle(`AFK Check control panel for \`${this.voiceChannel.name}\``)
            .setFooter(`To abort the afk check, react with ❌ below.`)
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
                if (this.nitroCount + 1 > 5) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitroCount] = u;
                    this.nitroCount++;
                    if (this.leaderEmbed.fields[3].value == `None yet!`) {
                        this.leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[3].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
                this.endedBy = u;
                this.endAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌');
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, cultFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
                this.endedBy = u;
                this.abortAfk();
            }
        });

    }

    async voidd() {
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setAuthor(`Void Started by ${this.message.member.nickname} in ${this.voiceChannel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.voidd}>
            If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
            To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
            If you are a ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
            To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        this.afkCheckEmbed.edit(this.embedMessage);

        await unlockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet)

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        voidReact(this.afkCheckEmbed);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setTitle(`AFK Check control panel for \`${this.voiceChannel.name}\``)
            .setFooter(`To abort the afk check, react with ❌ below.`)
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
            //raider
            if (r.emoji.id === botSettings.emoteIDs.voidd) {
                this.raiders++;
                this.raider.push(reactor);
                if (this.isVet) var channel = this.message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${this.channel}` || c.name == `Veteran Raiding ${this.channel} <--Join Now!`);
                else var channel = this.message.guild.channels.cache.find(c => c.name == `raiding-${this.channel}` || c.name == `raiding-${this.channel} <--Join Now!`);
                reactor.edit({ channel: channel }).catch(er => { });
            }
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
                if (this.nitroCount + 1 > 10) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitroCount] = u;
                    this.nitroCount++;
                    if (this.leaderEmbed.fields[3].value == `None yet!`) {
                        this.leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[3].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
                this.endedBy = u;
                this.endAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌');
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, cultFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
                this.endedBy = u;
                this.abortAfk();
            }
        });
    }

    async fsv() {
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setAuthor(`Full Skip Void Started by ${this.message.member.nickname} in ${this.voiceChannel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.SkipBoi}>
            If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
            To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
            If you have 80+ MHeal and a 8/8 Mystic, react with <${botSettings.emote.Mystic}>
            If you are an 8/8 trickster with a brain, react with <${botSettings.emote.Brain}>
            If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
            To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
        this.afkCheckEmbed.edit(this.embedMessage);

        await unlockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet)

        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        fsvReact(this.afkCheckEmbed);

        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setTitle(`AFK Check control panel for \`${this.voiceChannel.name}\``)
            .setFooter(`To abort the afk check, react with ❌ below.`)
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
            //raider
            if (r.emoji.id === botSettings.emoteIDs.voidd) {
                this.raiders++;
                this.raider.push(reactor);
                if (this.isVet) var channel = this.message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${this.channel}` || c.name == `Veteran Raiding ${this.channel} <--Join Now!`);
                else var channel = this.message.guild.channels.cache.find(c => c.name == `raiding-${this.channel}` || c.name == `raiding-${this.channel} <--Join Now!`);
                reactor.edit({ channel: channel }).catch(er => { });
            }
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
                if (this.brainCount + 1 > 3) return;
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
                if (this.nitroCount + 1 > 10) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitroCount] = u;
                    this.nitroCount++;
                    if (this.leaderEmbed.fields[5].value == `None yet!`) {
                        this.leaderEmbed.fields[5].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[5].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
                this.endedBy = u;
                this.endAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌');
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, cultFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
                this.endedBy = u;
                this.abortAfk();
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
            if (this.key != null)
                return;
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
        });
    }
    async confirmVial(u, r) {
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
            let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.Mystic}>. Press :white_check_mark: to confirm. Ignore this message otherwise`);

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.mystics.length > 2 || this.mystics.includes(u)) return;
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
                if (this.brainCount > 2 || this.brains.includes(u)) return;
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
            this.endAFK();
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
            member.edit({ channel: this.voiceChannel }).catch(er => { });
        }
    }
    async endAfk() {
        this.mainReactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        lockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet);

        if (this.key != null) {
            this.embedMessage.setDescription(`This afk check has been ended.
        Thank you to <@!${this.key.id}> for popping a <${botSettings.emote.LostHallsKey}> for us!`)
                .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        } else {
            this.embedMessage.setDescription(`This afk check has been ended.`)
                .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        }

        this.afkCheckEmbed.edit('', this.embedMessage).catch(er => ErrorLogger.log(er, bot))

        if (this.isVet) activeVetRun = false;
        else activeRun = false;
    }
    async abortAfk() {
        this.mainReactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        lockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet);

        this.embedMessage.setDescription(`This afk check has been aborted`)
            .setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)

        this.afkCheckEmbed.edit('', this.embedMessage).catch(er => ErrorLogger.log(er, bot))

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

async function unlockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            .then(voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber} <-- Join!`).catch(r => ErrorLogger.log(er, bot)))
            .then(voiceChannel.setUserLimit(75).catch(r => ErrorLogger.log(er, bot)));
    }
    if (!isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            .then(voiceChannel.setName(`raiding-${voiceChannelNumber} <-- Join!`).catch(r => ErrorLogger.log(er, bot)))
            .then(voiceChannel.setUserLimit(75).catch(r => ErrorLogger.log(er, bot)));
    }
    return;
}
async function lockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            .then(voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber}`).catch(r => ErrorLogger.log(er, bot)))
    }
    if (!isVet) {
        voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => ErrorLogger.log(er, bot))
            .then(voiceChannel.setName(`raiding-${voiceChannelNumber}`).catch(r => ErrorLogger.log(er, bot)))
    }
    return;
}
async function cleanChannel(channel, lounge, message) {
    var vcUsers = channel.members.array()
    for (let i in vcUsers) {
        let u = vcUsers[i];
        if (u.roles.highest.position < message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) {
            try {
                await u.setVoiceChannel(lounge)
            } catch (er) { }
        }
    }
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
const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot;
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;
const cultFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Plane || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const voidFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const fsvFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.id === botSettings.emoteIDs.mystic || r.emoji.id === botSettings.emoteIDs.brain || r.emoji.name === '❌'