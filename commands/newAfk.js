//imports
const botSettings = require('../settings.json');
const Discord = require('discord.js');

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
        message.channel.send("Feature coming soon:tm:")
        return;
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
                message.channel.send("There is already a run active. If this is an error, do \`;allowrun\`");
                return;
            }
        } else {
            if (activeRun == true) {
                message.channel.send("There is already a run active. If this is an error, do \`;allowrun\`");
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
        if (isVet) {
            currentVet = new afk(args[0], run, location, message, isVet);
            currentVet.start();
        } else {
            currentReg = new afk(args[0], run, location, message, isVet);
            currentReg.start();
        }
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
        this.time = botSettings.afkTimeLimit;
        this.voiceChannel
        this.verifiedRaiderRole;
        this.postTime = 20;
        this.earlyLocation = [];
        this.raider = [];
    }

    async start() {
        //variables
        if (!this.isVet) {
            this.voiceChannel = this.message.guild.channels.cache.find(c => c.name == `raiding-${this.channel}` || c.name == `raiding-${this.channel} <--Join Now!`);
            this.verifiedRaiderRole = this.message.guild.roles.cache.find(r => r.name === 'Verified Raider');
        } else if (this.isVet) {
            this.voiceChannel = this.message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${this.channel}` || c.name == `Veteran Raiding ${this.channel} <--Join Now!`);
            this.verifiedRaiderRole = this.message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        } else return;
        if (this.channel == null) {
            this.message.channel.send("Could not find channel correctly, please try again");
            return;
        }

        //begin afk check
        switch (this.run) {
            case 1: //cult
                this.afkCheckEmbed = await this.raidStatus.send(`@here A \`Cult\` afk will be starting in 5 seconds by ${this.message.member}. Prepare to join raiding \`${this.voiceChannel.name}\``).catch(er => console.log(er));
                setTimeout(await this.cult(), 5000)
                break;
            case 2: //void
                this.afkCheckEmbed = await this.raidStatus.send(`@here A \`Void\` afk will be starting in 5 seconds by ${this.message.member}. Prepare to join raiding \`${this.voiceChannel.name}\``).catch(er => console.log(er));
                setTimeout(this.voidd(), 5000)
                break;
            case 3: //full skip
                this.afkCheckEmbed = await this.raidStatus.send(`@here A \`Full-Skip Void\` afk will be starting in 5 seconds by ${this.message.member}. Prepare to join raiding \`${this.voiceChannel.name}\``).catch(er => console.log(er));
                setTimeout(this.fsv(), 5000)
                break;
            default:
                console.log(`Run type error`);
                return;
        }
    }

    async cult() {
        try {
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
                .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds | ${this.raiders} Raiders`);
            this.afkCheckEmbed.edit(this.embedMessage);

            await unlockChannel(this.verifiedRaiderRole, this.voiceChannel, this.channel, this.isVet)

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

            this.afkControlPanelInfo = await this.dylanBotInfo.send(this.leaderEmbed).catch(er => console.log(er));
            this.afkControlPanelCommands = await this.dylanBotCommands.send(this.leaderEmbed).catch(er => console.log(er));

            this.myReactionCollector = new Discord.ReactionCollector(this.afkCheckEmbed, cultFilter);

            this.myReactionCollector.on("collect", (r, u) => {
                if (u.bot) return;
                let reactor = this.message.guild.members.cache.get(u.id);
                //key
                if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                    if (this.key != null) return;
                    this.conefirmKy(u, r);
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
                        this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => console.log(er));
                        this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => console.log(er));
                        this.earlyLocation.push(u);
                    }
                }
                if (r.emoji.name == '❌') {
                    if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
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
                    if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Almost Raid Leader").position) return;
                    this.endedBy = u;
                    this.abortAfk();
                }
            });

        } catch (er) {
            console.log(er);
            return;
        }
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
                this.brainCount++;
                this.brains[this.brainCount - 1] = u;
                if (this.brains.includes(u)) return;
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

    async voidd() {

    }

    async fsv() {

    }
}

async function unlockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber} <--Join Now!`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(75).catch(r => console.log(r));
    }
    if (!isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`raiding-${voiceChannelNumber} <--Join Now!`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(75).catch(r => console.log(r));
    }
    return;
}
async function lockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber}`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(75).catch(r => console.log(r));
    }
    if (!isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`raiding-${voiceChannelNumber}`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(75).catch(r => console.log(r));
    }
    return;
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
        .catch(err => console.log(err));
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
        .catch(err => console.log(err));
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
        .catch(err => console.log(err));
}

//reaction filters
const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot;
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;
const cultFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Plane || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const voidFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.name === '❌'
const fsvFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey || r.emoji.id === botSettings.emoteIDs.Vial || r.emoji.id === botSettings.emoteIDs.shard || r.emoji.id === botSettings.emoteIDs.mystic || r.emoji.id === botSettings.emoteIDs.brain || r.emoji.name === '❌'
