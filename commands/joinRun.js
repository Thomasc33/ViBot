const Discord = require('discord.js')

module.exports = {
    name: 'joinrun',
    alias: ['join', 'drag', 'move'],
    description: 'Join back into the VC of a run incase you get disconnected',
    role: 'raider',
    dms: true,
    dmNeedsGuild: true,
    async execute(message, args, bot, db) {
        this.findChannel(message, bot, message.guild)
    },
    async dmExecution(message, args, bot, db, guild) {
        this.findChannel(message, bot, guild)
    },
    async findChannel(message, bot, guild) {
        let runsIn = []
        for (let i in bot.afkChecks) {
            if (bot.afkChecks[i].raiders && bot.afkChecks[i].earlyLocation && (bot.afkChecks[i].raiders.includes(message.author.id) || bot.afkChecks[i].earlyLocation.includes(message.author.id))) {
                runsIn.push(i)
            }
        }
        if (runsIn.length == 0) { message.channel.send('I could not find any runs that you were a part of. If you were not in the voice channel when the afk check ended, you should leave the run before you get suspended.') } else if (runsIn.length == 1) { this.moveIn(guild.members.cache.get(message.author.id), runsIn[0], bot).catch(er => message.channel.send('Join lounge, then try this command again')) } else {
            let runEmbed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Which run are you trying to enter?')
                .setFooter({ text: 'Please join lounge before selecting an option'})
                .setDescription('None!')
            for (let i in runsIn) {
                if (!guild.channels.cache.get(runsIn[i])) continue
                fitStringIntoEmbed(runEmbed, `**${parseInt(i) + 1}:** ${guild.channels.cache.get(runsIn[i]).name}\n*${Math.round((Date.now() - bot.afkChecks[runsIn[i]].time) / 60000)} minutes ago*\n`, message.channel)
            }
            let joinEmbedMessage = await message.channel.send({ embeds: [runEmbed] })
            let runMessageCollector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id == message.author.id})
            runMessageCollector.on('collect', async m => {
                if (m.content.replace(/[^0-9]/g, '') != m.content) {
                    if (m.content == 'cancel') {
                        joinEmbedMessage.delete()
                        runMessageCollector.stop()
                        message.react('✅')
                    }
                    let retryMessage = await message.channel.send(`\`${m.content}\` is not a valid number. Please try again or type \`cancel\` to cancel`)
                    setTimeout(() => retryMessage.delete(), 5000)
                } else {
                    let runId = runsIn[parseInt(m.content) - 1]
                    if (!runId) {
                        let retryMessage = await message.channel.send(`\`${m.content}\` is not a valid number. Please try again or type \`cancel\` to cancel`)
                        setTimeout(() => retryMessage.delete(), 5000)
                    } else {
                        this.moveIn(guild.members.cache.get(message.author.id), runId, bot)
                        joinEmbedMessage.delete()
                        runMessageCollector.stop()
                        message.react('✅')
                    }
                }
            })
        }
    },
    async moveIn(member, runId, bot) {
        if (bot.afkChecks[runId].split) {
            let afkCheck = bot.afkChecks[runId]
            if (afkCheck.mainGroup.includes(member.id)) {
                if (member.voice.channel) member.voice.setChannel(runId, 'joinrun').catch(er => member.send('Please connect to lounge and try again'))
                else member.send('Please connect to lounge and try again')
            } else {
                let splitChannelID = afkCheck.splitChannel
                if (splitChannelID == 'na') {
                    if (member.voice.channel) member.voice.setChannel(runID, 'joinrun').catch(er => member.send('Please connect to lounge and try again'))
                    else member.send('Please connect to lounge and try again')
                } else {
                    if (member.voice.channel) member.voice.setChannel(splitChannel, 'joinrun').catch(er => member.send('Please connect to lounge and try again'))
                    else member.send('Please connect to lounge and try again')
                }
            }
        } else {
            if (member.voice.channel) member.voice.setChannel(runId, 'joinrun').catch(er => member.send('Please connect to lounge and try again'))
            else member.send('Please connect to lounge and try again')
        }

    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `\n${string}`.length >= 2048) {
        if (embed.data.fields.length == 0) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
            if (embed.data.length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (embed.data.length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`\n${string}`))
    }
}