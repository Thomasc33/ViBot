const fs = require('fs')
const Discord = require('discord.js')
const roles = ['moderator', 'officer', 'headrl', 'vetrl', 'security', 'fullskip', 'developer', 'rl', 'almostrl', 'trialrl', 'headeventrl', 'eventrl', 'rusher', 'nitro', 'lol', 'vetraider', 'raider', 'eventraider', 'muted',
    'tempsuspended', 'permasuspended', 'vetban', 'tempkey', 'topkey', 'bottomkey', 'cultping', 'voidping']
const channels = ['modmail', 'verification', 'manualverification', 'vetverification', 'manualvetverification', 'verificationlog', 'activeverification', 'modlogs', 'history', 'suspendlog',
    'viallog', 'rlfeedback', 'currentweek', 'eventcurrentweek', 'pastweeks', 'eventpastweeks', 'leadinglog', 'leaderchat', 'vetleaderchat', 'parsechannel', 'raidstatus', 'eventstatus',
    'vetstatus', 'raidcommands', 'eventcommands', 'vetcommands', 'raidingchannels', 'eventchannels', 'vetchannels', 'runlogs', 'dmcommands', 'veriactive', 'pointlogging', 'veriattempts',
    'modmailinfo', 'parsecurrentweek', 'pastparseweeks', 'roleassignment']
const voice = ['raidingtemplate', 'eventtemplate', 'vettemplate', 'veteventtemplate', 'lounge', 'vetlounge', 'eventlounge', 'afk']
const voiceprefixes = ['raidingprefix', 'vetprefix']
const backend = ['modmail', 'currentweek', 'eventcurrentweek', 'parsecurrentweek', 'verification', 'vetverification', 'points', 'supporter', 'roleassignment', 'realmeyestats']
const numerical = ['afktime', 'eventafktime', 'nitrocount', 'nitrocooldown', 'topkey', 'bottomkey', 'ticketlimit']
const runreqs = ['weapon', 'ability', 'armor', 'ring']
const autoveri = ['fame', 'stars', 'realmage', 'discordage', 'deathcount']
const vetverireqs = ['maxed', 'meleemaxed', 'runs']
const points = ['earlylocation', 'perrun', 'nitromultiplier', 'keypop', 'vialpop', 'rushing', 'brain', 'mystic', 'eventkey', 'cultlocation', 'voidlocation', 'fsvlocation']
var commands = []

const menus = ['roles', 'channels', 'voice', 'voiceprefixes', 'backend', 'numerical', 'runreqs', 'autoveri', 'vetverireqs', 'points', 'commands']

module.exports = {
    name: 'setup',
    description: 'set names of stuff',
    role: 'moderator',
    async execute(message, args, bot, db) {
        if (!commands) commands = bot.commands.keyArray()
        if (args.length == 0) {
            let setupEmbed = new Discord.MessageEmbed()
                .setTitle('Setup')
                .setColor('#54d1c2')
                .setFooter(`Type 'cancel' to stop`)
                .setDescription(`\`\`\`Please select what you wish to edit:\n1: roles\n2: channels\n3: voice\n4: voiceprefixes\n5: backend\n6: numerical\n7: runreqs\n8: autoveri\n9: vetverireqs\n10: points\`\`\``)
            let setupMessage = await message.channel.send(setupEmbed)
            let mainMenu = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
            mainMenu.on('collect', async m => {
                if (m.content.replace(/[^0-9]/g, '') != m.content) {
                    if (m.content = 'cancel') {
                        await setupMessage.delete()
                        await message.react('✅')
                        mainMenu.stop()
                    } else message.channel.send('Invalid number recieved. Please try again')
                } else {
                    await m.delete()
                    mainMenu.stop()
                    switch (m.content) {
                        case '1': menu(roles, 'roles', 'string'); break;
                        case '2': menu(channels, 'channels', 'string'); break;
                        case '3': menu(voice, 'voice', 'string'); break;
                        case '4': menu(voiceprefixes, 'voiceprefixes', 'string'); break;
                        case '5': menu(backend, 'backend', 'boolean'); break;
                        case '6': menu(numerical, 'numerical', 'int'); break;
                        case '7': menu(runreqs, 'runreqs', 'int'); break;
                        case '8': menu(autoveri, 'autoveri', 'int'); break;
                        case '9': menu(vetverireqs, 'vetverireqs', 'int'); break;
                        case '10': menu(points, 'points', 'int'); break;
                        case '11': menu(commands, 'commands', 'boolean'); break;
                    }
                }
                async function menu(array, arrayName, type) {
                    setupEmbed.setTitle(`${arrayName} Menu`)
                        .setDescription(`\`\`\`Please select what you wish to edit`)
                    for (let i in array) {
                        setupEmbed.description += `\n${parseInt(i) + 1}: ${array[i]} '${bot.settings[message.guild.id][arrayName][array[i]]}'`
                    }
                    setupEmbed.description += `\n\`\`\``
                    await setupMessage.edit(setupEmbed)
                    let rolesMenu = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                    rolesMenu.on('collect', async m => {
                        let num = m.content
                        if (m.content.replace(/[^0-9]/g, '') != m.content) {
                            if (m.content = 'cancel') {
                                await setupMessage.delete()
                                await message.react('✅')
                                rolesMenu.stop()
                            } else message.channel.send('Invalid number recieved. Please try again')
                        } else {
                            rolesMenu.stop()
                            setupEmbed.setDescription(`\`\`\`Please enter in the new value\`\`\`\nCurrent Value:\n**${array[parseInt(num) - 1]}** = ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]}`)
                            setupMessage.edit(setupEmbed)
                            let newRoleNameCollector = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                            newRoleNameCollector.on('collect', async mes => {
                                if (mes.content.toLowerCase() == 'cancel') {
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    rolesMenu.stop()
                                } else {
                                    let change = `\`\`\`${array[parseInt(num) - 1]}: ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]} -> ${mes.content}\`\`\``
                                    switch (type) {
                                        case 'string': bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = mes.content; break;
                                        case 'boolean':
                                            if (mes.content.charAt(0).toLowerCase() == 't') {
                                                change = `\`\`\`${array[parseInt(num) - 1]}: ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]} -> true\`\`\``
                                                bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = true
                                            } else {
                                                change = `\`\`\`${array[parseInt(num) - 1]}: ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]} -> false\`\`\``
                                                bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = false
                                            }
                                            break;
                                        case 'int': bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = parseInt(mes.content); break;
                                    }
                                    fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err))
                                    setupEmbed.setDescription(change)
                                        .setTitle(`Changes Made`)
                                        .setFooter(`Setup completed`)
                                    await setupMessage.edit(setupEmbed)
                                    await message.react('✅')
                                    await mes.delete()
                                    newRoleNameCollector.stop()
                                }
                            })
                            m.delete()
                        }
                    })
                }
            })
        }
    },
    autoSetup(guild, bot) {
        if (commands.length == 0) commands = bot.commands.keyArray()
        if (!bot.settings[guild.id]) {
            bot.settings[guild.id] = {
                name: guild.name,
                roles: {},
                channels: {},
                voice: {},
                voiceprefixes: {},
                backend: {},
                numerical: {},
                runreqs: {},
                autoveri: {},
                vetverireqs: {},
                points: {},
                commands: {}
            }
        }
        for (let i of menus) {
            if (!bot.settings[guild.id][i]) bot.settings[guild.id][i] = {}
        }
        for (let i in roles) {
            let role = roles[i]
            if (!bot.settings[guild.id].roles[role]) {
                let r = guild.roles.cache.find(r => r.name === getDefaultRoleName(role))
                if (r) bot.settings[guild.id].roles[role] = r.id
                else bot.settings[guild.id].roles[role] = null
            }
        }
        for (let i in channels) {
            let channel = channels[i]
            if (!bot.settings[guild.id].channels[channel]) {
                let c = guild.channels.cache.find(c => c.name === getDefaultChannelName(channel) && c.type == 'text')
                if (c) bot.settings[guild.id].channels[channel] = c.id
                else bot.settings[guild.id].channels[channel] = null
            }
        }
        for (let i in voice) {
            let v = voice[i]
            if (!bot.settings[guild.id].voice[v]) {
                let vc = guild.channels.cache.find(c => c.name === getDefaultVoiceName(v) && c.type == 'voice')
                if (vc) bot.settings[guild.id].voice[v] = vc.id
                else bot.settings[guild.id].voice[v] = null
            }
        }
        for (let i in voiceprefixes) {
            let v = voiceprefixes[i]
            if (!bot.settings[guild.id].voiceprefixes[v]) {
                bot.settings[guild.id].voiceprefixes[v] = getDefaultVoicePrefixName(v)
            }
        }
        for (let i in backend) {
            if (!bot.settings[guild.id].backend[backend[i]]) {
                bot.settings[guild.id].backend[backend[i]] = false
            }
        }
        for (let i in numerical) {
            let n = numerical[i]
            if (!bot.settings[guild.id].numerical[n]) {
                bot.settings[guild.id].numerical[n] = getDefaultNumericalValue(n)
            }
        }
        for (let i in runreqs) {
            let r = runreqs[i]
            if (!bot.settings[guild.id].runreqs[r]) {
                bot.settings[guild.id].runreqs[r] = getDefaultRunReqs(r)
            }
        }
        for (let i in autoveri) {
            let r = autoveri[i]
            if (!bot.settings[guild.id].autoveri[r]) {
                bot.settings[guild.id].autoveri[r] = getDefaultAutoVeriReqs(r)
            }
        }
        for (let i in vetverireqs) {
            let r = vetverireqs[i]
            if (!bot.settings[guild.id].vetverireqs[r]) {
                bot.settings[guild.id].vetverireqs[r] = getDefaultVetReqs(r)
            }
        }
        for (let i in points) {
            let r = points[i]
            if (!bot.settings[guild.id].points[r] && bot.settings[guild.id].points[r] != 0) {
                bot.settings[guild.id].points[r] = getDefaultPointValue(r)
            }
        }
        for (let i of commands) {
            if (!bot.settings[guild.id].commands[i]) bot.settings[guild.id].commands[i] = true
        }
        fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err))
    }
}

function getDefaultRoleName(name) {
    switch (name) {
        case 'moderator': return 'Moderator'
        case 'officer': return 'Officer'
        case 'headrl': return 'Head Raid Leader'
        case 'vetrl': return 'Veteran Raid Leader'
        case 'security': return 'Security'
        case 'fullskip': return 'Fullskip'
        case 'developer': return 'Developer'
        case 'rl': return 'Raid Leader'
        case 'almostrl': return 'Almost Raid Leader'
        case 'trialrl': return 'Trial Raid Leader'
        case 'headeventrl': return 'Head Event Organizer'
        case 'eventrl': return 'Event Organizer'
        case 'rusher': return 'Official Rusher'
        case 'nitro': return 'Nitro Booster'
        case 'lol': return 'Leader on Leave'
        case 'vetraider': return 'Veteran Raider'
        case 'raider': return 'Verified Raider'
        case 'eventraider': return 'Event Boi'
        case 'muted': return 'Muted'
        case 'tempsuspended': return 'Suspended but Verified'
        case 'permasuspended': return 'Suspended'
        case 'vetban': return 'Banned Veteran Raider'
        case 'tempkey': return 'Temporary Key Popper'
        case 'topkey': return 'Veteran Key Popper'
        case 'bottomkey': return 'Verified Key Popper'
        case 'cultping': return 'Cult boi'
        case 'voidping': return 'Void boi'
    }
}

function getDefaultChannelName(name) {
    switch (name) {
        case 'modmail': return 'history-bot-dms';
        case 'verification': return 'get-verified';
        case 'manualverification': return 'veri-pending';
        case 'vetverification': return 'veteran-verification';
        case 'manualvetverification': return 'veri-pending-veterans';
        case 'verificationlog': return 'veri-log';
        case 'activeverification': return 'veri-active';
        case 'modlogs': return 'mod-logs';
        case 'history': return 'history';
        case 'suspendlog': return 'suspend-log';
        case 'viallog': return 'vial-logs';
        case 'rlfeedback': return 'customer-feedback';
        case 'currentweek': return 'currentweek';
        case 'eventcurrentweek': return 'e-currentweek';
        case 'pastweeks': return 'leader-activity-log';
        case 'eventpastweeks': return 'e-weekly-logs';
        case 'leadinglog': return 'leader-leading-logs';
        case 'leaderchat': return 'leader-chat';
        case 'vetleaderchat': return 'veteran-rl-chat';
        case 'parsechannel': return 'crasher-list';
        case 'raidstatus': return 'raid-status-announcements';
        case 'eventstatus': return 'event-status-announcements';
        case 'vetstatus': return 'veteran-status-announcements';
        case 'raidcommands': return 'dylanbot-commands';
        case 'eventcommands': return 'eventbot-commands';
        case 'vetcommands': return 'veteran-bot-commands';
        case 'raidingchannels': return 'active-channels';
        case 'eventchannels': return 'active-channels-e';
        case 'vetchannels': return 'active-channels-v';
        case 'runlogs': return 'dylanbot-info';
        case 'dmcommands': return 'history-reacts';
        case 'veriactive': return 'veri-active';
        case 'pointlogging': return 'point-history';
        case 'veriattempts': return 'veri-attempts';
        case 'modmailinfo': return 'mod-mail';
        case 'parsecurrentweek': return 'mod-current-week';
        case 'pastparseweeks': return 'mod-parse-history';
        case 'roleassignment': return 'role-assignment';
    }
}

function getDefaultVoiceName(name) {
    switch (name) {
        case 'raidingtemplate': return 'Raiding Template';
        case 'eventtemplate': return 'Event Raiding Template';
        case 'vettemplate': return 'Vet Raiding Template';
        case 'lounge': return 'lounge';
        case 'vetlounge': return 'Veteran Lounge';
        case 'eventlounge': return 'Event Lounge';
        case 'afk': return 'afk'
        case 'veteventtemplate': return 'Vet Event Template'
    }
}

function getDefaultVoicePrefixName(name) {
    switch (name) {
        case 'raidingprefix': return 'Backup raiding-';
        case 'vetprefix': return 'Veteran Raiding-';
    }
}

function getDefaultNumericalValue(name) {
    switch (name) {
        case 'afktime': return 360;
        case 'eventafktime': return 360;
        case 'nitrocount': return 5;
        case 'nitrocooldown': return 3600000;
        case 'topkey': return 50;
        case 'bottomkey': return 15;
        case 'ticketlimit': return 5;
    }
}

function getDefaultRunReqs(name) {
    switch (name) {
        case 'weapon': return 10;
        case 'ability': return 4;
        case 'armor': return 10;
        case 'ring': return 4;
    }
}

function getDefaultAutoVeriReqs(name) {
    switch (name) {
        case 'fame': return 1000;
        case 'stars': return 30;
        case 'realmage': return 365;
        case 'discordage': return 3;
        case 'deathcount': return 100
    }
}

function getDefaultVetReqs(name) {
    switch (name) {
        case 'maxed': return 3;
        case 'meleemaxed': return 1;
        case 'runs': return 100
    }
}

function getDefaultPointValue(name) {
    switch (name) {
        case 'earlylocation': return 20;
        case 'perrun': return 1;
        case 'nitromultiplier': return 2;
        case 'keypop': return 20;
        case 'vialpop': return 3;
        case 'rushing': return 1;
        case 'brain': return 1;
        case 'mystic': return 1;
        case 'eventkey': return 2;
        case 'cultlocation': return 20;
        case 'voidlocation': return 25;
        case 'fsvlocation': return 30;
    }
}