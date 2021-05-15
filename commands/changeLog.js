const Discord = require('discord.js')
//const logTypes = ['keypops', 'eventpops', 'cultsLead', 'voidsLead', 'assists', 'solocult', 'vialStored', 'vialUsed', 'cultRuns', 'voidRuns', 'eventsLead', 'parses', 'o3parses', 'feedback', 'o3assists', 'o3runs', 'o3feedback']
const db = require('../data/changelog.json')

module.exports = {
    name: 'changelog',
    role: 'headrl',
    description: 'Changes logs',
    args: '<user> <add/remove/set> <log type> <#>',
    requiredArgs: 4,
    getNotes(guildid, member) {
        return getLogTypes(guildid).toString()
    },
    async execute(message, args, bot, db) {
        if (args.length < 4) return
        let logTypes = getLogTypes(message.guild.id)
        let currentweek = getCurrentWeekTypes(message.guild.id) || []
        if (!logTypes) return message.channel.send('No stored log types')

        //args 0
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found');

        //args 1
        let operator = args[1].charAt(0).toLowerCase()
        if (operator != 'a' && operator != 'r' && operator != 's') return message.channel.send(`\`${args[1]}\` not recognized. Please try \`add, remove, or set\``)

        //args 2
        let logType = args[2].toLowerCase()
        let logIndex = logTypes.findIndex(e => logType == e.toLowerCase())
        if (logIndex == -1) return message.channel.send(`\`${args[2]}\` not recognized. Check out \`;commands changelog\` for a list of log types`)

        //args 3
        let count = parseInt(args[3])
        if (!count) return message.channel.send(`${args[3]} is not a valid number`)

        //change logs
        let query = `UPDATE users SET ${logTypes[logIndex]} = `
        switch (operator) {
            case 'a':
                query += `${logTypes[logIndex]} + ${count} `
                break;
            case 'r':
                query += `${logTypes[logIndex]} - ${count} `
                break;
            case 's':
                query += `${count} `
                break;
        }
        query += `WHERE id = '${member.id}'`

        //confirm
        let confirmEmbed = new Discord.MessageEmbed()
            .setTitle(`Confirm Action`)
            .setDescription(`${args[1]} ${count} ${logTypes[logIndex]} to ${member}`)
        let confirmMessage = await message.channel.send(confirmEmbed)
        confirmMessage.react('✅')
        confirmMessage.react('❌')
        let confirmReactionCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => u.id == message.author.id)
        confirmReactionCollector.on('collect', async (r, u) => {
            if (r.emoji.name == '✅') {
                confirmReactionCollector.stop()
                await confirmMessage.delete()
                if (operator != 's') {
                    for (let i of currentweek) {
                        if (i.case == logTypes[logIndex]) {
                            let currentWeekConfirmEmbed = new Discord.MessageEmbed()
                                .setTitle('Confirm Action')
                                .setDescription('Do you also want to add/remove this from currentweek?')
                            let currentweekConfirmMessage = await message.channel.send(currentWeekConfirmEmbed)
                            currentweekConfirmMessage.react('✅')
                            currentweekConfirmMessage.react('❌')
                            let currentweekConfirmCollector = new Discord.ReactionCollector(currentweekConfirmMessage, (r, u) => u.id == message.author.id)
                            currentweekConfirmCollector.on('collect', async (r, u) => {
                                if (r.emoji.name == '✅') {
                                    currentweekConfirmMessage.delete()
                                    currentweekConfirmCollector.stop()
                                    let currentWeekQuery = `UPDATE users SET `
                                    let currentWeekName = i.currentWeekName
                                    if (operator == 'a') currentWeekQuery += `${currentWeekName} = ${currentWeekName} + ${count} `
                                    else currentWeekQuery += `${currentWeekName} = ${currentWeekName} - ${count} `
                                    currentWeekQuery += `WHERE id = '${member.id}'`
                                    db.query(currentWeekQuery, (err, rows) => {
                                        if (err) message.channel.send(`\`${err}\``)
                                    })
                                } else if (r.emoji.name == '❌') {
                                    currentweekConfirmMessage.delete()
                                    currentweekConfirmCollector.stop()
                                }
                                sendQuery()
                            })
                        }
                    }
                } else {
                    sendQuery()
                }

                function sendQuery() {
                    db.query(query, (err, rows) => {
                        if (err) message.channel.send(`\`${err}\``)
                        message.react('✅')
                    })
                }
            } else if (r.emoji.name == '❌') {
                confirmReactionCollector.stop()
                await confirmMessage.delete()
            }
        })
    }
}

function getLogTypes(guildid) {
    return db[guildid] ? db[guildid].logtypes : null
}
function getCurrentWeekTypes(guildid) {
    return db[guildid] ? db[guildid].currentweeks : null
}