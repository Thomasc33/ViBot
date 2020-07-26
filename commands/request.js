const botSettings = require('../settings.json')
const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'request',
    description: 'In the event someone fake reacts, simply use this command and a message will be sent to raid-status/vet-status where a new raider can react and get sent location',
    alias: ['rq'],
    role: 'Almost Raid Leader',
    args: '<key/vial/brian/mystic/rusher> [Location]',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (message.channel.name === 'dylanbot-commands') { isVet = false; }
        else if (message.channel.name === 'veteran-bot-commands') { isVet = true; }
        else {
            message.channel.send("Try again, but in dylanbot-commands or veteran-bot-commands");
            return;
        }
        var voiceChannel = message.member.voice.channel
        if (voiceChannel == null) { message.channel.send("Channel not found. Make sure you are in a VC"); return; }
        if (isVet) var raidStatus = message.guild.channels.cache.get(settings.channels.vetstatus)
        else var raidStatus = message.guild.channels.cache.get(settings.channels.raidstatus)
        var location = "";
        for (i = 1; i < args.length; i++) {
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
        switch (args[0].charAt(0).toLowerCase()) {
            case 'k':
                embed.setDescription(`A key has been requested for \`${voiceChannel.name}\`
                React with <${botSettings.emote.LostHallsKey}>`)
                requestMessage.react(botSettings.emoteIDs.LostHallsKey)
                var ReactionFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.LostHallsKey && !u.bot;
                break;
            case 'v':
                embed.setDescription(`A vial has been requested for \`${voiceChannel.name}\`
                React with <${botSettings.emote.Vial}>`)
                    .setColor('#8c00ff')
                requestMessage.react(botSettings.emoteIDs.Vial)
                var ReactionFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.Vial && !u.bot;
                break;
            case 'r':
                embed.setDescription(`A rusher has been requested for \`${voiceChannel.name}\`
                React with <${botSettings.emote.Plane}>`)
                    .setColor('#ff0000')
                requestMessage.react(botSettings.emoteIDs.Plane)
                var ReactionFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.Plane && !u.bot;
                break;
            case 'm':
                embed.setDescription(`A Mystic has been requested for \`${voiceChannel.name}\`
                React with <${botSettings.emote.Mystic}>`)
                    .setColor('#8c00ff')
                requestMessage.react(botSettings.emoteIDs.mystic)
                var ReactionFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.mystic && !u.bot;
                break;
            case 'b':
                embed.setDescription(`A Brain has been requested for \`${voiceChannel.name}\`
                React with <${botSettings.emote.Brain}>`)
                    .setColor('#8c00ff')
                requestMessage.react(botSettings.emoteIDs.brain)
                var ReactionFilter = (r, u) => r.emoji.id === botSettings.emoteIDs.brain && !u.bot;
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
            } if (r.emoji.id === botSettings.emoteIDs.Vial) {
                if (!recieved) {
                    confirmVial(u, r)
                }
            }
            if (r.emoji.id === botSettings.emoteIDs.Plane) {
                if (!recieved) {
                    if (message.guild.members.cache.get(u.id).roles.cache.has(settings.roles.rusher)) {
                        confirmRush(u, r)
                    }
                }
            }
            if (r.emoji.id === botSettings.emoteIDs.mystic) {
                if (!recieved) {
                    confirmMystic(u, r)
                }
            }
            if (r.emoji.id === botSettings.emoteIDs.brain) {
                if (!recieved) {
                    confirmBrain(u, r)
                }
            }
        })
        async function confirmKey(u, r) {
            let endAfter = setInterval(function () {
                try {
                    dmReactionCollector.stop()
                } catch (er) { }
                clearInterval(endAfter);
                return;
            }, 60000)
            let dm = await u.createDM().catch(er => console.log(r));
            let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.LostHallsKey}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch(r => console.log(r));

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
            await DirectMessage.react("✅");
            dmReactionCollector.on("collect", (r, u) => {
                if (recieved) return;
                recieved = true;
                dm.send(`The location for this run has been set to \`${location}\`, get there and confirm key with ${message.member.nickname}`);
                message.channel.send(`<@!${u.id}> has been given location`)
                let user = message.guild.members.cache.get(u.id)
                user.edit({ channel: voiceChannel }).catch(er => message.channel.send("There was an issue moving them in. Most likely they aren't connect to a voice channel"));
                embed.setDescription(`Thank you to ${user} for bringing a <${botSettings.emote.LostHallsKey}>`)
                requestMessage.edit('', embed);
                reactionCollector.stop();
                dmReactionCollector.stop();
            });
        }
        async function confirmVial(u, r) {
            let endAfter = setInterval(function () {
                try {
                    dmReactionCollector.stop();
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
                    if (recieved) return;
                    recieved = true;
                    dm.send(`The location for this run has been set to \`${location}\`, get there and confirm vial with ${message.member.nickname}`);
                    message.channel.send(`<@!${u.id}> has been given location`)
                    let user = message.guild.members.cache.get(u.id)
                    user.edit({ channel: voiceChannel }).catch(er => message.channel.send("There was an issue moving them in. Most likely they aren't connect to a voice channel"));
                    embed.setDescription(`Thank you to ${user} for bringing a <${botSettings.emote.Vial}>`)
                    requestMessage.edit('', embed);
                    reactionCollector.stop();
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
                    clearInterval(endAfter);
                    return;
                } catch (er) {
                    clearInterval(endAfter);
                    return;
                }
            }, 60000)
            try {
                let dm = await u.createDM()
                let DirectMessage = await dm.send(`You reacted as <${botSettings.emote.Plane}>. Press :white_check_mark: to confirm. Ignore this message otherwise`);
                let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);
                await DirectMessage.react("✅");
                await dmReactionCollector.on("collect", (r, u) => {
                    if (recieved) return;
                    recieved = true;
                    dm.send(`The location for this run has been set to \`${location}\``);
                    message.channel.send(`<@!${u.id}> has been given location`)
                    let user = message.guild.members.cache.get(u.id)
                    user.edit({ channel: voiceChannel }).catch(er => message.channel.send("There was an issue moving them in. Most likely they aren't connect to a voice channel"));
                    embed.setDescription(`Thank you to ${user} for bringing a <${botSettings.emote.Plane}>`)
                    requestMessage.edit('', embed);
                    reactionCollector.stop();
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
                    if (recieved) return;
                    recieved = true;
                    dm.send(`The location for this run has been set to \`${location}\``);
                    message.channel.send(`<@!${u.id}> has been given location`)
                    let user = message.guild.members.cache.get(u.id)
                    user.edit({ channel: voiceChannel }).catch(er => message.channel.send("There was an issue moving them in. Most likely they aren't connect to a voice channel"));
                    embed.setDescription(`Thank you to ${user} for bringing a <${botSettings.emote.Mystic}>`)
                    requestMessage.edit('', embed);
                    reactionCollector.stop();
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
                    if (recieved) return;
                    recieved = true;
                    dm.send(`The location for this run has been set to \`${location}\``);
                    message.channel.send(`<@!${u.id}> has been given location`)
                    let user = message.guild.members.cache.get(u.id)
                    user.edit({ channel: voiceChannel }).catch(er => message.channel.send("There was an issue moving them in. Most likely they aren't connect to a voice channel"));
                    embed.setDescription(`Thank you to ${user} for bringing a <${botSettings.emote.Brain}>`)
                    requestMessage.edit('', embed);
                    reactionCollector.stop();
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