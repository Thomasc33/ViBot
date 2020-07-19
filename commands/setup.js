const fs = require('fs')
const Discord = require('discord.js')

module.exports = {
    name: 'setup',
    description: 'set names of stuff',
    role: '(Admin)',
    async execute(message, args, bot, db) {
        let setupEmbed = new Discord.MessageEmbed()
            .setTitle('Setup')
            .setColor('#54d1c2')
            .setDescription(`\`\`\`Please select what you wish to edit:
1: Roles
2: Text Channels
3: Voice Channels
4: Backend\`\`\``)
        let setupMessage = await message.channel.send(setupEmbed)
        let mainMenu = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
        mainMenu.on('collect', async m => {
            if (m.content.replace(/[^0-9]/g, '') != m.content) {
                if (m.content = 'cancel') {
                    await setupMessage.delete()
                    await message.react('✅')
                    mainMenu.stop()
                }
                message.channel.send('Invalid number recieved. Please try again')
            } else {
                await m.delete()
                mainMenu.stop()
                switch (m.content) {
                    case '1':
                        setupEmbed.setTitle('Roles Menu')
                            .setDescription(`\`\`\`Please select what you wish to edit
1: Moderator
2: Officer
3: HRL
4: Sec
5: Dev
6: VRL
7: FS
8: RL
9: ARL
10: TRL
11: EO
12: Rusher
13: Nitro
14: LoL
15: Veteran Raider
16: Raider
17: Events
18: Muted
19: Temp Suspended
20: Perma Suspended
21: Vet Banned
22: Temp Key Popper\`\`\``)
                        await setupMessage.edit(setupEmbed)
                        let rolesMenu = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                        rolesMenu.on('collect', async m => {
                            let num = m.content
                            if (m.content.replace(/[^0-9]/g, '') != m.content) {
                                if (m.content = 'cancel') {
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    rolesMenu.stop()
                                }
                                message.channel.send('Invalid number recieved. Please try again')
                            } else {
                                rolesMenu.stop()
                                setupEmbed.setDescription('\`\`\`Please enter in the new role name\`\`\`')
                                setupMessage.edit(setupEmbed)
                                let newRoleNameCollector = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                                newRoleNameCollector.on('collect', async mes => {
                                    let newRoleName = mes.content
                                    switch (num) {
                                        case '1': bot.settings[message.guild.id].moderator = newRoleName; break;
                                        case '2': bot.settings[message.guild.id].officer = newRoleName; break;
                                        case '3': bot.settings[message.guild.id].hrl = newRoleName; break;
                                        case '4': bot.settings[message.guild.id].sec = newRoleName; break;
                                        case '5': bot.settings[message.guild.id].developer = newRoleName; break;
                                        case '6': bot.settings[message.guild.id].vrl = newRoleName; break;
                                        case '7': bot.settings[message.guild.id].fs = newRoleName; break;
                                        case '8': bot.settings[message.guild.id].rl = newRoleName; break;
                                        case '9': bot.settings[message.guild.id].arl = newRoleName; break;
                                        case '10': bot.settings[message.guild.id].trl = newRoleName; break;
                                        case '11': bot.settings[message.guild.id].eo = newRoleName; break;
                                        case '12': bot.settings[message.guild.id].rusher = newRoleName; break;
                                        case '13': bot.settings[message.guild.id].nitro = newRoleName; break;
                                        case '14': bot.settings[message.guild.id].lol = newRoleName; break;
                                        case '15': bot.settings[message.guild.id].vetraider = newRoleName; break;
                                        case '16': bot.settings[message.guild.id].raider = newRoleName; break;
                                        case '17': bot.settings[message.guild.id].raider = newRoleName; break;
                                        case '18': bot.settings[message.guild.id].events = newRoleName; break;
                                        case '19': bot.settings[message.guild.id].muted = newRoleName; break;
                                        case '20': bot.settings[message.guild.id].tempsuspended = newRoleName; break;
                                        case '21': bot.settings[message.guild.id].psuspended = newRoleName; break;
                                        case '22': bot.settings[message.guild.id].tempkey = newRoleName; break;
                                        default: message.channel.send('error (number not found)'); break;
                                    }
                                    fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err))
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    await mes.delete()
                                    newRoleNameCollector.stop()
                                })
                                m.delete()
                            }
                        })
                        break;
                    case '2':
                        setupEmbed.setTitle('Text Channels Menu')
                            .setDescription(`\`\`\`Please select what you wish to edit
1: Mod Mail Channel
2: Verification
3: Veri-Pending
4: Vet Verificiation
5: Pending Vet Veri
6: Veri-Log
7: Mod Logs
8: Suspend Logs
9: Vial Logs
10: RL Feedback Channel
11: Current Week (raiding)
12: Current Week (events)
13: Past Weeks (raiding)
14: Past Weeks (events)
15: Leading Logs
16: Leader-chat
17: VRL Chat
18: Crasher List
19: Raid Status
20: Raid Commands
21: Raid Channels
22: Vet Status
23: Vet Commands
24: Vet Channels
25: Event Status
26: Event Commands
27: Event Channels
28: Run Info
29: History\`\`\``)
                        await setupMessage.edit(setupEmbed)
                        let textMenu = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                        textMenu.on('collect', async m => {
                            let num = m.content
                            if (m.content.replace(/[^0-9]/g, '') != m.content) {
                                if (m.content = 'cancel') {
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    textMenu.stop()
                                }
                                message.channel.send('Invalid number recieved. Please try again')
                            } else {
                                textMenu.stop()
                                setupEmbed.setDescription('\`\`\`Please enter in the new channel name\`\`\`')
                                setupMessage.edit(setupEmbed)
                                let newRoleNameCollector = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                                newRoleNameCollector.on('collect', async mes => {
                                    let newRoleName = mes.content
                                    switch (num) {
                                        case '1': bot.settings[message.guild.id].modmailchannel = newRoleName; break;
                                        case '2': bot.settings[message.guild.id].verify = newRoleName; break;
                                        case '3': bot.settings[message.guild.id].veri = newRoleName; break;
                                        case '4': bot.settings[message.guild.id].vetverify = newRoleName; break;
                                        case '5': bot.settings[message.guild.id].vetveri = newRoleName; break;
                                        case '6': bot.settings[message.guild.id].verilog = newRoleName; break;
                                        case '7': bot.settings[message.guild.id].modlog = newRoleName; break;
                                        case '8': bot.settings[message.guild.id].suspendlog = newRoleName; break;
                                        case '9': bot.settings[message.guild.id].viallog = newRoleName; break;
                                        case '10': bot.settings[message.guild.id].rlfeedback = newRoleName; break;
                                        case '11': bot.settings[message.guild.id].currentweekchannel = newRoleName; break;
                                        case '12': bot.settings[message.guild.id].eventcurrentweek = newRoleName; break;
                                        case '13': bot.settings[message.guild.id].pastweeks = newRoleName; break;
                                        case '14': bot.settings[message.guild.id].pasteventweeks = newRoleName; break;
                                        case '15': bot.settings[message.guild.id].leadinglogs = newRoleName; break;
                                        case '16': bot.settings[message.guild.id].leaderchat = newRoleName; break;
                                        case '17': bot.settings[message.guild.id].vetleaderchat = newRoleName; break;
                                        case '18': bot.settings[message.guild.id].crasherlist = newRoleName; break;
                                        case '19': bot.settings[message.guild.id].raidstatus = newRoleName; break;
                                        case '20': bot.settings[message.guild.id].raidcommands = newRoleName; break;
                                        case '21': bot.settings[message.guild.id].activechannels = newRoleName; break;
                                        case '22': bot.settings[message.guild.id].vetstatus = newRoleName; break;
                                        case '23': bot.settings[message.guild.id].vetcommands = newRoleName; break;
                                        case '24': bot.settings[message.guild.id].vetchannels = newRoleName; break;
                                        case '25': bot.settings[message.guild.id].eventstatus = newRoleName; break;
                                        case '26': bot.settings[message.guild.id].eventcommands = newRoleName; break;
                                        case '27': bot.settings[message.guild.id].eventchannels = newRoleName; break;
                                        case '28': bot.settings[message.guild.id].runinfo = newRoleName; break;
                                        case '29': bot.settings[message.guild.id].history = newRoleName; break;
                                        default: message.channel.send('error (number not found)'); break;
                                    }
                                    fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err))
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    await mes.delete()
                                    newRoleNameCollector.stop()
                                })
                                m.delete()
                            }
                        })
                        break;
                    case '3':
                        setupEmbed.setTitle('Voice Channels Menu')
                            .setDescription(`\`\`\`Please select what you wish to edit
1: Raiding Template
2: Vet Template
3: Event Template
4: Raiding Prefix
5: Veteran Prefix\`\`\``)
                        await setupMessage.edit(setupEmbed)
                        let voiceMenu = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                        voiceMenu.on('collect', async m => {
                            let num = m.content
                            if (m.content.replace(/[^0-9]/g, '') != m.content) {
                                if (m.content = 'cancel') {
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    voiceMenu.stop()
                                }
                                message.channel.send('Invalid number recieved. Please try again')
                            } else {
                                voiceMenu.stop()
                                setupEmbed.setDescription('\`\`\`Please enter in the new channel name\`\`\`')
                                setupMessage.edit(setupEmbed)
                                let newRoleNameCollector = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                                newRoleNameCollector.on('collect', async mes => {
                                    let newRoleName = mes.content
                                    switch (num) {
                                        case '1': bot.settings[message.guild.id].raidingtemplate = newRoleName; break;
                                        case '2': bot.settings[message.guild.id].vettemplate = newRoleName; break;
                                        case '3': bot.settings[message.guild.id].eventtemplate = newRoleName; break;
                                        case '4': bot.settings[message.guild.id].raidprefix = newRoleName; break;
                                        case '5': bot.settings[message.guild.id].vetprefix = newRoleName; break;
                                        default: message.channel.send('error (number not found)'); break;
                                    }
                                    fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err))
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    await mes.delete()
                                    newRoleNameCollector.stop()
                                })
                                m.delete()
                            }
                        })
                        break;
                    case '4':
                        setupEmbed.setTitle('Backend Menu')
                            .setDescription(`\`\`\`Please select what you wish to edit
1: Mod Mail
2: Current Week
3: Event Current Week
4: Verification
5: Vet Verification
6. Points System\`\`\``)
                        await setupMessage.edit(setupEmbed)
                        let backendMenu = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                        backendMenu.on('collect', async m => {
                            let num = m.content
                            if (m.content.replace(/[^0-9]/g, '') != m.content) {
                                if (m.content = 'cancel') {
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    backendMenu.stop()
                                }
                                message.channel.send('Invalid number recieved. Please try again')
                            } else {
                                backendMenu.stop()
                                setupEmbed.setDescription('\`\`\`Please enter t/f\`\`\`')
                                setupMessage.edit(setupEmbed)
                                let newRoleNameCollector = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
                                newRoleNameCollector.on('collect', async mes => {
                                    let newValue = false
                                    if (mes.content.charAt(0).toLowerCase() == 't') newValue = true
                                    switch (num) {
                                        case '1': bot.settings[message.guild.id].modmail = newValue; break;
                                        case '2': bot.settings[message.guild.id].currentweek = newValue; break;
                                        case '3': bot.settings[message.guild.id].eventCurrentweek = newValue; break;
                                        case '4': bot.settings[message.guild.id].verification = newValue; break;
                                        case '5': bot.settings[message.guild.id].vetVerification = newValue; break;
                                        case '6': bot.settings[message.guild.id].points = newValue; break;
                                        default: message.channel.send('error (number not found)'); break;
                                    }
                                    fs.writeFileSync('./guildSettings.json', JSON.stringify(bot.settings, null, 4), err => message.channel.send(err))
                                    await setupMessage.delete()
                                    await message.react('✅')
                                    await mes.delete()
                                    newRoleNameCollector.stop()
                                })
                                m.delete()
                            }
                        })
                        break;
                }
            }
        })
    }
}