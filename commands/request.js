const botSettings = require('../settings.json')
const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'request',
    description: 'In the event someone fake reacts, simply use this command and a message will be send to raid-status/vet-status where a new key/vial can react and get sent location',
    alias: 'rq',
    role: 'Almost Raid Leader',
    args: '<channel number> <key/vial/brian/mystic/rusher> [Location]',
    async execute(message, args, bot) {
        if (message.channel.name === 'dylanbot-commands') {
            isVet = false;
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
        if (!isVet) {
            var voiceChannel = message.guild.channels.cache.find(c => c.name == `raiding-${args[0]}` || c.name == `raiding-${args[0]} <--Join Now!`);
            var verifiedRaiderRole = message.guild.roles.cache.find(r => r.name === 'Verified Raider');
        } else {
            var voiceChannel = message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${args[0]}` || c.name == `Veteran Raiding ${args[0]} <--Join Now!`);
            var verifiedRaiderRole = message.guild.roles.cache.find(r => r.name === 'Veteran Raider');
        }
        if (isVet) var raidStatus = message.guild.channels.cache.find(c => c.name === "veteran-status-announcements");
        else var raidStatus = message.guild.channels.cache.find(c => c.name === "raid-status-announcements");
        var location = "";
        for (i = 2; i < args.length; i++) {
            location = location.concat(args[i]) + ' ';
        }
        location = location.trim();
        if (location == '') {
            message.channel.send("Add a location and try again")
            return;
        }
        var requestMessage = await raidStatus.send('@here')
        let embed = new Discord.MessageEmbed()
            .setAuthor(`Requested by ${message.member.nickname} in ${voiceChannel.name}`, `${message.author.avatarURL()}`)
            .setTimestamp()
        switch (args[1].charAt(0).toLowerCase()) {
            case 'k':
                embed.setDescription(`A key has been requested for \`${voiceChannel.name}\`
                React with <${botSettings.emote.LostHallsKey}>`)
                requestMessage.react(botSettings.emoteIDs.LostHallsKey)
                var ReactionFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey && !u.bot;
                break;
            case 'v':
                break;
            case 'r':
                break;
            case 'm':
                break;
            case 'b':
                break;
        }
        requestMessage.edit(embed)
        var reactionCollector = new Discord.ReactionCollector(requestMessage, ReactionFilter);
        var recieved = false;
        reactionCollector.on("collect", (r, u) => {
            if (r.emoji.id === botSettings.emoteIDs.LostHallsKey) {
                if (!recieved) {
                    confirmKey(u, r)
                }
            }
        })
        async function confirmKey(u, r) {
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
                if (recieved) return;
                recieved = true;
                dm.send(`The location for this run has been set to \`${location}\`, get there and confirm key with ${message.member.nickname}`);
                message.channel.send(`<@!${u.id}> has been given location`)
                let user = message.guild.members.cache.get(u.id)
                try {
                    user.edit({ channel: voiceChannel });
                } catch (er) {
                    message.channel.send("There was an issue moving them in. Most likely they aren't connect to a voice channel")
                }
                embed.setDescription(`Thank you to ${user} for bringing a <${botSettings.emote.LostHallsKey}>`)
                requestMessage.edit('', embed);
                dmReactionCollector.stop();
            });
        }
        async function confirmVial(u, r) {
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
        async function confirmRush(u, r) {
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
        async function confirmMystic(u, r) {
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
        async function confirmBrain(u, r) {
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
    }
}
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;