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
    name: 'oldafk',
    alias: ['ofk', 'oafk'],
    description: 'Old Style Afk Check',
    requiredArgs: 2,
    args: '<channel> <c/v/fsv> <location>',
    role: 'almostrl',
    execute(message, args, bott, db) {
        let settings = bott.settings[message.guild.id]
        bot = bott
        if (message.channel.parent.name.toLowerCase() === 'raiding') var isVet = false;
        else if (message.channel.parent.name.toLowerCase() === 'veteran raiding') var isVet = true;
        else return message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
        if (args.length < 2) return message.channel.send("Command entered incorrectly -> ;ofk <channel #> <c/v/fsv> <location>");
        //checks for active run
        if (isVet && activeVetRun) return message.channel.send("There is already a run active. If this is an error, do \`;allowoldrun\`");
        else if (!isVet && activeRun) return message.channel.send("There is already a run active. If this is an error, do \`;allowoldrun\`");
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
                message.channel.send("Command entered incorrectly -> ;ofk <channel #> <c/v/fsv> <location>");
                return;
        }
        let location = "";
        for (i = 2; i < args.length; i++) location = location.concat(args[i]) + ' ';
        location = location.trim();
        if (location == '') location = 'None!'
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (isVet) {
            currentVet = new afk(args[0], run, location, message, isVet, db, settings);
            currentVet.start();
        } else {
            currentReg = new afk(args[0], run, location, message, isVet, db, settings);
            currentReg.start();
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
    },
    checkRun(isVet) {
        if (isVet) return activeVetRun;
        else activeRun;
    }
}

class afk {
    constructor(channel, run, location, message, isVet, db, settings) {
        this.settings = settings
        this.channel = channel;
        this.run = run;
        this.location = location;
        this.message = message;
        this.db = db;
        this.isVet = isVet;
        if (this.isVet) this.raidStatus = this.message.guild.channels.cache.get(settings.channels.vetstatus)
        else this.raidStatus = this.message.guild.channels.cache.get(settings.channels.raidstatus)
        if (this.isVet) this.dylanBotCommands = this.message.guild.channels.cache.get(settings.channels.vetcommands)
        else this.dylanBotCommands = this.message.guild.channels.cache.get(settings.channels.raidcommands)
        if (this.isVet) this.verifiedRaiderRole = this.message.guild.roles.cache.get(settings.roles.vetraider)
        else this.verifiedRaiderRole = this.message.guild.roles.cache.get(settings.roles.raider)
        if (this.isVet) activeVetRun = true;
        else activeRun = true;
        if (this.isVet) this.voiceChannel = this.message.guild.channels.cache.find(c => c.name.includes(`${this.settings.voiceprefixes.vetprefix}${this.channel}`))
        else this.voiceChannel = this.message.guild.channels.cache.find(c => c.name.includes(`${this.settings.voiceprefixes.raidingprefix}${this.channel}`))
        this.staffRole = message.guild.roles.cache.get(settings.roles.almostrl)
        this.afkChannel = message.guild.channels.cache.get(settings.voice.afk)
        this.dylanBotInfo = message.guild.channels.cache.get(settings.channels.runlogs)
        this.officialRusher = message.guild.roles.cache.get(settings.roles.rusher)
        this.nitroBooster = message.guild.roles.cache.get(settings.roles.nitro)
        this.leaderOnLeave = message.guild.roles.cache.get(settings.roles.lol)
        this.minutes;
        this.seconds;
        this.raiders = 0
        this.raiderArray = []
        this.nitro = []
        this.key = null
        this.vials = []
        this.rushers = []
        this.nitroCount = 0
        this.rusherCount = 0
        this.vialCount = 0
        this.endedBy
        this.mystics = []
        this.mysticCount = 0
        this.brains = []
        this.brainCount = 0;
        this.time = settings.numerical.afktime
        this.postTime = 20;
        this.earlyLocation = [];
        this.raider = [];
    }
    async start() {
        if (this.channel == null) return this.message.channel.send("Could not find channel correctly, please try again");
        await unlockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet, this.settings)

        //begin afk check
        switch (this.run) {
            case 1: //cult
                this.cult();
                break;
            case 2: //void
                this.void();
                break;
            case 3: //full skip
                this.fsv();
                break;
            default:
                console.log(`Run type error`);
                return;
        }
    }
    async cult() {
        //Raid status message
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.pingingMessage = `@here \`Cult\` started by ${this.message.member} in \`${this.voiceChannel.name}\``;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setAuthor(`Cult Started by ${this.message.member.nickname} in ${this.voiceChannel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.malus}>
            If you have a key react with <${botSettings.emote.LostHallsKey}>
            To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
            If you plan on rushing, react with the <${botSettings.emote.Plane}>
            If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
            To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds | ${this.raiders} Raiders`);
        this.afkCheckEmbed = await this.raidStatus.send(this.pingingMessage).catch(er => console.log(er));
        this.afkCheckEmbed.edit(this.embedMessage);

        //add reactions
        cultReact(this.afkCheckEmbed);

        this.icon = botSettings.emote.malus;


        //bot-info message
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

        this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => console.log(er));
        this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => console.log(er));

        //start timer
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        //watch reactions
        this.myReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, cultFilter);
        this.myReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            //raider
            if (r.emoji.id === botSettings.emoteIDs.malus) {
                this.raiders++;
                this.raider.push(reactor);
                reactor.voice.setChannel(this.voiceChannel.id).catch(er => { })
            }
            //key
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (this.key != null) return;
                this.confirmKey(u, r);
            }
            //rusher
            if (r.emoji.id === botSettings.emoteIDs.Plane) {
                if (!reactor.roles.cache.has(this.officialRusher.id)) {
                    reactor.send(`Only Verified Rushers get early location`);
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
                if (reactor.roles.highest.position >= this.leaderOnLeave.position) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.earlyLocation.push(u);
                    return;
                }
                if (this.nitroCount + 1 > this.settings.numerical.nitrocount) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitroCount] = u;
                    this.nitroCount++;
                    if (this.leaderEmbed.fields[3].value == `None yet!`) {
                        this.leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[3].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.postAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌');
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, cultFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.abortAfk();
            }
        });
    }
    async void() {
        //raid status panel
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.pingingMessage = `@here \`Void\` started by ${this.message.member} in \`\`${this.voiceChannel.name}\``;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#2f075c')
            .setAuthor(`Void Started by ${this.message.member.nickname} in ${this.voiceChannel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.voidd}>
If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
If you are a ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds | ${this.raiders} Raiders`);
        this.afkCheckEmbed = await bot.channels.cache.get(this.raidStatus.id).send(this.pingingMessage).catch(er => console.log(er));
        this.afkCheckEmbed.edit(this.embedMessage);

        //add reacts
        voidReact(this.afkCheckEmbed);

        this.icon = botSettings.emote.voidd;

        //bot-info message
        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#2f075c')
            .setTitle(`AFK Check control panel for \`${this.voiceChannel.name}\``)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current vials`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            )
            .setFooter(`To abort the afk check, react with ❌ below.`);
        this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => console.log(er));
        this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => console.log(er));

        //start timer
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        //watch reactions
        this.myReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, voidFilter);
        this.myReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            //raider
            if (r.emoji.id === botSettings.emoteIDs.voidd) {
                this.raiders++;
                this.raider.push(reactor);
                reactor.voice.setChannel(this.voiceChannel.id).catch(er => { })
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
                if (this.nitroCount + 1 > this.settings.numerical.nitrocount) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitroCount] = u;
                    this.nitroCount++;
                    if (this.leaderEmbed.fields[3].value == `None yet!`) {
                        this.leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[3].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.postAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌')
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, xFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.abortAfk();
            }
        });
    }
    async fsv() {
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.pingingMessage = `@here \`Fullskip Void\` started by ${this.message.member} in \`${this.voiceChannel.name}\``;
        this.embedMessage = new Discord.MessageEmbed()
            .setColor('#2f075c')
            .setAuthor(`Fullskip Void Started by ${this.message.member.nickname} in ${this.voiceChannel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.SkipBoi}>
        If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
        To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
        If you have 80+ MHeal and a 8/8 Mystic, react with <${botSettings.emote.Mystic}>
        If you are an 8/8 trickster with a brain, react with <${botSettings.emote.Brain}>
        If you have the role ${`<@&${this.nitroBooster.id}>`} react with <${botSettings.emote.shard}>
        To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds | ${this.raiders} Raiders`);
        this.afkCheckEmbed = await bot.channels.cache.get(this.raidStatus.id).send(this.pingingMessage).catch(er => console.log(er));
        this.afkCheckEmbed.edit(this.embedMessage);

        //add reacts
        fsvReact(this.afkCheckEmbed);

        this.icon = botSettings.emote.SkipBoi;

        //bot-info message
        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor('#2f075c')
            .setTitle(`AFK Check control panel for \`${this.voiceChannel.name}\``)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current vials`, value: `None yet!` },
                { name: `Our current tricksters`, value: `None yet!` },
                { name: `Our current mystics`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            )
            .setFooter(`To abort the afk check, react with ❌ below.`);
        this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => console.log(er));
        this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => console.log(er));

        //start timer
        this.timer = await setInterval(() => { this.updateAfkCheck() }, 5000);

        //watch reactions
        this.myReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, fsvFilter);
        this.myReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            //raider
            if (r.emoji.id === botSettings.emoteIDs.SkipBoi) {
                this.raiders++;
                this.raider.push(reactor);
                reactor.voice.setChannel(this.voiceChannel.id).catch(er => { })
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
                if (this.nitroCount + 1 > this.settings.numerical.nitrocount) return;
                if (reactor.roles.cache.has(this.nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${this.location}\``);
                    this.nitro[this.nitroCount] = u;
                    this.nitroCount++;
                    if (this.leaderEmbed.fields[5].value == `None yet!`) {
                        this.leaderEmbed.fields[5].value = `<@!${u.id}> `;
                    } else this.leaderEmbed.fields[5].value += `, <@!${u.id}>`
                    this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                    this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                    this.earlyLocation.push(u);
                }
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.postAfk();
            }
        });

        //afk panel reaction collector
        this.afkControlPanelCommands.react('❌')
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, xFilter);

        this.panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = this.message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u;
                this.abortAfk();
            }
        });
    }
    async updateAfkCheck() {
        this.time = this.time - 5;
        if (this.time == 0) {
            this.endedBy = bot.user;
            this.postAfk();
            return;
        }
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        if (this.embedMessage == null) return;
        this.embedMessage.setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds | ${this.raiders} Raiders`);
        this.afkCheckEmbed.edit(this.embedMessage).catch(er => console.log(er));
    }
    async confirmKey(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                console.log(`Someones pm's are private`);
                clearInterval(endAfter);
                return;
            }
        }, 60000)
        let dm = await u.createDM().catch(r => console.log(r)).catch(er => console.log(er));
        let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.LostHallsKey}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => console.log(r));

        let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
        await DirectMessage.react("✅");
        dmReactionCollector.on("collect", (r, u) => {
            if (this.key != null)
                return;
            this.key = u;
            dm.send(`The location for this run has been set to \`${this.location}\`, get there and confirm key with ${this.message.member.nickname}`);
            console.log(`${u.tag} confirmed key`);
            if (this.leaderEmbed.fields[0].value == `None yet!`) {
                this.leaderEmbed.fields[0].value = `<${botSettings.emote.LostHallsKey}>: <@!${u.id}>`;
            } else this.leaderEmbed.fields[0].value += `\n<${botSettings.emote.LostHallsKey}>: ${`<@!${u.id}>`}`;
            this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
            this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
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
                console.log(`Someones pm's are private`);
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
                if (this.vialCount > 2) return;
                if (this.vials.includes(u)) return;
                this.vialCount++;
                this.vials[this.vialCount - 1] = u;
                dm.send(`The location for this run has been set to \`${this.location}\`, get there and confirm vial with ${this.message.member.nickname}`);
                console.log(`${u.tag} confirmed vial`);
                if (this.leaderEmbed.fields[1].value == `None yet!`) {
                    this.leaderEmbed.fields[1].value = `<${botSettings.emote.Vial}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[1].value += `\n<${botSettings.emote.Vial}>: ${`<@!${u.id}>`}`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) {
            console.log(`Couldn't pm someone, pm's are private`);
        }
    }
    async confirmRush(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                console.log(`Someones pm's are private`);
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
                if (this.rusherCount + 1 > 3) return;
                if (this.rushers.includes(u)) return;
                this.rushers[this.rusherCount] = u;
                this.rusherCount++;
                dm.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
                console.log(`${u.tag} confirmed rusher`);
                if (this.leaderEmbed.fields[1].value == `None yet!`) {
                    this.leaderEmbed.fields[1].value = `<${botSettings.emote.Plane}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[1].value += `\n<${botSettings.emote.Plane}>: ${`<@!${u.id}>`}`;
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) {
            console.log(`Couldn't pm someone, pm's are private`);
        }
    }
    async confirmMystic(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                console.log(`Someones pm's are private`);
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
                if (this.mysticCount > 2) return;
                if (this.mystics.includes(u)) return;
                this.mysticCount++;
                this.mystics[this.mysticCount - 1] = u;
                dm.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
                console.log(`${u.tag} confirmed mystic`);
                if (this.leaderEmbed.fields[3].value == `None yet!`) {
                    this.leaderEmbed.fields[3].value = `<${botSettings.emote.Mystic}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[3].value += `\n<${botSettings.emote.Mystic}>: ${`<@!${u.id}>`}`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) {
            console.log(`Couldn't pm someone, pm's are private`);
        }
    }
    async confirmBrain(u, r) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                console.log(`Someones pm's are private`);
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
                if (this.brainCount > 2) return;
                if (this.brains.includes(u)) return;
                this.brainCount++;
                this.brains[this.brainCount - 1] = u;
                dm.send(`The location for this run has been set to \`${this.location}\`, get there asap`);
                console.log(`${u.tag} confirmed brain`);
                if (this.leaderEmbed.fields[2].value == `None yet!`) {
                    this.leaderEmbed.fields[2].value = `<${botSettings.emote.Brain}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[2].value += `\n<${botSettings.emote.Brain}>: ${`<@!${u.id}>`}`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) {
            console.log(er)
            console.log(`Couldn't pm someone, pm's are private`);
        }
    }
    async postAfk() {
        //stop main timer
        clearInterval(this.timer);

        //stops panel reaction collector
        this.panelReactionCollector.stop();

        //change filter on main reaction collector
        this.myReactionCollector.filter = endFilter;

        //move out people
        this.voiceChannel.members.each(u => {
            if (!this.raider.includes(u)) {
                let reactor = this.message.guild.members.cache.get(u.id)
                if (reactor.roles.highest.position >= this.leaderOnLeave.position) return;
                reactor.edit({ channel: this.afkChannel }).catch(er => { });
            }
        });

        //allow runs
        if (this.isVet) activeVetRun = false;
        else activeRun = false;

        //start post afk timer
        this.timer = await setInterval(() => { this.updatePost() }, 5000);

        //lock vc
        await lockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet, this.settings);

        //post afk check embed
        this.embedMessage.setDescription(`__**Post AFK Move-in**__
        If you got moved out of vc, or missed the afk check:
        **1.** Join lounge
        **2** React with <${this.icon}> to get moved in.
        __Time Remaining:__ ${this.postTime} seconds.`)
            .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`);

        this.afkCheckEmbed.edit("", this.embedMessage).catch(er => console.log(er));
    }
    async updatePost() {
        this.postTime -= 5;
        if (this.postTime == 0) {
            this.endAFK();
            return;
        }
        this.embedMessage.setDescription(`__**Post AFK Move-in**__
        If you got moved out of vc, or missed the afk check:
        **1.** Join lounge
        **2** React with <${this.icon}> to get moved in.
        __Time Remaining:__ ${this.postTime} seconds.`);
        this.afkCheckEmbed.edit("", this.embedMessage).catch(er => console.log(er));
    }
    async endAFK() {
        //Stops reaction collector
        this.myReactionCollector.stop();

        //Stops timer
        clearInterval(this.timer);

        //update panel
        this.embedMessage.setDescription(`The AFK Check has ended.
        We are running with ${this.raiders} raiders.`)

        this.afkCheckEmbed.edit(this.embedMessage).catch(er => console.log(er));

        //Update afk control panel
        this.leaderEmbed.setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`);
        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));

        //allow runs
        if (this.isVet) activeVetRun = false;
        else activeRun = false;

        //send embed to history
        let raiders = []
        this.voiceChannel.members.array().forEach(m => raiders.push(m.id))
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
            //rusher point logging
            if (this.rushers.length > 0) {
                this.rushers.forEach(async u => {
                    let points = this.settings.points.rushing
                    if (this.message.guild.members.cache.get(u.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                    await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u.id}'`)
                })
            }
            //mystic point logging
            if (this.mystics.length > 0) {
                this.mystics.forEach(async u => {
                    let points = this.settings.points.mystic
                    if (this.message.guild.members.cache.get(u.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                    await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u.id}'`)
                })
            }
            //brain point logging
            if (this.brains.length > 0) {
                this.brains.forEach(async u => {
                    let points = this.settings.points.brain
                    if (this.message.guild.members.cache.get(u.id).roles.cache.has(this.nitroBooster.id)) points = points * this.settings.points.nitromultiplier
                    await this.db.query(`UPDATE users SET points = points + ${points} WHERE id = '${u.id}'`)
                })
            }
        }

        //log key
        if (this.key) {
            this.db.query(`UPDATE users SET keypops = keypops + 1 WHERE id = '${this.key.id}'`)
            keyRoles.checkUser(this.message.guild.members.cache.get(this.key.id), bot, this.db)
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
                    if (this.settings.points.perrun != 0) {
                        let regularQuery = `UPDATE users SET points = points + ${this.settings.points.perrun} WHERE `
                        regular.forEach(m => regularQuery = regularQuery.concat(`id = '${m.id}' OR `))
                        regularQuery = regularQuery.substring(0, regularQuery.length - 4)
                        this.db.query(regularQuery, err => { if (err) ErrorLogger.log(err, bot) })
                        //nitro raiders point logging
                        let nitroQuery = `UPDATE users SET points = points + ${this.settings.points.perrun * this.settings.points.nitromultiplier} WHERE `
                        nitros.forEach(m => nitroQuery = nitroQuery.concat(`id = '${m.id}' OR `))
                        nitroQuery = nitroQuery.substring(0, nitroQuery.length - 4)
                        this.db.query(nitroQuery, err => { if (err) ErrorLogger.log(err, bot) })
                    }
                }
            }
        }, 60000)
    }
    async abortAfk() {
        //Stops reaction collector
        this.myReactionCollector.stop();
        this.panelReactionCollector.stop();

        //Stops timer
        clearInterval(this.timer);

        //Update panel
        this.embedMessage.setDescription(`The AFK Check has been aborted.`)
            .setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`);
        this.afkCheckEmbed.edit("", this.embedMessage).catch(er => console.log(er));

        //lock vc
        await lockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet, this.settings);

        //Update afk control panel
        this.leaderEmbed.setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`);
        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));

        //allow runs
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

//React functions
async function cultReact(message) {
    message.react(botSettings.emote.malus)
        .then(message.react(botSettings.emote.LostHallsKey))
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .then(message.react(botSettings.emote.Plane))
        .then(message.react(botSettings.emote.shard))
        .then(message.react('❌'))
        .catch(err => console.log(err));
}
async function voidReact(message) {
    message.react(botSettings.emote.voidd)
        .then(message.react(botSettings.emote.LostHallsKey))
        .then(message.react(botSettings.emote.Vial))
        .then(message.react(botSettings.emote.Warrior))
        .then(message.react(botSettings.emote.Paladin))
        .then(message.react(botSettings.emote.Knight))
        .then(message.react(botSettings.emote.TomeofPurification))
        .then(message.react(botSettings.emote.MarbleSeal))
        .then(message.react(botSettings.emote.shard))
        .then(message.react('❌'))
        .catch(err => console.log(err));
}
async function fsvReact(message) {
    message.react(botSettings.emote.SkipBoi)
        .then(message.react(botSettings.emote.LostHallsKey))
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
        .catch(err => console.log(err));
}
async function unlockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet, settings) {
    if (isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`${settings.voiceprefixes.vetprefix}${voiceChannelNumber} <-- Join!`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(0).catch(r => console.log(r));
    }
    if (!isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`${settings.voiceprefixes.raidingprefix}${voiceChannelNumber} <-- Join!`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(0).catch(r => console.log(r));
    }
    return;
}
async function lockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet, settings) {
    if (isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`${settings.voiceprefixes.vetprefix}${voiceChannelNumber}`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(99).catch(r => console.log(r));
    }
    if (!isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`${settings.voiceprefixes.raidingprefix}${voiceChannelNumber}`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(99).catch(r => console.log(r));
    }
    return;
}

//reaction filters
const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot;
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;
const cultFilter = (r, u) => r.emoji.id == botSettings.emoteIDs.malus || r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Plane || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const voidFilter = (r, u) => r.emoji.id == botSettings.emoteIDs.voidd || r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const fsvFilter = (r, u) => r.emoji.id == botSettings.emoteIDs.SkipBoi || r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.id === botSettings.emoteIDs.mystic || r.emoji.id === botSettings.emoteIDs.brain || r.emoji.name === '❌'
const endFilter = (r, u) => r.emoji.id == botSettings.emoteIDs.SkipBoi || r.emoji.id == botSettings.emoteIDs.voidd || r.emoji.id == botSettings.emoteIDs.malus;