const ChannelsCommand = require('./vibotChannels')
const Discord = require('discord.js')
const fs = require('fs')
const dbInfo = require('../database.json')

var channels = []

module.exports = {
    name: 'channel',
    alias: ['channels'],
    role: 'eventrl',
    description: 'Create a channel that stays open and is able to be edited. Useful for simply started a long lasting channel for run types where afk checks don\'t make sense. *Default cap is 50*',
    args: '<create/open/close/rename/log/setcap> (data)',
    getNotes(guildid, member) {
        return '`create <name>` creates new channel\n`open` unlocks the channel\n`close` locks the channel\n`rename <new name>` renames the channel\n`log` (c/ve) logs a dungeon complete for everyone in vc *c/v/e required for channels in vet section only*\n`setcap <#>` sets the vc cap'
    },
    requiredArgs: 1,
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        switch (args[0].toLowerCase()) {
            case 'create':
                //get channel parent
                let isVet = false;
                if (message.channel.parent.name.toLowerCase() == 'veteran raiding') isVet = true;
                else if (message.channel.parent.name.toLowerCase() == 'events') isVet = false;
                else return message.channel.send('Channel category is invalid')

                //channel name
                let name = ''
                for (i = 1; i < args.length; i++) name = name.concat(args[i]) + ' ';
                if (name.length >= 32) return message.channel.send('Name must be below 32 characters, try again');
                if (name == '') return message.channel.send("Please provide a name")
                name = name.trim();

                //create channel default unlocked using same code from afkcheck
                let channel = await createChannel(name, isVet, message, bot)

                //post a message in raid status
                let embed = new Discord.MessageEmbed()
                    .setColor('#eeeeee')
                    .setAuthor(`${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s ${name}`)
                    .setDescription(`Join \`${channel.name}\` to participate`)
                    .addField('Status', '**Closed**')
                    .setFooter('Started at')
                    .setTimestamp(Date.now())
                let raidStatus
                if (isVet) raidStatus = message.guild.channels.cache.get(settings.channels.vetstatus)
                else raidStatus = message.guild.channels.cache.get(settings.channels.eventstatus)
                if (!raidStatus) return message.channel.send('Could not find raid-status')
                let m = await raidStatus.send(`@here`, embed)

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
                fs.writeFileSync('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot) })
                return;
            case 'open':
                function open() {
                    let channel = getChannel(message)
                    if (!channel) return

                    //10 second timer
                    let iteration = 0;
                    let timer = bot.setInterval(unlockInterval, 5000)
                    async function unlockInterval() {
                        switch (iteration) {
                            case 0:
                                channel.message.edit(`@here Channel will open in 10 seconds...`)
                                break;
                            case 1:
                                channel.message.edit(`@here Channel will open in 5 seconds...`)
                                break;
                            case 2:
                                clearInterval(timer)
                                //unlock the channel (event boi for events :^))
                                if (channel.channel.parent.name.toLowerCase() == 'events') {
                                    var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
                                    var raider = message.guild.roles.cache.get(settings.roles.raider)
                                } else {
                                    var raider = message.guild.roles.cache.get(settings.roles.vetraider)
                                }

                                channel.channel.updateOverwrite(raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
                                    .then(eventBoi ? channel.channel.updateOverwrite(eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) : null)

                                //edit message in raid status
                                channel.embed.fields[0].value = '**Open**'
                                channel.message.edit('@here', channel.embed)

                                bot.afkChecks[channel.channelID].active = true;
                                bot.afkChecks[channel.channelID].started = Date.now();
                                fs.writeFileSync('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot) })
                                break;
                        }
                        iteration++;

                    }
                }
                open()
                break;
            case 'close':
                function close() {
                    let channel = getChannel(message)
                    if (!channel) return

                    //lock the channel (event boi for events :^))
                    if (channel.channel.parent.name.toLowerCase() == 'events') {
                        var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
                        var raider = message.guild.roles.cache.get(settings.roles.raider)
                    } else {
                        var raider = message.guild.roles.cache.get(settings.roles.vetraider)
                    }

                    channel.channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
                        .then(eventBoi ? channel.channel.updateOverwrite(eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot)) : null)

                    //edit message in raid status
                    channel.embed.fields[0].value = '**Closed**'
                    channel.message.edit('', channel.embed)
                    bot.afkChecks[channel.channelID].active = false;
                    bot.afkChecks[channel.channelID].endedAt = Date.now();
                    fs.writeFileSync('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot) })
                }
                close()
                break;
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
                    channel.channel.setName(`${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s ${name}`)

                    //update message in raid-status
                    channel.embed.author.text = `${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s ${name}`
                    channel.message.edit(channel.embed)

                    bot.afkChecks[channel.channelID].runType.runType = name;
                    bot.afkChecks[channel.channelID].runType.runName = name;
                    fs.writeFileSync('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => { if (err) ErrorLogger.log(err, bot) })
                }
                rename()
                break;
            case 'log':
                function log() {
                    //get channel info
                    let channel = getChannel(message)
                    if (!channel) return

                    //get runtype
                    let runType
                    if (channel.channel.parent.name.toLowerCase() == settings.categories.event) runType = 0
                    else {
                        if (!args[1]) return message.channel.send('Run type not recognized')
                        runType = afkCheck.getRunType(args[1].charAt(0).toLowerCase())
                    }
                    if (!runType && runType !== 0) return
                    if (runType == 0 && !dbInfo[message.guild.id]) return message.channel.send('Event logging not setup for this server, contact Vi')

                    //log 
                    let query = `UPDATE users SET ${(runType == 0) ? `${dbInfo[message.guild.id].eventInfo.eventruns} = ${dbInfo[message.guild.id].eventInfo.eventruns} + 1 WHERE ` : `${runType.runLogName} = ${runType.runLogName} + 1 WHERE `}`
                    channel.channel.members.each(m => query = query.concat(`id = '${m.id}' OR `))
                    query = query.substring(0, query.length - 4)
                    db.query(query, err => {
                        if (err) ErrorLogger.log(err, bot)
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

                    //get cap
                    let cap = parseInt(args[1])
                    if (!cap || cap == NaN) return message.channel.send("Channel cap not recognized")

                    //set cap
                    channel.channel.setUserLimit(cap)
                }
                setCap()
                break;
        }
    }
}

function getChannel(message) {
    //get users channel
    if (!message.member.voice.channel) {
        message.channel.send('I couldn\'t find what channel you are in')
        return
    }
    let uc = message.member.voice.channel

    //make sure channel they are in is in channels array
    let channel
    for (let c of channels) {
        if (c.channelID == uc.id) channel = c;
    }

    //check results
    if (!channel) {
        message.channel.send('I could not edit the channel you are currently in')
        return;
    } else return channel;
}


async function createChannel(name, isVet, message, bot) {
    let settings = bot.settings[message.guild.id]
    return new Promise(async (res, rej) => {
        //channel creation
        if (isVet) {
            var parent = 'veteran raiding';
            var template = message.guild.channels.cache.get(settings.voice.vettemplate)
            var raider = message.guild.roles.cache.get(settings.roles.vetraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
            var lounge = message.guild.channels.cache.find(c => c.name.toLowerCase() == 'veteran lounge')
        } else {
            var parent = 'events';
            var template = message.guild.channels.cache.get(settings.voice.eventtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.raider)
            var eventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.eventchannels)
            var lounge = message.guild.channels.cache.find(c => c.name.toLowerCase() == 'event lounge')
        }
        if (!template) return rej(`Template channel not found`)
        let channel = await template.clone({
            name: `${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s ${name}`,
            parent: message.guild.channels.cache.filter(c => c.type == 'category').find(c => c.name.toLowerCase() === parent).id,
            userLimit: 50
        }).then(c => c.setPosition(lounge.position + 1))

        await message.member.voice.setChannel(channel).catch(er => { })

        //allows raiders to view
        channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        if (eventBoi) channel.updateOverwrite(eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))

        //Embed to remove
        let embed = new Discord.MessageEmbed()
            .setDescription(`Whenever the run is over. React with the ❌ to delete the channel. View the timestamp for more information`)
            .setFooter(channel.id)
            .setTimestamp()
            .setTitle(channel.name)
            .setColor(`#eeeeee`)
        let m = await vibotChannels.send(`${message.member}`, embed)
        await m.react('❌')
        setTimeout(() => { ChannelsCommand.watchMessage(m, bot, settings) }, 5000)
        if (!channel) rej('No channel was made')
        res(channel);
    })
}