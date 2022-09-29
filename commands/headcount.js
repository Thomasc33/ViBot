const Discord = require('discord.js');
const botSettings = require('../settings.json');
const emojis = require('../data/emojis.json');
const ErrorLogger = require('../lib/logError');
const afkCheck = require('./afkCheck');
const eventAfk = require('./eventAfk');
const eventFile = require('../data/events.json');

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
        if (runType && (message.channel.parent.name.toLowerCase() != settings.categories.event || settings.categories.event == settings.categories.raiding)) {
            if (settings.backend.exaltsInRSA)
                eventTypes.push(runType)
            else return hallsHC(runType)
        }
        if (!eventTypes.length) return message.channel.send('Run Type not recognized')
        if (eventTypes.length == 1) {
            hallsHC(eventTypes[0]);
        } else {
            const id = "" + Math.random();
            let selection = new Discord.EmbedBuilder()
                .setAuthor({ name: `Select HC Type` })
                .setDescription(`There are multiple headcounts that match the type given. Please select one.`)
            const row = new Discord.ActionRowBuilder().addComponents(
                new Discord.SelectMenuBuilder()
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
                hallsHC(evt)
            })
        }

        async function hallsHC(run) {
            let channel;
            if (message.channel.parent.name.toLowerCase() == settings.categories.veteran) channel = message.guild.channels.cache.get(settings.channels.vetstatus)
            else if (message.channel.parent.name.toLowerCase() == settings.categories.event) channel = message.guild.channels.cache.get(settings.channels.eventstatus)
            else if (settings.backend.exaltsInRSA && message.channel.parent.name.toLowerCase() == settings.categories.raiding) channel = message.guild.channels.cache.get(isNaN(settings.channels.exaltstatus) ? settings.channels.raidstatus : settings.channels.exaltstatus)
            else if (message.channel.parent.name.toLowerCase() == settings.categories.raiding) channel = message.guild.channels.cache.get(settings.channels.raidstatus)
            if (channel) {
                let embed = new Discord.EmbedBuilder()
                    .setAuthor({ name: `Headcount for ${run.runName} by ${message.member.nickname}` })
                    .setDescription(run.embed.headcountDescription ? run.embed.headcountDescription : `${run.headcountEmote ? `React with ${bot.emojis.cache.get(run.headcountEmote)} if you are coming\n` : ''}React with ${bot.emojis.cache.get(run.keyEmoteID)} if you have a key\nOtherwise react with your gear/class choices below`)
                    .setColor(run.embed ? run.embed.color : run.color)
                    .setTimestamp()

                if (symbol.charAt(0) == 'a')
                    embed.data.description += `\n\n**__Advanced Runs__**\nThis is an **advanced run**, meaning there are extended requirements you **MUST** meet. You must be both **__8/8__** and follow the requirements sheet listed in the afk check.\n\nIf you are caught not meeting these requirements, you will be removed from the run and suspended.`;

                if (message.author.avatarURL()) embed.setAuthor({ name: `Headcount for ${run.runName} by ${message.member.nickname}`, iconURL: message.author.avatarURL() })
                const pingRole = run.pingRole || run.rolePing;
                const pings = pingRole ? (typeof pingRole != "string" ? pingRole.map(r => `<@&${settings.roles[r]}>`).join(' ') : `<@&${settings.roles[pingRole]}>`) + ' @here' : '@here';

                let m = await channel.send({ content: `${pings}`, embeds: [embed], components: [] })
                if (run.headcountEmote) await m.react(run.headcountEmote)
                if (run.keyEmoteID) await m.react(run.keyEmoteID)
                if (run.vialReact) await m.react(botSettings.emoteIDs.Vial)
                for (let i of run.earlyLocationReacts) await m.react(i.emoteID)
                for (let i of run.reacts) {
                    if (isNaN(+i)) await m.react(emojis[i]["id"])
                    else await m.react(i)
                }
            }
        }

        // add indicator that command was a success
        message.react('✅')
    }
}