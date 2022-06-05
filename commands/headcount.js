const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError')
const afkCheck = require('./afkCheck')
const eventAfk = require('./eventAfk')
const eventFile = require('../data/events.json')

var bot
module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    requiredArgs: 1,
    args: '<run type>',
    getNotes(guildid, member) {
        return `**Run Types:**\n*Regular Afk Checks:*\n${afkCheck.getNotes(guildid, member)}\n*Events:*\nSee \`;events\``
    },
    role: 'eventrl',
    async execute(message, args, bott) {
        //settings
        let settings = bott.settings[message.guild.id]
        if (![settings.categories.raiding, settings.categories.event, settings.categories.veteran].includes(message.channel.parent.name.toLowerCase())) return message.channel.send("Try again in a correct category");
        if (!bot) bot = bott;

        let symbol = args[0].charAt(0).toLowerCase();
        if (symbol == 'a' && args[0].length > 1)
            symbol += args[0].charAt(1).toLowerCase();
        const runType = afkCheck.getRunType(symbol, message.guild.id)
        const eventTypes = eventAfk.getMatchingEvents(args[0], eventFile, message.guild.id)
        if (runType && message.channel.parent.name.toLowerCase() != settings.categories.event) {
            if (settings.backend.exaltsInRSA)
                eventTypes.push(runType)
            else return hallsHC()
        }
        if (!eventTypes.length) return message.channel.send('Run Type not recognized')
        if (eventTypes.length == 1) {
            if (eventTypes[0] == runType) hallsHC();
            else eventHC(eventTypes[0]);
        } else {
            const id = "" + Math.random();
            let selection = new Discord.MessageEmbed()
                .setAuthor(`Select HC Type`)
                .setDescription(`There are multiple headcounts that match the type given. Please select one.`)
            const row = new Discord.MessageActionRow().addComponents(
                new Discord.MessageSelectMenu()
                    .setCustomId(id)
                    .setPlaceholder('Select a Type')
                    .addOptions(eventTypes.map(type => {
                        return { label: type.runName || type.name, value: type.runName || type.name }
                    })));

            const msg = await message.channel.send({ embeds: [selection], components: [row] });
            msg.awaitMessageComponent({ filter: i => i.isSelectMenu() && i.customId == id && i.user.id == message.author.id }).then(i => {
                i.deferUpdate();
                msg.delete();
                const val = i.values[0]
                if (!val) return;
                const evt = eventTypes.filter(e => e.name == val || e.runName == val)[0]
                if (!evt) return;
                if (evt == runType) hallsHC()
                else eventHC(evt)
            })
        }

        async function hallsHC() {
            let channel;
            if (message.channel.parent.name.toLowerCase() == settings.categories.raiding) channel = message.guild.channels.cache.get(settings.channels.raidstatus)
            else if (message.channel.parent.name.toLowerCase() == settings.categories.veteran) channel = message.guild.channels.cache.get(settings.channels.vetstatus)
            if (channel) {
                let embed = new Discord.MessageEmbed()
                    .setAuthor(`Headcount for ${runType.runName} by ${message.member.nickname}`)
                    .setDescription(`${runType.headcountEmote ? `React with ${bot.emojis.cache.get(runType.headcountEmote)} if you are coming\n` : ''}React with ${bot.emojis.cache.get(runType.keyEmoteID)} if you have a key\nOtherwise react with your gear/class choices below`)
                    .setColor(runType.embed.color)
                    .setTimestamp()

                if (symbol.charAt(0) == 'a')
                    embed.description += `\n\n**__Advanced Runs__**\nThis is an **advanced run**, meaning there are extended requirements you **MUST** meet. You must be both **__8/8__** and follow the requirements sheet listed in the afk check.\n\nIf you are caught not meeting these requirements, you will be removed from the run and suspended.`;

                if (message.author.avatarURL()) embed.author.iconURL = message.author.avatarURL()
                const pingRole = runType.pingRole || runType.rolePing;
                const pings = pingRole ? (typeof pingRole != "string" ? pingRole.map(r => `<@&${settings.roles[r]}>`).join(' ') : `<@&${settings.roles[pingRole]}>`) + ' @here' : '@here';

                let m = await channel.send({ content: `${pings}`, embeds: [embed] , components: []})
                if (runType.headcountEmote)
                    m.react(runType.headcountEmote)
                await m.react(runType.keyEmoteID)
                if (runType.vialReact) await m.react(botSettings.emoteIDs.Vial)
                for (let i of runType.earlyLocationReacts) await m.react(i.emoteID)
                for (let i of runType.reacts) await m.react(i)
                
                this.hcInteractionCollector = new Discord.InteractionCollector(this.bot, { message: m, interactionType: 'MESSAGE_COMPONENT', componentType: 'BUTTON' })
                this.leaderInteractionCollector.on('collect', (interaction) => this.interactionHandler(interaction))
            }
        }

        async function eventHC(event) {
            return new Promise(async (res, rej) => {
                if (!event) return rej('No event found')
                if (!event.enabled) return rej(`${event.name} is currently disabled.`);
                let channel;
                if (message.channel.parent.name.toLowerCase() == settings.categories.veteran) channel = message.guild.channels.cache.get(settings.channels.vetstatus)
                else if (message.channel.parent.name.toLowerCase() == settings.categories.event) channel = message.guild.channels.cache.get(settings.channels.eventstatus)
                else if (settings.backend.exaltsInRSA && message.channel.parent.name.toLowerCase() == settings.categories.raiding) channel = message.guild.channels.cache.get(isNaN(settings.channels.exaltstatus) ? settings.channels.raidstatus : settings.channels.exaltstatus)
                if (!channel) return rej('Try a different category to run this under');

                if (event.name.toLowerCase() == 'random') { // to do
                    var embed = new Discord.MessageEmbed()
                        .setColor(event.color || '#8c00ff')
                        .setTitle(`Headcount for ${event.name} started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                        .setDescription(`React with with emotes below to indicate what you have`)
                        .setTimestamp(Date.now())
                        .addField('Participate', `<${event.portalEmote}>`, true)
                        .addField('Key', `<${event.keyEmote}>`, true);
                    if (event.rushers) embed.addField('Rushers', `<${botSettings.emote.Plane}>`, true)
                    if (event.stun) embed.addField('Stun', `<${botSettings.emote.Collo}>`, true)
                    if (event.ogmur) embed.addField('(P)ogmur', `<${botSettings.emote.Ogmur}>`, true)
                    if (event.fungal) embed.addField('Fungal Tome', `<${botSettings.emote.UTTomeoftheMushroomTribes}>`, true)
                    if (event.mseal) embed.addField('Mseal', `<${botSettings.emote.MarbleSeal}>`, true)
                    if (event.brain) embed.addField('Decoy', `<${botSettings.emote.Brain}>`, true)
                    if (event.stasis) embed.addField('Mystic', `<${botSettings.emote.Mystic}>`, true)
                    if (event.parylize) embed.addField('Paralyze', `<${botSettings.emote.Paralyze}>`, true)
                    if (event.slow) embed.addField('Slow', `<${botSettings.emote.Slow}>`, true)
                    if (event.daze) embed.addField('Daze', `<${botSettings.emote.Qot}>`, true)
                    if (event.curse) embed.addField('Curse', `<${botSettings.emote.Curse}>`, true)
                    if (event.expose) embed.addField('Expose', `<${botSettings.emote.Expose}>`, true)
                    if (event.warrior) embed.addField('Warrior', `<${botSettings.emote.Warrior}>`, true)
                    if (event.paladin) embed.addField('Paladin', `<${botSettings.emote.Paladin}>`, true)
                    if (event.bard) embed.addField('Bard', `<${botSettings.emote.Bard}>`, true)
                    if (event.priest) embed.addField('Priest', `<${botSettings.emote.Priest}>`, true)
                    if (event.aether) embed.addField('Aether Orb', `<${botSettings.emote.UTOrbofAether}>`, true)
                    var embedMessage = await textChannel.send({ content: `@here ${event.rolePing ? `${settings.roles[event.rolePing] ? `<@&${settings.roles[event.rolePing]}>` : ''}` : ''}`, embeds: [embed] });
                    for (let i of event.earlyLocationReacts) await embedMessage.react(i.emoteID)
                    await eventReact(embedMessage, event);
                    res()
                }
                else if (event.name.toLowerCase() == 'exalts') {
                    var embed = new Discord.MessageEmbed()
                        .setColor('#8c00ff')
                        .setTitle(`Headcount for ${event.name} started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                        .setDescription(`React with with emotes below to indicate what you have`)
                        .setTimestamp(Date.now())
                        .addField('Nests', `To participate: <:nest:723001215407095899>\nIf you have a key: <:nestK:723001429693956106>`)
                        .addField('Fungals', `To participate: <:fungal:723001215696240660>\nIf you have a key: <:fungalK:723001429614395402>`)
                        .addField('Shatters', `To participate: <:shatters:723001214865899532>\nIf you have a key: <:shattersK:723001429903802478>`)
                    let embedMessage = await channel.send({ content: `@here ${settings.roles.shattsReact ? `<@&${settings.roles.shattsReact}> ` : ''}${settings.roles.fungalReact ? `<@&${settings.roles.fungalReact}> ` : ''}${settings.roles.nestReact? `<@&${settings.roles.nestReact}>` : ''}`, embeds: [embed] })
                    await embedMessage.react('723001215407095899')
                    await embedMessage.react('723001215696240660')
                    await embedMessage.react('723001214865899532')
                    await embedMessage.react('723001429693956106')
                    await embedMessage.react('723001429614395402')
                    await embedMessage.react('723001429903802478')
                } else {
                    var embed = new Discord.MessageEmbed()
                        .setColor('#8c00ff')
                        .setTitle(`Headcount for ${event.name} started by ${message.guild.members.cache.get(message.author.id).nickname}`)
                        .setDescription(`React with with emotes below to indicate what you have`)
                        .setTimestamp(Date.now())
                        .addField('Participate', `<${event.portalEmote}>`, true)
                        .addField('Key', `<${event.keyEmote}>`, true);
                    if (event.rushers) embed.addField('Rushers', `<${botSettings.emote.Plane}>`, true)
                    if (event.stun) embed.addField('Stun', `<${botSettings.emote.Collo}>`, true)
                    if (event.ogmur) embed.addField('(P)ogmur', `<${botSettings.emote.Ogmur}>`, true)
                    if (event.fungal) embed.addField('Fungal Tome', `<${botSettings.emote.UTTomeoftheMushroomTribes}>`, true)
                    if (event.mseal) embed.addField('Mseal', `<${botSettings.emote.MarbleSeal}>`, true)
                    if (event.brain) embed.addField('Decoy', `<${botSettings.emote.Brain}>`, true)
                    if (event.stasis) embed.addField('Mystic', `<${botSettings.emote.Mystic}>`, true)
                    if (event.parylize) embed.addField('Paralyze', `<${botSettings.emote.Paralyze}>`, true)
                    if (event.slow) embed.addField('Slow', `<${botSettings.emote.Slow}>`, true)
                    if (event.daze) embed.addField('Daze', `<${botSettings.emote.Qot}>`, true)
                    if (event.curse) embed.addField('Curse', `<${botSettings.emote.Curse}>`, true)
                    if (event.expose) embed.addField('Expose', `<${botSettings.emote.Expose}>`, true)
                    if (event.warrior) embed.addField('Warrior', `<${botSettings.emote.Warrior}>`, true)
                    if (event.paladin) embed.addField('Paladin', `<${botSettings.emote.Paladin}>`, true)
                    if (event.bard) embed.addField('Bard', `<${botSettings.emote.Bard}>`, true)
                    if (event.priest) embed.addField('Priest', `<${botSettings.emote.Priest}>`, true)
                    var embedMessage = await channel.send({ content: `@here ${event.rolePing ? `${settings.roles[event.rolePing] ? `<@&${settings.roles[event.rolePing]}>` : ''}` : ''}`, embeds: [embed] });
                    await eventReact(embedMessage, event);
                    res()
                }
            })
        }

        // add indicator that command was a success
        message.react('✅')
    }
}

async function eventReact(pingMessage, event) {
    await pingMessage.react(event.portalEmojiId)
    await pingMessage.react(event.keyEmojiId)
    if (event.rushers) await pingMessage.react(botSettings.emoteIDs.Plane)
    if (event.stun) await pingMessage.react(botSettings.emoteIDs.Collo)
    if (event.ogmur) await pingMessage.react(botSettings.emoteIDs.Ogmur)
    if (event.fungal) await pingMessage.react(botSettings.emoteIDs.UTTomeoftheMushroomTribes)
    if (event.mseal) await pingMessage.react(botSettings.emoteIDs.MarbleSeal)
    if (event.brain) await pingMessage.react(botSettings.emoteIDs.brain)
    if (event.stasis) await pingMessage.react(botSettings.emoteIDs.mystic)
    if (event.parylize) await pingMessage.react(botSettings.emoteIDs.Paralyze)
    if (event.slow) await pingMessage.react(botSettings.emoteIDs.Slow)
    if (event.daze) await pingMessage.react(botSettings.emoteIDs.Qot)
    if (event.curse) await pingMessage.react(botSettings.emoteIDs.Curse)
    if (event.expose) await pingMessage.react(botSettings.emoteIDs.Expose)
    if (event.warrior) await pingMessage.react(botSettings.emoteIDs.Warrior)
    if (event.paladin) await pingMessage.react(botSettings.emoteIDs.Paladin)
    if (event.bard) await pingMessage.react(botSettings.emoteIDs.Bard)
    if (event.priest) await pingMessage.react(botSettings.emoteIDs.Priest)
    if (event.aether) await pingMessage.react(botSettings.emoteIDs.UTOrbofAether)
}