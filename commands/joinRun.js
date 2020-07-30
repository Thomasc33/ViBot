const Discord = require('discord.js')

module.exports = {
    name: 'joinrun',
    alias: ['join'],
    description: 'Join back into the VC of a run incase you get disconnected',
    role: 'raider',
    dms: true,
    async execute(message, args, bot, db) {
        this.findChannel(message, bot, message.guild)
    },
    async dmExecution(message, args, bot, db, guild) {
        this.findChannel(message, bot, guild)
    },
    async findChannel(message, bot, guild) {
        let runsIn = []
        for (let i in bot.afkChecks) {
            if (bot.afkChecks[i].raiders.includes(message.author.id) || bot.afkChecks[i].earlyLocation.includes(message.author.id)) {
                runsIn.push(i)
            }
        }
        if (runsIn.length == 0) { message.channel.send('I could not find any runs that you were a part of. If you were not in the voice channel when the afk check ended, you should leave the run before you get suspended.') }
        else if (runsIn.length == 1) { this.moveIn(guild.members.cache.get(message.author.id), runsIn[0]).catch(er => message.channel.send('Join lounge, then try this command again')) }
        else {
            let runEmbed = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setTitle('Which run are you trying to enter?')
                .setFooter('Please join lounge before selecting an option')
                .setDescription('None!')
            for (let i in runsIn) {
                if (!guild.channels.cache.get(runsIn[i])) continue
                fitStringIntoEmbed(runEmbed, `**${parseInt(i) + 1}:** ${guild.channels.cache.get(runsIn[i]).name}\n*${Math.round((Date.now() - bot.afkChecks[runsIn[i]].time) / 60000)} minutes ago*\n`, message.channel)
            }
            let joinEmbedMessage = await message.channel.send(runEmbed)
            let runMessageCollector = new Discord.MessageCollector(message.channel, m => m.author.id == message.author.id)
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
                        this.moveIn(guild.members.cache.get(message.author.id), runId)
                        joinEmbedMessage.delete()
                        runMessageCollector.stop()
                        message.react('✅')
                    }
                }
            })
        }
    },
    async moveIn(member, runId) {
        if (member.voice.channel) member.voice.setChannel(runId, 'joinrun').catch(er => member.send('Please connect to lounge and try again'))
        else member.send('Please connect to lounge and try again')
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + string.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + string.length >= 1024) {
            if (embed.length + string.length + 1 >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + string.length >= 6000) {
                channel.send(embed)
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`\n${string}`))
    }
}