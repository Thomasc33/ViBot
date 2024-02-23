const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment')
const { settings } = require('../lib/settings');

module.exports = {
    name: 'script',
    description: 'You can not run this command either way',
    requiredArgs: 1,
    guildspecific: true,
    role: 'developer',
    async execute(message, args) {
        if (!['258286481167220738', '277636691227836419'].includes(message.author.id)) return message.react('❌')
        if (args[0] == 'ben') {
            const options = [
                {
                    "emoji": "🦍",
                    "animal": "Gorilla"
                },
                {
                    "emoji": "🐒",
                    "animal": "Monkey"
                },
                {
                    "emoji": "🦊",
                    "animal": "Fox"
                },
                {
                    "emoji": "🐈",
                    "animal": "Cat"
                },
                {
                    "emoji": "🐎",
                    "animal": "Horse"
                }
            ]
            const animal = Math.floor(Math.random() * options.length)

            let confirmEmbed = new Discord.EmbedBuilder()
                .setTitle('❌ WARNING ❌')
                .setDescription('**__By confirming you would run the script provided by Ben.__**\n\n*If you are unfamiliar with it or not prepared to proceed after this, I recommend declining and trying again when ready.\n**Once accepted there is no turning back***')
                .setColor('#FF0000')
            await message.channel.send({ embeds: [confirmEmbed] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(message.author.id)) {
                    let secondConfirmEmbed = new Discord.EmbedBuilder()
                        .setTitle('I lied 😘')
                        .setDescription('React with the animal that is bolded.\nJust for fun.')
                        .setColor('#DDA0A0')
                    secondConfirmEmbed.addFields({
                        name: `🐩 Animals 🦄`,
                        value: `${options.map(index => `${index.emoji} ${index.emoji == options[animal].emoji ? `**__${index.animal}__**` : `${index.animal}`}`).join('\n')}`,
                        inline: false
                    })
                    await message.channel.send({ embeds: [secondConfirmEmbed] }).then(async secondConfirmMessage => {
                        const choice = await secondConfirmMessage.confirmList(options.map(option => option.emoji), message.author.id)
                        if (!choice || choice == 'Cancelled') {
                            await confirmMessage.delete()
                            await secondConfirmMessage.delete()
                            return
                        }
                        if (options[animal].emoji != choice) {
                            await confirmMessage.delete()
                            await secondConfirmMessage.delete()
                            return
                        }
                        let embed = new Discord.EmbedBuilder()
                            .setTitle('Started')
                            .setDescription(`Script started <t:${moment().unix()}:R>\n*Please wait patiently as I run through all users.\nThis may take some time\nSit back and relax. I will direct message you once this is done.*`)
                            .setColor('#FF0000')
                        let statisticMessage = await message.channel.send({ embeds: [embed] })
                        const allUnverifiedUsers = message.guild.members.cache.filter(member => {
                            if (member.roles.cache.has(settings[message.guild.id].roles.raider)) { return false }
                            if (member.nickname !== null && member.nickname !== '') {
                                return true
                            }
                        })
                        const allUnverifiedUsersID = allUnverifiedUsers.map(member => member.id)
                        for (let index in allUnverifiedUsersID) {
                            let member = allUnverifiedUsersID[index]
                            member = message.guild.members.cache.get(member)
                            try { await member.roles.add(settings[message.guild.id].roles.raider) } catch (e) { console.log(e) }
                            await new Promise(resolve => setTimeout(resolve, 250))
                        }

                        embed.setTitle('Statistics')
                        embed.setDescription(`*Comannd has finished running*`)
                        embed.setColor('#FF0000')
                        await message.react('✅')
                        await message.author.send(`Hello ${message.author} I have completed the script\nYou may view some statistics here: ${statisticMessage.url}`)
                        await statisticMessage.edit({ embeds: [embed] })
                    })
                } else {
                    message.react('❌')
                    return await confirmMessage.delete()
                }
            })
        } else if (args[0] == 'modmail') {
            message.react('✅')
            try {
                const fs = require('fs')
                const modmail_channel = message.guild.channels.cache.get('525683068745547776')
                let messages = await getMessages(modmail_channel, 100000)

                const mm_and_res = messages.reduce((acc, { author, embeds }) => {
                    if (author.id !== '589996847083290629' || embeds.length !== 1) return acc

                    const [embed] = embeds
                    const { description, fields } = embed.data || {}

                    // Ensure modmail embeds
                    if (!fields || fields.length !== 1 || !description || !/\*\*sent the bot\*\*/.test(description)) return acc

                    const [field] = fields

                    // Filter for only modmails that got a response
                    if (!/Response by/.test(field.name) || !field.value || field.value.length === 0) return acc

                    const mm = description.replace(/<@!\d+?>/g, '').replace(' **sent the bot**\n', '').replace('\t', '')
                    const r = field.value.replace('\t', '')

                    acc.push([mm, r])
                    return acc
                }, [])

                fs.writeFileSync('data/modmail.csv', mm_and_res.map(e => e.join('\t')).join('\n'))
            } catch (er) {
                message.reply('Error occured')
                console.log(er)
            }
        }
    }
}


async function getMessages(channel, limit) {
    const sum_messages = []
    let last_id
    while (true) {
        const options = { limit: 100 }
        if (last_id) {
            options.before = last_id
        }
        const messages = await channel.messages.fetch(options)
        sum_messages.push(...messages.map(m => m))
        last_id = messages.last().id
        if (messages.size != 100 || sum_messages.length >= limit) {
            break
        }
        console.log(sum_messages.length + ' / ' + limit + ' messages\t' + (sum_messages.length / limit * 100).toFixed(2) + '%')
    }
    return sum_messages
}