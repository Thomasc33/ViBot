const ChannelsCommand = require('./vibotChannels')
const Discord = require('discord.js')
const fs = require('fs')
const dbInfo = require('../data/database.json')
const logs = require('../data/logInfo.json')
const afkCheck = require('./afkCheck')
const ErrorLogger = require('../lib/logError')

var channels = []
var channelCache = []

module.exports = {
    name: 'channel',
    alias: ['channels'],
    role: 'eventrl',
    description: 'Create a channel that stays open and is able to be edited. Useful for simply started a long lasting channel for run types where afk checks don\'t make sense. *Default cap is 50*',
    args: '<create/rename/log/setcap> (data)',
    getNotes(guildid, member) {
        return `\`create <name>\` creates new channel\n\`rename <new name>\` renames the channel\n\`log\` (${logs[guildid].main.map(log => log.key).join('/')}) logs a dungeon complete for everyone in vc *${logs[guildid].main.map(log => log.key).join('/')} required for channels in vet section only*\n\`setcap <#>\` sets the vc cap`
    },
    requiredArgs: 1,
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        switch (args[0].toLowerCase()) {
            case 'create':
                //get channel parent
                let isVet = false;
                let isAccursed = false;
                if (message.channel.parent.name.toLowerCase() == settings.categories.veteran){
                    if(message.channel.id == settings.channels.accursedcommands) isAccursed = true
                    else isVet = true;
                }
                else if (message.channel.parent.name.toLowerCase() == settings.categories.event) isVet = false;
                else return message.channel.send('Channel category is invalid')

                //channel name
                let name = ''
                for (i = 1; i < args.length; i++) name = name.concat(args[i]) + ' ';
                if (name.length >= 32) return message.channel.send('Name must be below 32 characters, try again');
                if (name == '') return message.channel.send("Please provide a name")
                name = name.trim();

                //post a message in raid status
                let embed = new Discord.EmbedBuilder()
                    .setColor('#eeeeee')
                    .setAuthor({ name: `${name}` })
                    .addFields({ name: 'Status', value: '**Closed**' })
                    .setFooter({ text: 'Started at' })
                    .setTimestamp(Date.now())
                let raidStatus
                if (isVet) raidStatus = message.guild.channels.cache.get(settings.channels.vetstatus)
                else if (isAccursed) raidStatus = message.guild.channels.cache.get(settings.channels.accursedstatus)
                else raidStatus = message.guild.channels.cache.get(settings.channels.eventstatus)
                if (!raidStatus) return message.channel.send('Could not find raid-status')
                embedComponents = new Discord.ActionRowBuilder()
                    .addComponents([
                        new Discord.ButtonBuilder()
                            .setLabel('🔓 Open VC')
                            .setStyle(2)
                            .setCustomId('open')
                    ])
                let m = await raidStatus.send({ content: `@here Run will be starting very soon`, embeds: [], components: [] })

                //create channel default unlocked using same code from afkcheck
                let channel = await createChannel(name, isVet, message, bot, m, isAccursed)

                // Modify the Raid Status Embed
                embed.setDescription(`**Raid Leader:** ${message.member}\n**VC:** ${channel}`)

                await m.edit({ content: `@here`, embeds: [embed], components: [embedComponents] })

                //add interaction collectors
                this.leaderInteractionCollector = new Discord.InteractionCollector(bot, { message: m, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
                this.leaderInteractionCollector.on('collect', (interaction) => interactionHandler(interaction, m, settings, bot))
                

                //add to channels array
                let runInfo = {
                    channel: channel,
                    channelID: channel.id,
                    author: message.author.id,
                    embed: embed,
                    message: m,
                    messageID: m.id,
                }
                channels.push(runInfo)

                let cacheData = {
                    channelID: channel.id,
                    author: message.author.id,
                    embed: embed,
                    messageID: m.id,
                    rsaId: raidStatus.id,
                    guildId: message.guild.id,
                }
                channelCache.push(cacheData)
                fs.writeFileSync('./createdChannels.json', JSON.stringify(channelCache, null, 4), err => { if (err) ErrorLogger.log(err, bot, message.guild) })

                let afkInfo = {
                    leader: message.author.id,
                    leaderNick: message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0],
                    active: false,
                    runType: {
                        runType: name,
                        runName: name,
                        embed: {
                            color: '#3a74fc'
                        },
                    },
                    url: m.url,
                    endedAt: Date.now()
                }
                bot.afkChecks[channel.id] = afkInfo
                fs.writeFileSync('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot, message.guild) })
                return;
            case 'rename':
                function rename() {
                    //get channel info
                    let channel = getChannel(message)
                    if (!channel) return

                    //get name
                    let name = ''
                    for (i = 1; i < args.length; i++) name = name.concat(args[i]) + ' ';
                    if (name.length >= 32) return message.channel.send('Name must be below 32 characters, try again');
                    if (name == '') return message.channel.send("Please provide a name")
                    name = name.trim();

                    //change name
                    channel.channel.setName(`${name}`)

                    //update message in raid-status
                    channel.embed.data.author.text = `${name}`
                    channel.message.edit({ embeds: [channel.embed] })

                    if (!bot.afkChecks[channel.channelId].runType) bot.afkChecks[channel.channelId].runType = {}
                    bot.afkChecks[channel.channelId].runType.runType = name;
                    bot.afkChecks[channel.channelId].runType.runName = name;
                    fs.writeFileSync('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot, message.guild) })

                    //change messages

                }
                rename()
                break;
            case 'open':
                open(message, settings, bot)
                break;
            case 'close':
                close(message, settings, bot)
                break;
            case 'log':
                console.log(1)
                function log() {
                    //get channel info
                    let channel = getChannel(message)
                    if (!channel) return

                    //get runtype
                    let runType
                    if (channel.channel.parent.name.toLowerCase() == settings.categories.event) runType = 0
                    else {
                        if (!args[1]) return message.channel.send('Run type not recognized')
                        runType = afkCheck.getRunType(args[1].charAt(0).toLowerCase(), message.guild.id)
                    }
                    if (!runType && runType !== 0) return
                    if (runType == 0 && !dbInfo[message.guild.id]) return message.channel.send('Event logging not setup for this server, contact Vi')

                    //log 
                    let query = `UPDATE users SET ${(runType == 0) ? `${dbInfo[message.guild.id].eventInfo.eventruns} = ${dbInfo[message.guild.id].eventInfo.eventruns} + 1 WHERE ` : `${runType.runLogName} = ${runType.runLogName} + 1 WHERE `}`
                    channel.channel.members.each(m => query = query.concat(`id = '${m.id}' OR `))
                    query = query.substring(0, query.length - 4)
                    db.query(query, err => {
                        if (err) ErrorLogger.log(err, bot, message.guild)
                        message.react('✅')
                    })
                }
                log()
                break;
            case 'setcap':
                function setCap() {
                    //get channel info
                    let channel = getChannel(message)
                    if (!channel) return
                    if (!channel.channel) return message.channel.send("Could not find the channel")
                    //get cap
                    let cap = parseInt(args[1])
                    if (!cap || cap == NaN) return message.channel.send("Channel cap not recognized")

                    //set cap
                    channel.channel.setUserLimit(cap)
                }
                setCap()
                break;
        }
    },
    /**
     * Initializes and realizes cache of previous channels
     * @param {Discord.Client} bot 
     */
    async init(bot) {
        if (moduleIsAvailable('../createdChannels.json')) {
            let c = require('../createdChannels.json')
            for (let i of c) {
                let guild = bot.guilds.cache.get(i.guildId)
                if (!guild) return
                let vc = await guild.channels.fetch(i.channelID)
                let rsa = await guild.channels.fetch(i.rsaId)
                if (!vc || !rsa) continue
                let m = await rsa.messages.fetch(i.messageID)
                if (!m) continue

                channels.push({
                    channel: vc,
                    channelID: i.channelID,
                    author: i.author,
                    embed: i.embed,
                    message: m,
                    messageID: i.messageID
                })
                channelCache.push(i)
            }
        }
    }
}

function getChannel(message) {
    //get users channel
    if (!message.member.voice.channel) return message.channel.send('I couldn\'t find what channel you are in')
    let uc = message.member.voice.channel

    //make sure channel they are in is in channels array
    let channel
    for (let c of channels) {

        if (c.channelID == uc.id) channel = c;
    }

    //check results
    if (!channel) return message.channel.send('I could not edit the channel you are currently in')
    else return channel;
}


async function createChannel(name, isVet, message, bot, rsaMessage, isAccursed) {
    let settings = bot.settings[message.guild.id]
    return new Promise(async (res, rej) => {
        //channel creation
        if (isVet) {
            var parent = settings.categories.veteran;
            var template = message.guild.channels.cache.get(settings.voice.vettemplate)
            var raider = message.guild.roles.cache.get(settings.roles.vetraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
            var lounge = message.guild.channels.cache.get(settings.voice.vetlounge)
        }
        else if (isAccursed) {
            var parent = settings.categories.veteran;
            var template = message.guild.channels.cache.get(settings.voice.accursedtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.accursed)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
            var lounge = message.guild.channels.cache.get(settings.voice.vetlounge)
        }
        else {
            var parent = settings.categories.event;
            var template = message.guild.channels.cache.get(settings.voice.eventtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.raider)
            var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.eventchannels)
            var lounge = message.guild.channels.cache.get(settings.voice.eventlounge)
        }
        if (!template) return rej(`Template channel not found`)
        if (!message.guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === parent)) return rej(`${parent} category not found`)
        let channel = await template.clone({
            name: `${name}`,
            parent: message.guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === parent).id,
            userLimit: 50
        }).then(c => c.setPosition(lounge.position + 1))

        await message.member.voice.setChannel(channel).catch(er => { })

        //allows raiders to view
        channel.permissionOverwrites.edit(raider.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild))
        if (eventBoi && settings.backend.giveEventRoleOnDenial2) channel.permissionOverwrites.edit(eventBoi.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild))

        // Embed to Remove
        let embed = new Discord.EmbedBuilder()
            .setDescription(`**Raid Leader:** <@!${message.author.id}>\n**VC:** <#${channel.id}>\n\nWhenever the run is over. Click the button to delete the channel. View the timestamp for more information`)
            .setFooter({ text: `${channel.id}` })
            .setTimestamp()
            .setTitle(channel.name)
            .setColor('#eeeeee')
        setTimeout(async () => {
            let m = await vibotChannels.send({ content: `${message.member}`, embeds: [embed] });
            await ChannelsCommand.addCloseChannelButtons(bot, m, rsaMessage);
        }, 1);
        if (!channel) rej('No channel was made')
        res(channel);
    })
}

async function interactionHandler(interaction, message, settings, bot) {
    if (!interaction.isButton()) return;
    if (interaction.customId == "open") {
        veteranAffiliate = message.guild.roles.cache.get(settings.roles.vetaffiliate)
        if (message.guild.members.cache.get(interaction.user.id).roles.highest.position < veteranAffiliate.position) { return await interaction.reply({ content: 'This Voice Channel is currently **CLOSED**\nYou are not a Staff Member and can not open this Voice Channel', ephemeral: true}) }
        await interaction.reply({ ephemeral: true, content: "Opening channel!"})
        open(interaction, settings, bot)

        let temp_m_components = message.components
        for (let i = 0; i < temp_m_components.length; i++) {
            for (let j = 0; j < temp_m_components[i].components.length; j++) {
                if (temp_m_components[i].components[j].customId === 'open') {
                    temp_m_components[i].components[j] = new Discord.ButtonBuilder({ label: '🔒 Close VC', customId: 'close', disabled: false, style: Discord.ButtonStyle.Primary });
                }
            }
        }
        message = await message.edit({ components: temp_m_components })
    } else if (interaction.customId == "close") {
        veteranAffiliate = message.guild.roles.cache.get(settings.roles.vetaffiliate)
        if (message.guild.members.cache.get(interaction.user.id).roles.highest.position < veteranAffiliate.position) { return interaction.reply({ content: 'This Voice Channel is currently **OPEN**\nYou are not a Staff Member and can not open this Voice Channel', ephemeral: true}) }
        interaction.reply({ ephemeral: true, content: "Closing channel!"})
        close(interaction, settings, bot)

        let temp_m_components = message.components
        for (let i = 0; i < temp_m_components.length; i++) {
            for (let j = 0; j < temp_m_components[i].components.length; j++) {
                if (temp_m_components[i].components[j].customId === 'close') {
                    temp_m_components[i].components[j] = new Discord.ButtonBuilder({ label: '🔓 Open VC', customId: 'open', disabled: false, style: Discord.ButtonStyle.Secondary });
                }
            }
        }
        message = await message.edit({ components: temp_m_components })
    } else {
        interaction.reply({ content: "Something went wrong, please try again!", ephemeral: true })
    }
}

function open(message, settings, bot) {
    let channel = getChannel(message)
    if (!channel) return

    if (!channel.message) return message.channel.send(`Error finding the message in RSA, try recreating the channel`)
    if (!channel.channel) return message.channel.send(`Voice channel not found, try recreating it`)

    // 5 second timer
    let iteration = 0;
    let timer = setInterval(unlockInterval, 2500)
    async function unlockInterval() {
        switch (iteration) {
            case 0:
                channel.message.edit(`@here Channel will open in 5 seconds...`)
                break;
            case 1:
                channel.message.edit(`@here Channel will open in 2.5 seconds...`)
                break;
            case 2:
                clearInterval(timer)
                //unlock the channel (event boi for events :^))
                if (channel.channel.parent.name.toLowerCase() == 'events') {
                    var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
                    var raider = message.guild.roles.cache.get(settings.roles.raider)
                }
                 else {
                    if(message.channelId == settings.channels.accursedstatus || message.channelId == settings.channels.accursedcommands) var raider = message.guild.roles.cache.get(settings.roles.accursed)
                    else var raider = message.guild.roles.cache.get(settings.roles.vetraider)
                }

                channel.channel.permissionOverwrites.edit(raider.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild))
                    .then(eventBoi && settings.backend.giveEventRoleOnDenial2 ? channel.channel.permissionOverwrites.edit(eventBoi.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild)) : null)

                //edit message in raid status
                channel.embed.data.fields[0].value = '**Open**'
                channel.message.edit({ content: '@here', embeds: [channel.embed] })

                if (!bot.afkChecks[channel.channelId]) bot.afkChecks[channel.channelId] = {}
                bot.afkChecks[channel.channelId].active = true;
                bot.afkChecks[channel.channelId].started = Date.now();
                fs.writeFileSync('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot, message.guild) })
                break;
        }
        iteration++;

    }
}

function close(message, settings, bot) {
    let channel = getChannel(message)
    if (!channel) return
    if (!channel.channel) return message.channel.send("Could not find your channel");
    //lock the channel (event boi for events :^))
    if (channel.channel.parent.name.toLowerCase() == 'events') {
        var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
        var raider = message.guild.roles.cache.get(settings.roles.raider)
    } else {
        var raider = message.guild.roles.cache.get(settings.roles.vetraider)
    }

    channel.channel.permissionOverwrites.edit(raider.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild))
        .then(eventBoi && settings.backend.giveEventRoleOnDenial2 ? channel.channel.permissionOverwrites.edit(eventBoi.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot, message.guild)) : null)

    //edit message in raid status
    channel.embed.data.fields[0].value = '**Closed**'
    channel.message.edit({ content: null, embeds: [channel.embed] })
    if (bot.afkChecks[channel.channelId]) {
        bot.afkChecks[channel.channelId].active = false;
        bot.afkChecks[channel.channelId].endedAt = Date.now();
        fs.writeFileSync('./data/afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot, message.guild) })
    }
}

function moduleIsAvailable(path) {
    try {
        require.resolve(path);
        return true;
    } catch (e) {
        return false;
    }
}
