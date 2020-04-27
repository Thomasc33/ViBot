//imports
const botSettings = require('./../settings.json');
const Discord = require('discord.js');

//globals
var activeVetRun = false;
var activeRun = false;
var currentReg;
var currentVet;

module.exports = {
    name: 'afk',
    description: 'Afk Check',
    execute(message, args) {
        var isVet = false;
        var raidLeaderRole = message.guild.roles.cache.find(r => r.name === "Almost Raid Leader");
        var aRaidLeaderRole = message.guild.roles.cache.find(r => r.name === "Raid Leader");
        if (message.channel.name === 'dylanbot-commands') {
            isVet = false;
            if (args[0] > botSettings.voiceChannelCount) {
                message.channel.send("Channel Number Invalid. Please try again");
                return;
            }
        } else if (message.channel.name === 'veteran-bot-commands') {
            isVet = true;
            if (args[0] > botSettings.vetVoiceChannelCount) {
                message.channel.send("Channel Number Invalid. Please try again");
                return;
            }
        } else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (!(message.member.roles.cache.has(raidLeaderRole.id) || message.member.roles.cache.has(aRaidLeaderRole.id))) return;
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) return;
        if (args.length < 2) {
            message.channel.send("Command entered incorrectly -> ;afk <channel #> <c/v/fsv> <location>");
            return;
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
        for (i = 3; i < args.length; i++) {
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
        this.raidStatus = getRaidStatus(message, isVet);
        this.dylanBotCommands = getCommandChannel(message, isVet);
        this.dylanBotInfo = message.guild.channels.cache.find(c => c.name === "dylanbot-info");
        this.officialRusher = message.guild.roles.cache.find(r => r.name === 'Official Rusher');
        this.nitroBooster = message.guild.roles.cache.find(r => r.name === "Nitro Booster");
        this.aRaidLeaderRole = message.guild.roles.cache.find(r => r.name === "Almost Raid Leader");
        this.raidLeaderRole = message.guild.roles.cache.find(r => r.name === "Raid Leader");
        this.leaderOnLeave = message.guild.roles.cache.find(r => r.name === 'Leader on Leave');
        this.minutes;
        this.seconds;
        this.time = botSettings.afkTimeLimit;
        this.raiders = 0
        this.nitro = {}
        this.key = null
        this.vials = {}
        this.rushers = {}
        this.nitroCount = 0
        this.rusherCount = 0
        this.vialCount = 0
        this.endedBy
        this.mystics = {}
        this.mysticCount = 0
        this.brains = {}
        this.brainCount = 0;

        this.channel
        this.verifiedRaiderRole;
    }

    start() {
        //start timer
        this.timer = setInterval(this.updateAfkCheck(), 5000);
        //variables
        location = tempLocation;

        if (!isVet) {
            voiceChannel = message.guild.channels.cache.find(c => c.name == `raiding-${channel}` || c.name == `raiding-${channel} <--Join Now!` || c.name == `shatters-${channel}` || c.name == `shatters-${channel} <--Join Now!`);
            verifiedRaiderRole = message.guild.roles.cache.find(r => r.name === 'Verified Raider');
        } else if (isVet) {
            voiceChannel = message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${channel}` || c.name == `Veteran Raiding ${channel} <--Join Now!` || c.name == `Veteran Shatters ${channel}` || c.name == `Veteran Shatters ${channel} <--Join Now!`);
            verifiedRaiderRole = message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        } else return;
        if (channel == null) {
            message.channel.send("Could not find channel correctly, please try again");
            return;
        }
        unlockChannel(verifiedRaiderRole, voiceChannel, channel, isVet)

        //begin afk check
        switch (run) {
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
        minutes = Math.floor(time / 60);
        seconds = time % 60;
        var pingingMessage = `@here \`Cult\` started by ${message.member} in \`${voiceChannel.name}\``;
        var embedMessage = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setAuthor(`Cult Started by ${message.member.nickname} in ${voiceChannel.name}`, `${message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.malus}>
If you have a key react with <${botSettings.emote.LostHallsKey}>
To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
If you plan on rushing, react with the <${botSettings.emote.Plane}>
If you have the role ${`<@&${nitroBooster.id}>`} react with <${botSettings.emote.shard}>
To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${minutes} minutes and ${seconds} seconds | ${raiders} Raiders`);
        var afkCheckEmbed = await bot.channels.cache.get(raidStatus.id).send(pingingMessage).catch(er => console.log(er));
        afkCheckEmbed.edit(embedMessage);

        //add reactions
        cultReact(afkCheckEmbed);

        //bot-info message
        var leaderEmbed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle(`AFK Check control panel for \`${voiceChannel.name}\``)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current rushers`, value: `None yet!` },
                { name: `Location of run`, value: `${location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            )
            .setFooter(`To abort the afk check, react with ❌ below.`);
        var afkControlPanelInfo = await dylanBotInfo.send(leaderEmbed).catch(er => console.log(er));
        var afkControlPanelCommands = await dylanBotCommands.send(leaderEmbed).catch(er => console.log(er));

        //watch reactions
        var myReactionCollector = new Discord.ReactionCollector(afkCheckEmbed, cultFilter);
        myReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = message.guild.members.cache.get(u.id);
            //raider
            if (r.emoji.id === botSettings.emoteIDs.malus) {
                raiders++;
                //can add database stuff here for logging runs
            }
            //key
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (key != null) return;
                confirmKey(u, r);
            }
            //rusher
            if (r.emoji.id === botSettings.emoteIDs.Plane) {
                if (!reactor.roles.cache.has(officialRusher.id)) {
                    reactor.send(`Only Verified Rushers get early location`);
                    return;
                }
                if (rusherCount > 3) {
                    reactor.send(`Too many rushers have already received location`);
                    return;
                }
                if (reactor.roles.cache.has(officialRusher.id)) {
                    confirmRush(u, r);
                }
            }
            //nitro
            if (r.emoji.id === botSettings.emoteIDs.shard) {
                if (reactor.roles.cache.has(leaderOnLeave.id)) {
                    reactor.send(`The location for this run has been set to \`${location}\``);
                    return;
                }
                if (nitroCount + 1 > 10) return;
                if (reactor.roles.cache.has(nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${location}\``);
                    nitro[nitroCount] = u;
                    nitroCount++;
                    if (leaderEmbed.fields[3].value == `None yet!`) {
                        leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else leaderEmbed.fields[3].value = leaderEmbed.fields[3].value + `, <@!${u.id}>`
                    afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
                    afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
                }
            }
            if (r.emoji.name == '❌') {
                if (!(reactor.roles.cache.has(raidLeaderRole.id) || reactor.roles.cache.has(aRaidLeaderRole.id))) return;
                endedBy = u;
                endAFK();
            }
        });

        //afk panel reaction collector
        afkControlPanelCommands.react('❌')
        var panelReactionCollector = new Discord.ReactionCollector(afkControlPanelCommands, cultFilter);

        panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (!(reactor.roles.cache.has(raidLeaderRole.id) || reactor.roles.cache.has(aRaidLeaderRole.id))) return;
                endedBy = u;
                abortAfk();
            }
        });
    }
    async void() {
        //raid status panel
        minutes = Math.floor(time / 60);
        seconds = time % 60;
        var pingingMessage = `@here \`Void\` started by ${message.member} in \`\`${voiceChannel.name}\``;
        embedMessage = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setAuthor(`Void Started by ${message.member.nickname} in ${voiceChannel.name}`, `${message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.voidd}>
If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
If you are a ${`<@&${nitroBooster.id}>`} react with <${botSettings.emote.shard}>
To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${minutes} minutes and ${seconds} seconds | ${raiders} Raiders`);
        var afkCheckEmbed = await bot.channels.cache.get(raidStatus.id).send(pingingMessage).catch(er => console.log(er));
        afkCheckEmbed.edit(embedMessage);

        //add reacts
        voidReact(afkCheckEmbed);

        //bot-info message
        var leaderEmbed = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setTitle(`AFK Check control panel for \`${voiceChannel.name}\``)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current vials`, value: `None yet!` },
                { name: `Location of run`, value: `${location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            )
            .setFooter(`To abort the afk check, react with ❌ below.`);
        var afkControlPanelInfo = await dylanBotInfo.send(leaderEmbed).catch(er => console.log(er));
        var afkControlPanelCommands = await dylanBotCommands.send(leaderEmbed).catch(er => console.log(er));

        //watch reactions
        var myReactionCollector = new Discord.ReactionCollector(afkCheckEmbed, voidFilter);
        myReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = message.guild.members.cache.get(u.id);
            //raider
            if (r.emoji.id === botSettings.emoteIDs.voidd) {
                raiders++;
                //can add database stuff here for logging runs
            }
            //key
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (key != null) return;
                confirmKey(u, r);
            }
            //vial
            if (r.emoji.id === botSettings.emoteIDs.Vial) {
                if (vialCount + 1 > 3) return;
                confirmVial(u, r);
            }
            //nitro
            if (r.emoji.id === botSettings.emoteIDs.shard) {
                if (reactor.roles.cache.has(leaderOnLeave.id)) {
                    reactor.send(`The location for this run has been set to \`${location}\``);
                    return;
                }
                if (nitroCount + 1 > 10) return;
                if (reactor.roles.cache.has(nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${location}\``);
                    nitro[nitroCount] = u;
                    nitroCount++;
                    if (leaderEmbed.fields[3].value == `None yet!`) {
                        leaderEmbed.fields[3].value = `<@!${u.id}> `;
                    } else leaderEmbed.fields[3].value = leaderEmbed.fields[3].value + `, <@!${u.id}>`
                    afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
                    afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
                }
            }
            if (r.emoji.name == '❌') {
                if (!(reactor.roles.cache.has(raidLeaderRole.id) || reactor.roles.cache.has(aRaidLeaderRole.id))) return;
                endedBy = u;
                endAFK();
            }
        });

        //afk panel reaction collector
        afkControlPanelCommands.react('❌')
        var panelReactionCollector = new Discord.ReactionCollector(afkControlPanelCommands, xFilter);

        panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (!(reactor.roles.cache.has(raidLeaderRole.id) || reactor.roles.cache.has(aRaidLeaderRole.id))) return;
                endedBy = u;
                abortAfk();
            }
        });
    }
    async fsv() {
        minutes = Math.floor(time / 60);
        seconds = time % 60;
        var pingingMessage = `@here \`Full Skip Void\` started by ${message.member} in \`${voiceChannel.name}\``;
        embedMessage = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setAuthor(`Full Skip Void Started by ${message.member.nickname} in ${voiceChannel.name}`, `${message.author.avatarURL()}`)
            .setDescription(`To join, **connect to the raiding channel by clicking its name and react with** <${botSettings.emote.SkipBoi}>
        If you have a key or vial, react with <${botSettings.emote.LostHallsKey}> or <${botSettings.emote.Vial}>
        To indicate your class or gear choices, react with <${botSettings.emote.Warrior}> <${botSettings.emote.Paladin}> <${botSettings.emote.Knight}> <${botSettings.emote.TomeofPurification}> <${botSettings.emote.MarbleSeal}>
        If you have 80+ MHeal and a 8/8 Mystic, react with <${botSettings.emote.Mystic}>
        If you are an 8/8 trickster with a brain, react with <${botSettings.emote.Brain}>
        If you have the role ${`<@&${nitroBooster.id}>`} react with <${botSettings.emote.shard}>
        To end the AFK check as a leader, react to ❌`)
            .setTimestamp()
            .setFooter(`Time Remaining: ${minutes} minutes and ${seconds} seconds | ${raiders} Raiders`);
        var afkCheckEmbed = await bot.channels.cache.get(raidStatus.id).send(pingingMessage).catch(er => console.log(er));
        afkCheckEmbed.edit(embedMessage);

        //add reacts
        fsvReact(afkCheckEmbed);

        //bot-info message
        var leaderEmbed = new Discord.MessageEmbed()
            .setColor('#8c00ff')
            .setTitle(`AFK Check control panel for \`${voiceChannel.name}\``)
            .addFields(
                { name: `Our current key`, value: `None yet!` },
                { name: `Our current vials`, value: `None yet!` },
                { name: `Our current tricksters`, value: `None yet!` },
                { name: `Our current mystics`, value: `None yet!` },
                { name: `Location of run`, value: `${location}` },
                { name: `Nitro Boosters`, value: `None yet!` },
            )
            .setFooter(`To abort the afk check, react with ❌ below.`);
        var afkControlPanelInfo = await dylanBotInfo.send(leaderEmbed).catch(er => console.log(er));
        var afkControlPanelCommands = await dylanBotCommands.send(leaderEmbed).catch(er => console.log(er));

        //watch reactions
        var myReactionCollector = new Discord.ReactionCollector(afkCheckEmbed, fsvFilter);
        myReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = message.guild.members.cache.get(u.id);
            //raider
            if (r.emoji.id === botSettings.emoteIDs.SkipBoi) {
                raiders++;
                //can add database stuff here for logging runs
            }
            //key
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (key != null) return;
                confirmKey(u, r);
            }
            //vial
            if (r.emoji.id === botSettings.emoteIDs.Vial) {
                if (vialCount + 1 > 3) return;
                confirmVial(u, r);
            }
            //mystic
            if (r.emoji.id === botSettings.emoteIDs.mystic) {
                if (mysticCount + 1 > 3) return;
                confirmMystic(u, r);
            }
            //brain
            if (r.emoji.id === botSettings.emoteIDs.brain) {
                if (brainCount + 1 > 3) return;
                confirmBrain(u, r);
            }
            //nitro
            if (r.emoji.id === botSettings.emoteIDs.shard) {
                if (reactor.roles.cache.has(leaderOnLeave.id)) {
                    reactor.send(`The location for this run has been set to \`${location}\``);
                    return;
                }
                if (nitroCount + 1 > 10) return;
                if (reactor.roles.cache.has(nitroBooster.id)) {
                    reactor.send(`The location for this run has been set to \`${location}\``);
                    nitro[nitroCount] = u;
                    nitroCount++;
                    if (leaderEmbed.fields[5].value == `None yet!`) {
                        leaderEmbed.fields[5].value = `<@!${u.id}> `;
                    } else leaderEmbed.fields[5].value = leaderEmbed.fields[5].value + `, <@!${u.id}>`
                    afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
                    afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
                }
            }
            if (r.emoji.name == '❌') {
                if (!(reactor.roles.cache.has(raidLeaderRole.id) || reactor.roles.cache.has(aRaidLeaderRole.id))) return;
                endedBy = u;
                endAFK();
            }
        });

        //afk panel reaction collector
        afkControlPanelCommands.react('❌')
        var panelReactionCollector = new Discord.ReactionCollector(afkControlPanelCommands, xFilter);

        panelReactionCollector.on("collect", (r, u) => {
            if (u.bot) return;
            let reactor = message.guild.members.cache.get(u.id);
            if (r.emoji.name === '❌') {
                if (!(reactor.roles.cache.has(raidLeaderRole.id) || reactor.roles.cache.has(aRaidLeaderRole.id))) return;
                endedBy = u;
                abortAfk();
            }
        });
    }
    async updateAfkCheck() {
        time = time - 5;
        if (time == 0) {
            endedBy = bot.user;
            endAFK();
            return;
        }
        minutes = Math.floor(time / 60);
        seconds = time % 60;
        embedMessage.setFooter(`Time Remaining: ${minutes} minutes and ${seconds} seconds | ${raiders} Raiders`);
        afkCheckEmbed.edit(embedMessage).catch(er => console.log(er));
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
        await dmReactionCollector.on("collect", (r, u) => {
            dmReactionCollector._timeout
            if (key != null) return;
            key = u;
            dm.send(`The location for this run has been set to \`${location}\`, get there and confirm key with ${message.member.nickname}`);
            console.log(`${u.tag} confirmed key`);
            if (leaderEmbed.fields[0].value == `None yet!`) {
                leaderEmbed.fields[0].value = `<${botSettings.emote.LostHallsKey}>: <@!${u.id}>`;
            } else leaderEmbed.fields[0].value = leaderEmbed.fields[0].value + `\n<${botSettings.emote.LostHallsKey}>: ${`<@!${u.id}>`}`
            afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
            afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
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
                if (vialCount > 2) return;
                vialCount++;
                vials[vialCount - 1] = u;
                dm.send(`The location for this run has been set to \`${location}\`, get there and confirm vial with ${message.member.nickname}`);
                console.log(`${u.tag} confirmed vial`);
                if (leaderEmbed.fields[1].value == `None yet!`) {
                    leaderEmbed.fields[1].value = `<${botSettings.emote.Vial}>: <@!${u.id}>`;
                } else leaderEmbed.fields[1].value = leaderEmbed.fields[1].value + `\n<${botSettings.emote.Vial}>: ${`<@!${u.id}>`}`
                afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
                afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
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
                if (rusherCount + 1 > 3) return;
                rushers[rusherCount] = u;
                rusherCount++;
                dm.send(`The location for this run has been set to \`${location}\`, get there asap`);
                console.log(`${u.tag} confirmed rusher`);
                if (leaderEmbed.fields[1].value == `None yet!`) {
                    leaderEmbed.fields[1].value = `<${botSettings.emote.Plane}>: <@!${u.id}>`;
                } else leaderEmbed.fields[1].value += `\n<${botSettings.emote.Plane}>: ${`<@!${u.id}>`}`;
                afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
                afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
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
            let dm = await u.createDM().catch();
            let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.Mystic}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch();

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (mysticCount > 2) return;
                mysticCount++;
                mystics[mysticCount - 1] = u;
                dm.send(`The location for this run has been set to \`${location}\`, get there asap`);
                console.log(`${u.tag} confirmed mystic`);
                if (leaderEmbed.fields[3].value == `None yet!`) {
                    leaderEmbed.fields[3].value = `<${botSettings.emote.Mystic}>: <@!${u.id}>`;
                } else leaderEmbed.fields[3].value = leaderEmbed.fields[3].value + `\n<${botSettings.emote.Mystic}>: ${`<@!${u.id}>`}`
                afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
                afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
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
                if (brainCount > 2) return;
                brainCount++;
                brains[brainCount - 1] = u;
                dm.send(`The location for this run has been set to \`${location}\`, get there asap`);
                console.log(`${u.tag} confirmed brain`);
                if (leaderEmbed.fields[2].value == `None yet!`) {
                    leaderEmbed.fields[2].value = `<${botSettings.emote.Brain}>: <@!${u.id}>`;
                } else leaderEmbed.fields[2].value = leaderEmbed.fields[2].value + `\n<${botSettings.emote.Brain}>: ${`<@!${u.id}>`}`
                afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
                afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) {
            console.log(`Couldn't pm someone, pm's are private`);
        }
    }
    async endAFK() {


        //Stops reaction collector
        myReactionCollector.stop();
        panelReactionCollector.stop();

        //update panel
        embedMessage.setDescription(`The AFK Check has ended.
        We are running with ${raiders} raiders.`)
            .setFooter(`The afk check has been ended by ${message.guild.members.cache.get(endedBy.id).nickname}`);
        afkCheckEmbed.edit("", embedMessage).catch(er => console.log(er));

        //lock vc
        await lockChannel(verifiedRaiderRole, voiceChannel, channel, isVet, isShatt);

        //Update afk control panel
        leaderEmbed.setFooter(`The afk check has been ended by ${message.guild.members.cache.get(endedBy.id).nickname}`);
        afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
        afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));

        //TO:DO Move people out
        //Stops timer
        clearInterval(timer);
    }

    async abortAfk() {
        //Stops reaction collector
        myReactionCollector.stop();
        panelReactionCollector.stop();

        //Update panel
        embedMessage.setDescription(`The AFK Check has been aborted.`)
            .setFooter(`The afk check has been aborted by ${message.guild.members.cache.get(endedBy.id).nickname}`);
        afkCheckEmbed.edit("", embedMessage).catch(er => console.log(er));

        //lock vc
        await lockChannel(verifiedRaiderRole, voiceChannel, channel, isVet, isShatt);

        //Update afk control panel
        leaderEmbed.setFooter(`The afk check has been aborted by ${message.guild.members.cache.get(endedBy.id).nickname}`);
        afkControlPanelInfo.edit(leaderEmbed).catch(er => console.log(er));
        afkControlPanelCommands.edit(leaderEmbed).catch(er => console.log(er));

        //TO:DO Move people out

        //Stops timer
        clearInterval(timer);
    }
}

async function getRaidStatus(messaged, isVeteran) {
    if (isVeteran) return messaged.guild.channels.cache.find(c => c.name === "veteran-status-announcements");
    else return messaged.guild.channels.cache.find(c => c.name === "raid-status-announcements");
}
async function getCommandChannel(messaged, isVeteran) {
    if (isVeteran) return messaged.guild.channels.cache.find(c => c.name === "veteran-bot-commands");
    else return messaged.guild.channels.cache.find(c => c.name === "dylanbot-commands");
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

async function unlockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber} <--Join Now!`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(0).catch(r => console.log(r));
    }
    if (!isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`raiding-${voiceChannelNumber} <--Join Now!`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(0).catch(r => console.log(r));
    }
    return;
}

async function lockChannel(raiderRole, voiceChannel, voiceChannelNumber, isVet) {
    if (isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`Veteran Raiding ${voiceChannelNumber}`).catch(r => console.log(r));
        await voiceChannel.setUserLimit(99).catch(r => console.log(r));
    }
    if (!isVet) {
        await voiceChannel.updateOverwrite(raiderRole.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(r => console.log(r));
        await voiceChannel.setName(`raiding-${voiceChannelNumber}`).catch(r => console.log(r));
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