const fs = require('fs')
const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const roles = [
    'admin', 'moderator', 'officer', 'headrl', 'headdev', 'assistantdev', 'vetrl', 'fsvrl', 'mrvrl', 'security', 'fullskip', 'developer', 'rl', 'almostrl',
    'trialrl', 'headeventrl', 'eventrl', 'minimumStaffRole',
    'rusher', 'lol', 'accursed', 'vetraider', 'vetraider2', 'vetraider3', 'vetraider4', 'vetraider5', 'raider', 'eventraider', 'muted',
    'tempsuspended', 'permasuspended', 'vetban', 'tempkey', 'keyjesus', 'moddedkey', 'topkey', 'bottomkey', 'cultping', 'voidping', 'shattsReact', 'hmShattsReact', 'fungalReact', 'nestReact',
    'fskipReact', 'fameReact', 'accursedReact', 'rcPing', 'o3Ping', 'eventBoi', 'veteventrl', 'lostboomer',
    'priest', 'warden', 'vetaffiliate', 'affiliatestaff', `toprune`, `bottomrune`, 'helper', 'steamworksping', 'moonlightping', 'eventBoiPing', 'advancedSteamworksPing', 'advancedNestPing',
    'almostShattersBanner', 'almostMoonlightBanner', 'hallsBanner', 'shattersBanner', 'fullskipBanner', 'hmShattersBanner', 'moonlightBanner', 'vetHallsBanner', 'vetShattersBanner', 'vetFullskipBanner', 'vetHmShattersBanner', 'vetMoonlightBanner',
    'supporterTierOne', 'supporterTierTwo', 'supporterTierThree', 'supporterTierFour', 'supporterTierFive', 'supporterTierSix', 'unverified',
    'motmgTeam1', 'motmgTeam2', 'motmgTeam3', 'motmgTeam4', 'motmgTeam5', 'motmgTeam6', 'motmgTeam7', 'motmgTeam8', 'motmgTeam9', 'motmgTeam10',
    'motmgTeam11', 'motmgTeam12', 'motmgTeam13', 'motmgTeam14', 'motmgTeam15', 'motmgTeam16', 'motmgTeam17', 'motmgTeam18', 'motmgTeam19', 'motmgTeam20',
    'motmgTeam21', 'motmgTeam22', 'motmgTeam23', 'motmgTeam24', 'motmgTeam25', 'motmgTeam26', 'motmgTeam27', 'motmgTeam28', 'motmgTeam29', 'motmgTeam30'
]
const channels = ['modmail', 'verification', 'manualverification', 'vetverification', 'manualvetverification', 'verificationlog', 'accursedverification', 'activeverification', 'modlogs', 'history', 'suspendlog',
    'viallog', 'rlfeedback', 'currentweek', 'eventcurrentweek', 'pastweeks', 'eventpastweeks', 'leadinglog', 'leaderchat', 'vetleaderchat', 'parsechannel', 'raidstatus', 'eventstatus',
    'vetstatus', 'exaltstatus', 'raidcommands', 'eventcommands', 'vetcommands', 'accursedcommands', 'accursedstatus', 'raidingchannels', 'eventchannels', 'vetchannels', 'runlogs', 'dmcommands', 'veriactive', 'pointlogging',
    'veriattempts', 'modmailinfo', 'parsecurrentweek', 'pastparseweeks', 'roleassignment', 'botstatus', 'keyalerts', 'activitylog', 'raidingrules',
    'forwardedModmailMessage', 'motmgLeaderboard']
const categories = ['raiding', 'veteran', 'event']
const voice = ['raidingtemplate', 'eventtemplate', 'vettemplate', 'accursedtemplate','veteventtemplate', 'lounge', 'vetlounge', 'eventlounge', 'afk',
    'raiding1', 'raiding2', 'raiding3', 'raiding4', 'raiding5', 'raiding6', 'raiding7', 'raiding8', 'raiding9',
    'veteranraiding1', 'veteranraiding2', 'veteranraiding3', 'veteranraiding4', 'veteranraiding5', 'veteranraiding6', 'veteranraiding7', 'veteranraiding8', 'veteranraiding9',
    'eventraiding1', 'eventraiding2', 'eventraiding3', 'eventraiding4', 'eventraiding5', 'eventraiding6', 'eventraiding7', 'eventraiding8', 'eventraiding9']
const voiceprefixes = ['raidingprefix', 'vetprefix']
const backend = ['modmail', 'currentweek', 'eventcurrentweek', 'parsecurrentweek', 'verification', 'vetverification', 'points', 'supporter', 'roleassignment', 'realmeyestats', 'automod', 'removekeyreacts', 'characterparse', 'forwadedMessageThumbsUpAndDownReactions',
    'giveeventroleonverification', 'eventcurrentweekdisplaysalleventrl', 'upgradedCheck', 'raidResetMonthly', 'eventResetMonthly', 'parseResetMonthly', 'exaltedEvents', 'sendmissedquota',
    'exaltsInRSA', 'allowAdvancedRuns', 'allowExaltedRuns', 'raidResetBiweekly', 'eventResetBiweekly', 'parseResetBiweekly', 'onlyUpperStaffSuspendStaff', 'giveEventRoleOnDenial2', 'disableEventsFromHeadcounts',
    'useStaticVCForRaiding', 'useUnverifiedRole', 'punishmentsWarnings', 'punishmentsSuspensions', 'punishmentsMutes', 'allowAdditionalCompletes', 'miniBossGuessing']
const numerical = ['afktime', 'eventafktime', 'topkey', 'bottomkey', 'ticketlimit', 'supporterlimit', 'keyalertsage', 'waitnewkeyalert', 'prunerushersoffset',
    `toprune`, `bottomrune`,
    `milestoneStartTimestamp`, 'timestamp1', 'timestamp2', 'timestamp3', 'timestamp4', 'timestamp5', 'timestamp6', 'timestamp7',
    `timestamp8`, 'timestamp9', 'timestamp10', 'timestamp11', 'timestamp12', 'timestamp13', 'timestamp14', 'timestamp15']
const runreqs = ['weapon', 'ability', 'armor', 'ring']
const autoveri = ['fame', 'stars', 'realmage', 'discordage', 'deathcount']
const vetverireqs = ['maxed', 'meleemaxed', 'runs']
const points = ['earlylocation', 'perrun', 'supportermultiplier', 'keypop', 'vialpop', 'rushing', 'brain', 'mystic', 'eventkey', 'cultlocation', 'voidlocation', 'fsvlocation', 'o3streaming',
    'o3trickster', 'o3puri', 'exaltkey', 'shattskey', 'fungalkey', 'nestkey', 'keymultiplier', 'runepop', 'incpop', 'steamworkkey',
    'moonlightkey', 'miniBossGuessingPoints']
const lists = ['earlyLocation', 'runningEvents', 'warningRoles', 'perkRoles', 'discordRoles', 'commendRoles']
const strings = ['hallsAccursedReqsImage', 'hallsAdvancedReqsImage', 'exaltsAdvancedReqsImage', 'hallsExaltedReqsImage', 'exaltsExaltedReqsImage', 'vetVerifyDeniedMessage']
const quotapoints = ['voidLeading', 'cultLeading', 'shattersLeading', 'oryx3Leading', 'fungalLeading', 'nestLeading', 'steamworkLeading',
'eventLeading', 'failedRun', 'feedback', 'feedbackOnFeedback', 'assist', 'parsing', 'rolledquota', 'rlWeeklyQuota', 'arlWeeklyQuota', 'securityWeeklyQuota', 'wardenWeeklyQuota',
'eventrlWeeklyQuota', 'arlVote']
const modmail = ['sendMessage', 'forwardMessage', 'closeModmail', 'blacklistUser', 'lockModmail']
const supporter = ['supporterCooldownSeconds1', 'supporterCooldownSeconds2', 'supporterCooldownSeconds3', 'supporterCooldownSeconds4', 'supporterCooldownSeconds5', 'supporterCooldownSeconds6',
    'supporterUses1', 'supporterUses2', 'supporterUses3', 'supporterUses4', 'supporterUses5', 'supporterUses6', 
    'supporterLimit1', 'supporterLimit2', 'supporterLimit3', 'supporterLimit4', 'supporterLimit5', 'supporterLimit6']
const rolePermissions = ['punishmentsWarnings', 'punishmentsSuspensions', 'punishmentsMutes']
var commands = []
var commandsRolePermissions = []

const menus = ['roles', 'channels', 'voice', 'voiceprefixes', 'backend', 'numerical', 'runreqs', 'autoveri',
'vetverireqs', 'points', 'commands', 'categories', 'lists', 'strings', 'quotapoints', 'modmail', 'commandsRolePermissions', 'supporter',
'rolePermissions']

module.exports = {
    name: 'setup',
    description: 'set names of stuff',
    role: 'moderator',
    /**
     *
     * @param {Discord.Message} message
     * @param {Array} args
     * @param {Discord.Client} bot
     * @param {*} db
     */
    async execute(message, args, bot, db) {
        if (!commands) commands = Array.from(bot.commands.keys())
        if (args.length == 0) {
            let setupEmbed = new Discord.EmbedBuilder()
                .setTitle('Setup')
                .setColor('#54d1c2')
                .setFooter({ text: `Type 'cancel' to stop` })
                .setDescription(`\`\`\`coffeescript\nPlease select what you wish to edit:\n${menus.map((m, i) => `[ ${`${parseInt(i) + 1}`.padStart(3, ' ')} ] ${m}`).join('\n')}\`\`\``)
            let setupMessage = await message.channel.send({ embeds: [setupEmbed] })
            let mainMenu = new Discord.MessageCollector(message.channel, { filter: m => m.author.id == message.author.id })
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
                        case '12': menu(categories, 'categories', 'string'); break;
                        case '13': menu(lists, 'lists', 'array'); break;
                        case '14': menu(strings, 'strings', 'string'); break;
                        case '15': menu(quotapoints, 'quotapoints', 'float'); break;
                        case '16': menu(modmail, 'modmail', 'boolean'); break;
                        case '17': menu(commandsRolePermissions, 'commandsRolePermissions', 'string'); break;
                        case '18': menu(supporter, 'supporter', 'int'); break;
                        case '19': menu(rolePermissions, 'rolePermissions', 'string'); break;
                    }
                }
                /**
                 *
                 * @param {Array} array
                 * @param {String} arrayName
                 * @param {String} type
                 */
                async function menu(array, arrayName, type) {
                    setupEmbed.setTitle(`${arrayName} Menu`)
                        .setDescription(`\`\`\`coffeescript\nPlease select what you wish to edit`)
                    let fieldIndex = 0;
                    let padSize = 0;
                    for (let i in array) {
                        if (padSize < array[i].length) {
                            padSize = array[i].length;
                        }
                    }
                    padSize = padSize + 3;
                    for (let i in array) {
                        settings = bot.settings[message.guild.id]
                        arrayItem = bot.settings[message.guild.id][arrayName][array[i]]
                        let s = `\n${`${parseInt(i) + 1}`.padStart(3, ' ')}: ${array[i].padEnd(padSize, ' ')} ${type == 'array' ? `- ${arrayItem.length} Items` : `'${arrayItem}'`}`
                        if (setupEmbed.data.description.length + s.length + `\n\`\`\``.length >= 2048) {
                            if (!setupEmbed.data.fields || !setupEmbed.data.fields[fieldIndex]) setupEmbed.addFields([{ name: '** **', value: `\`\`\`coffeescript\n${s}` }])
                            else if (setupEmbed.data.fields[fieldIndex].value.length + s.length + `\n\`\`\``.length >= 1024) {
                                fieldIndex++
                                setupEmbed.addFields([{ name: '** **', value: `\`\`\`coffeescript\n${s}` }])
                            } else setupEmbed.data.fields[fieldIndex].value += s;
                        } else setupEmbed.data.description += s
                    }
                    setupEmbed.data.description += `\n\`\`\``
                    for (let i = 0; i < fieldIndex + 1; i++) if (setupEmbed.data.fields && setupEmbed.data.fields[i]) setupEmbed.data.fields[i].value += '```'
                    await setupMessage.edit({ embeds: [setupEmbed] })
                    let menuCollector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id == message.author.id })
                    menuCollector.on('collect', async m => {
                        let num = m.content
                        if (m.content.replace(/[^0-9]/g, '') != m.content) {
                            if (m.content = 'cancel') {
                                setupMessage.delete()
                                message.react('✅')
                                menuCollector.stop()
                            } else message.channel.send('Invalid number recieved. Please try again')
                        } else if (['string', 'boolean', 'int', 'float'].includes(type)) {
                            menuCollector.stop()
                            setupEmbed.setDescription(`\`\`\`coffeescript\nPlease enter in the new value\`\`\`\nCurrent Value:\n**${array[parseInt(num) - 1]}** = ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]}`)
                            setupEmbed.spliceFields(0, 5)
                            setupMessage.edit({ embeds: [setupEmbed] })
                            let menuMessageCollector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id == message.author.id })
                            menuMessageCollector.on('collect', async mes => {
                                if (mes.content.toLowerCase() == 'cancel') {
                                    setupMessage.delete()
                                    message.react('✅')
                                    menuMessageCollector.stop()
                                } else {
                                    let change = `\`\`\`coffeescript\n${array[parseInt(num) - 1]}: ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]} -> ${mes.content}\`\`\``
                                    switch (type) {
                                        case 'string':
                                            let result = mes.content; if (['null', 'none'].includes(result.toLocaleLowerCase())) result = null
                                            bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = result; break;
                                        case 'boolean':
                                            if (mes.content.charAt(0).toLowerCase() == 't') {
                                                change = `\`\`\`coffeescript\n${array[parseInt(num) - 1]}: ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]} -> true\`\`\``
                                                bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = true
                                            } else {
                                                change = `\`\`\`coffeescript\n${array[parseInt(num) - 1]}: ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]} -> false\`\`\``
                                                bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = false
                                            }
                                            break;
                                        case 'int': bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = parseInt(mes.content); break;
                                        case 'float': bot.settings[message.guild.id][arrayName][[array[parseFloat(num) - 1]]] = parseFloat(mes.content); break;
                                    }
                                    fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err.toString()))
                                    setupEmbed.setDescription(change)
                                        .setTitle(`Changes Made`)
                                        .setFooter({ text: `Setup completed` })
                                        .spliceFields(0, 5)
                                    await setupMessage.edit({ embeds: [setupEmbed] })
                                    message.react('✅')
                                    mes.delete()
                                    menuMessageCollector.stop()
                                }
                            })
                            m.delete()
                        } else if (['array'].includes(type)) {
                            // Stop collector
                            menuCollector.stop()

                            // Get array value
                            let cur = bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]
                            if (!cur) { message.channel.send(`Error: Menu type not recognized`); return ErrorLogger.log(`Setup error:\ntype ${type}\narray name: ${arrayName}\nArray Info: ${array}`, bot) }

                            // Send current value and prompt for what to edit
                            // Create String of current values
                            let str = cur.map((v, i) => `${parseInt(i) + 1}: ${v}`).join('\n')

                            // Send
                            setupEmbed.setDescription(`\`\`\`coffeescript\nPlease select a value to REMOVE\n\nCurrent Values:\n${str}\`\`\`\nOr Say "add", "new", or "clear"`)
                            setupMessage.edit({ embeds: [setupEmbed] })

                            // Add reaction collector
                            const collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id == message.author.id })
                            collector.on('collect', async m => {
                                let change = '\`\`\`coffeescript\nErrored\`\`\`'
                                if (m.content.toLowerCase() == 'add' || m.content.toLowerCase() == 'new') {
                                    // End collector
                                    collector.stop()

                                    // Prompt for new value
                                    setupEmbed.setDescription(`\`\`\`coffeescript\nPlease enter in the new value\`\`\`\nCurrent Value:\n**${array[parseInt(num) - 1]}** = ${bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]]}`)
                                    setupMessage.edit({ embeds: [setupEmbed] })
                                    const newCollector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id == message.author.id })
                                    newCollector.on('collect', async mes => {
                                        if (mes.content.toLowerCase() == 'cancel') {
                                            setupMessage.delete()
                                            message.react('✅')
                                            newCollector.stop()
                                        } else {
                                            change = `\`\`\`coffeescript\n${mes.content} added to ${arrayName}\`\`\``
                                            bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]].push(mes.content)
                                            newCollector.stop()
                                            exit()
                                        }
                                    })

                                } else if (m.content.toLowerCase() == 'clear') {
                                    // End collector
                                    collector.stop()

                                    // Clear array
                                    bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]] = []

                                    // Update embed/Return
                                    change = `\`\`\`coffeescript\nCleared Array ${arrayName}\`\`\``
                                    exit()
                                } else if (m.content.toLowerCase() == 'cancel') {
                                    setupMessage.delete()
                                    message.react('✅')
                                    collector.stop()
                                } else {
                                    // Send and delete try again prompt if not valid number
                                    if (isNaN(parseInt(m.content))) { let m = await message.channel.send(`Response not recognized. Try again.`); setTimeout(() => m.delete(), 5000); return }

                                    // Proceed with Deletion
                                    collector.stop()
                                    let selectionIndex = parseInt(m.content) - 1

                                    // Ensure selection is in range
                                    let selection = cur[selectionIndex]
                                    if (!selection) { change = `Value not found. Assuming it was already deleted.`; return exit() }

                                    // Delete
                                    try {
                                        bot.settings[message.guild.id][arrayName][[array[parseInt(num) - 1]]].splice(selectionIndex, 1)
                                        change = `\`\`\`coffeescript\nRemoved ${selection}\`\`\``
                                    } catch (er) {
                                        change = `\`\`\`coffeescript\nError removing from list. Try again\`\`\``
                                    } finally { exit() }
                                }
                                async function exit() {
                                    fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err.toString()))
                                    setupEmbed.setDescription(change)
                                        .setTitle(`Changes Made`)
                                        .setFooter({ text: `Setup completed` })
                                    await setupMessage.edit({ embeds: [setupEmbed] })
                                    message.react('✅')
                                    m.delete()
                                }
                            })

                        } else if (['object'].includes(type)) {
                            //soon:tm:
                            message.channel.send(`Error: Menu type not implemented`)
                            ErrorLogger.log(`Setup error:\ntype ${type}\narray name: ${arrayName}\nArray Info: ${array}`, bot)
                        } else {
                            message.channel.send(`Error: Menu type not recognized`)
                            ErrorLogger.log(`Setup error:\ntype ${type}\narray name: ${arrayName}\nArray Info: ${array}`, bot)
                        }
                    })
                }
            })
        }
    },
    autoSetup(guild, bot) {
        if (commands.length == 0) commands = Array.from(bot.commands.keys())
        if (commandsRolePermissions.length == 0) commandsRolePermissions = Array.from(bot.commands.keys())
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
                commands: {},
                categories: {},
                lists: {},
                strings: {},
                quotapoints: {},
                modmail: {},
                commandsRolePermissions: {},
                supporter: {},
                rolePermissions: {}
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
                let c = guild.channels.cache.find(c => c.name === getDefaultChannelName(channel) && c.type == Discord.ChannelType.GuildText)
                if (c) bot.settings[guild.id].channels[channel] = c.id
                else bot.settings[guild.id].channels[channel] = null
            }
        }
        for (let i in voice) {
            let v = voice[i]
            if (!bot.settings[guild.id].voice[v]) {
                let vc = guild.channels.cache.find(c => c.name === getDefaultVoiceName(v) && c.type == Discord.ChannelType.GuildVoice)
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
            if (!bot.settings[guild.id].numerical[n] && bot.settings[guild.id].numerical[n] != 0) {
                bot.settings[guild.id].numerical[n] = getDefaultNumericalValue(n)
            }
        }
        for (let i in runreqs) {
            let r = runreqs[i]
            if (!bot.settings[guild.id].runreqs[r] && bot.settings[guild.id].runreqs[r] != 0) {
                bot.settings[guild.id].runreqs[r] = getDefaultRunReqs(r)
            }
        }
        for (let i in autoveri) {
            let r = autoveri[i]
            if (!bot.settings[guild.id].autoveri[r] && bot.settings[guild.id].autoveri[r] != 0) {
                bot.settings[guild.id].autoveri[r] = getDefaultAutoVeriReqs(r)
            }
        }
        for (let i in vetverireqs) {
            let r = vetverireqs[i]
            if (!bot.settings[guild.id].vetverireqs[r] && bot.settings[guild.id].vetverireqs[r] != 0) {
                bot.settings[guild.id].vetverireqs[r] = getDefaultVetReqs(r)
            }
        }
        for (let i in points) {
            let r = points[i]
            if (!bot.settings[guild.id].points[r] && bot.settings[guild.id].points[r] != 0) {
                bot.settings[guild.id].points[r] = getDefaultPointValue(r)
            }
        }
        for (let key in bot.settings[guild.id].points) {
            if (!points.includes(key)) { delete bot.settings[guild.id].points[key] }
        }
        for (let i of commands) {
            if (!bot.settings[guild.id].commands[i] && bot.settings[guild.id].commands[i] !== false) bot.settings[guild.id].commands[i] = bot.commands.get(i).guildSpecific ? false : true //this might not work lol
        }
        for (let key in bot.settings[guild.id].commands) {
            if (!commands.includes(key)) { delete bot.settings[guild.id].commands[key] }
        }
        for (let i of commandsRolePermissions) {
            if (!bot.settings[guild.id].commandsRolePermissions[i] && bot.settings[guild.id].commandsRolePermissions[i] !== false) bot.settings[guild.id].commandsRolePermissions[i] = null
        }
        for (let key in bot.settings[guild.id].commandsRolePermissions) {
            if (!commands.includes(key)) { delete bot.settings[guild.id].commandsRolePermissions[key] }
        }
        for (let i of categories) {
            if (!bot.settings[guild.id].categories[i]) bot.settings[guild.id].categories[i] = getDefaultCategoryName(i)
        }
        if (!bot.settings[guild.id].lists) bot.settings[guild.id].lists = {}
        for (let i of lists) {
            if (!bot.settings[guild.id].lists[i]) bot.settings[guild.id].lists[i] = []
        }
        if (!bot.settings[guild.id].strings) bot.settings[guild.id].strings = {}
        for (let i of strings) {
            if (!bot.settings[guild.id].strings[i]) bot.settings[guild.id].strings[i] = null
        }
        for (let i in quotapoints) {
            let n = quotapoints[i]
            if (!bot.settings[guild.id].quotapoints[n] && bot.settings[guild.id].quotapoints[n] != 0) {
                bot.settings[guild.id].quotapoints[n] = getDefaultQuotaPoint(n)
            }
        }
        for (let i in modmail) {
            if (!bot.settings[guild.id].modmail[modmail[i]]) {
                bot.settings[guild.id].modmail[modmail[i]] = true
            }
        }
        for (let i in supporter) {
            if (!bot.settings[guild.id].supporter[supporter[i]]) {
                bot.settings[guild.id].supporter[supporter[i]] = 0
            }
        }
        for (let i of rolePermissions) {
            if (!bot.settings[guild.id].rolePermissions[i]) bot.settings[guild.id].rolePermissions[i] = null
        }
        fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err.toString()))
    }
}

function getDefaultRoleName(name) {
    switch (name) {
        case 'moderator': return 'Moderator'
        case 'officer': return 'Officer'
        case 'headrl': return 'Head Raid Leader'
        case 'vetrl': return 'Veteran Raid Leader'
        case 'fsvrl': return 'Fullskip Boi VRL'
        case 'mrvrl': return 'Master Reader VRL'
        case 'security': return 'Security'
        case 'fullskip': return 'Fullskip'
        case 'headdev': return 'Head Developer'
        case 'developer': return 'Developer'
        case 'assistantdev': return 'Assistant Developer'
        case 'rl': return 'Raid Leader'
        case 'warden': return 'Warden'
        case 'almostrl': return 'Almost Raid Leader'
        case 'trialrl': return 'Trial Raid Leader'
        case 'headeventrl': return 'Head Event Organizer'
        case 'eventrl': return 'Event Organizer'
        case 'rusher': return 'Official Rusher'
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
        case 'moddedkey': return 'Modded Key Popper'
        case 'bottomkey': return 'Verified Key Popper'
        case 'cultping': return 'Cult boi'
        case 'voidping': return 'Void boi'
        case 'shattsReact': return 'Shatters boi'
        case 'fungalReact': return 'Fungal boi'
        case 'nestReact': return 'Nest boi'
        case 'fameReact': return 'Fame Boi'
        case 'rcPing': return 'RC Boi'
        case 'o3Ping': return 'Oryx Boi'
        case 'eventBoi': return 'Event Boi'
        case 'priest': return 'Supreme Priest'
        case 'vetaffiliate': return 'Veteran Affiliate Staff'
        case 'affiliatestaff': return 'Affiliate Staff'
        case 'toprune': return 'Veteran Rune Popper'
        case 'bottomrune': return 'Verified Rune Popper'
        case 'helper': return 'Helper'
        case 'steamworksping': return 'Steamworks boi'
        case 'moonlightping': return 'Moonlight boi'
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
        case 'botstatus': return 'bot-status';
        case 'keyalerts': return 'key-alerts';
        case 'activitylog': return 'activity-log';
        case 'raidingrules': return 'raiding-rules';
        case 'exaltstatus': return 'exalt-status-announcements';
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
        case 'topkey': return 50;
        case 'bottomkey': return 15;
        case 'ticketlimit': return 5;
        case 'supporterlimit': return 8;
        case 'keyalertsage': return 120;
        case 'waitnewkeyalert': return 30;
        case 'prunerushersoffset': return 90;
        case 'topkey': return 45;
        case 'bottomkey': return 15;
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
        case 'supportermultiplier': return 2;
        case 'keypop': return 20;
        case 'vialpop': return 3;
        case 'rushing': return 1;
        case 'brain': return 1;
        case 'mystic': return 1;
        case 'eventkey': return 2;
        case 'cultlocation': return 20;
        case 'voidlocation': return 25;
        case 'fsvlocation': return 30;
        case 'o3streaming': return 5;
        case 'o3trickster': return 3;
        case 'o3puri': return 3;
        case 'exaltkey': return 5;
        case 'shattskey': return 5;
        case 'fungalkey': return 5;
        case 'nestkey': return 5;
        case 'keymultiplier': return 2;
        case 'runepop': return 20;
        case 'incpop': return 5;
        case 'steamworkkey': return 5;
        case 'moonlightkey': return 5;
    }
}

function getDefaultCategoryName(name) {
    switch (name) {
        case 'raiding': return 'raiding';
        case 'veteran': return 'veteran raiding'
        case 'event': return 'events'
    }
}

function getDefaultQuotaPoint(name) {
    switch (name) {
        case 'voidLeading': return 1;
        case 'cultLeading': return 1;
        case 'shattersLeading': return 1;
        case 'oryx3Leading': return 1;
        case 'fungalLeading': return 1;
        case 'nestLeading': return 1;
        case 'steamworkLeading': return 1;
        case 'moonlightLeading': return 1;
        case 'eventLeading': return 1;
        case 'failedRun': return 1;
        case 'feedback': return 1;
        case 'feedbackOnFeedback': return 1;
        case 'assist': return 0.5;
        case 'parsing': return 1;
        case 'rolledquota': return 1;
    }
}
