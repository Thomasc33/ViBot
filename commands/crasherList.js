const Discord = require('discord.js')
const fs = require('fs')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'crasherlist',
    description: 'Crasher List Related Commands',
    role: 'officer',
    args: '<send/update/add/remove/preview>',
    requiredArgs: 1,
    execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length < 1) return message.channel.send('Please provide an argument')
        switch (args[0].toLowerCase()) {
            case 'send':
                this.send(message.guild.channels.cache.get(settings.channels.parsechannel), bot)
                break;
            case 'update':
                this.update(message, args, bot)
                break;
            case 'add':
                this.add(message, args, bot)
                break;
            case 'remove':
                this.remove(message, args, bot)
                break;
            case 'preview':
                this.send(message.channel, bot)
                break;
            default:
                message.channel.send('Option not found. Please try again')
        }
    },
    send(channel, bot) {
        if (!channel) return;
        let crashers = 'None!'
        let guildCrashers = bot.crasherList[channel.guild.id]
        if (!guildCrashers) return
        for (let i in guildCrashers) {
            if (crashers == 'None!') crashers = `/kick ${i}`
            else crashers += `\n/kick ${i}`
        }
        let embed = new Discord.EmbedBuilder()
            .setColor(`#ff0000`)
            .setDescription(`**First and foremost key poppers, we sincerly thank you for your contribution and investment into the server.**\n\nIn order to keep the runs as clean and efficient as possible, we need you to kick crashers from the runs. Below is a list of common crashers seen in our servers. If at any point you see any of these people in one of our runs, make sure to kick them:\n\n\`\`\`${crashers}\`\`\`\n\n**The messages bellow are the character parses for our runs.**\nIf the timestamp matches the run you are currently in, double check with the RL/Security who is parsing, then kick the people they tell you to kick.\n\n**Once again, we sincerely thank you for your investment in our server and for your cooperation**`)
        channel.send({ embeds: [embed] })
    },
    async add(message, args, bot) {
        message.channel.send(`Are you sure you want to add ${args[1].toLowerCase()} to the crasher list?`).then(async confirmMessage => {
            if (await confirmMessage.confirmButton(message.author.id)) {
                    if (!bot.crasherList[message.guild.id]) bot.crasherList[message.guild.id] = {}
                    bot.crasherList[message.guild.id][args[1].toLowerCase()] = {
                        addedBy: message.author.id,
                        added: Date.now()
                    }
                    fs.writeFileSync('./data/crasherList.json', JSON.stringify(bot.crasherList, null, 4), async function (err) {
                        if (err) ErrorLogger.log(err, bot, message.guild)
                        await message.channel.send(`${args[1].toLowerCase()} has been added to the crasher list. Would you like to update the message?`).then(async confirmMessageUpdater => {
                            if (await confirmMessageUpdater.confirmButton(message.author.id)) {
                                module.exports.update(message, args, bot)
                            } else {
                                return confirmMessageUpdater.delete();
                            }
                        })
                    })
                return confirmMessage.delete();
            } else {
                return confirmMessage.delete();
            }
        })
    },
    async remove(message, args, bot) {
        let found = false;
        let guildCrashers = bot.crasherList[message.guild.id]
        if (!guildCrashers) return message.channel.send('No crashers for this guild')
        for (let i in guildCrashers) {
            if (args[1].toLowerCase() == i) {
                found = true;
                let d = new Date(guildCrashers[i].added)
                let embed = new Discord.EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('Confirm Action')
                    .setDescription(`Are you sure you want to remove ${i} from the crasher list?`)
                    .addFields([
                        { name: 'Added By:', value: `<@!${guildCrashers[i].addedBy}>` },
                        { name: 'Added:', value: d.toDateString() },
                    ])
                await message.channel.send({ embeds: [embed] }).then(async confirmMessage => {
                    if (await confirmMessage.confirmButton(message.author.id)) {
                        delete bot.crasherList[message.guild.id][i];
                        fs.writeFileSync('./data/crasherList.json', JSON.stringify(bot.crasherList, null, 4), async function (err) {
                            reactionCollector.stop()
                            let newEmbed = new Discord.EmbedBuilder()
                                .setTitle('Confirm Action')
                                .setColor('#00ff00')
                                .setDescription(`${i} has been removed from the crasher list, would you like to update the crasher list?`)
                            await message.channel.send({ embeds: [newEmbed] }).then(async confirmMessageUpdater => {
                                if (confirmMessageUpdater.confirmButton(message.author.id)) {
                                    module.exports.update(message, args, bot)
                                    return confirmMessageUpdater.delete()
                                } else {
                                    return confirmMessageUpdater.delete()
                                }
                            })
                        })
                        return confirmMessage.delete()
                    } else {
                        return confirmMessage.delete()
                    }
                })
            }
        }
        if (!found) return message.channel.send(`${args[1].toLowerCase()} was not found.`)
    },
    async update(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        let crasherChannel = message.guild.channels.cache.get(settings.channels.parsechannel)
        if (!crasherChannel) return;
        await crasherChannel.bulkDelete(100)
        this.send(crasherChannel, bot)
    }
}