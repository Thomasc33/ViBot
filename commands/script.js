const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const moment = require('moment')

module.exports = {
    name: 'script',
    description: 'You can not run this command either way',
    requiredArgs: 0,
    guildspecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        if (!['258286481167220738', '290956326224396288'].includes(message.author.id)) return message.react('❌')
        const settings = bot.settings[message.guild.id]

        if (!settings.backend.useUnverifiedRole) {
            return message.reply('`useUnverifiedRole` Is disabled inside of `backend`\nTo enable this\n`;setup` -> `backend` -> `useUnverifiedRole`')
        }

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
        const animal = Math.floor(Math.random() * options.length);

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
                    let unverifiedUsers = 0
                    let verifiedUsers = 0
                    let suspendedUsers = 0
                    let alreadyUnverifiedUsers = 0
                    const allUnverifiedUsers = message.guild.members.cache.filter(member => {
                        if (member.roles.cache.has(settings.roles.raider)) { verifiedUsers++; return false; }
                        if (member.roles.cache.has(settings.roles.tempsuspended)) {suspendedUsers++; return false; }
                        if (member.roles.cache.has(settings.roles.permasuspended)) {suspendedUsers++; return false; }
                        if (member.roles.cache.has(settings.roles.unverified)) {alreadyUnverifiedUsers++; return false; }
                        unverifiedUsers++;
                        return true
                    })
                    const allUnverifiedUsersID = allUnverifiedUsers.map(member => member.id)
                    for (let index in allUnverifiedUsersID) {
                        let member = allUnverifiedUsersID[index]
                        member = message.guild.members.cache.get(member)
                        try { await member.roles.add(settings.roles.unverified) } catch (e) { console.log(e) }
                        await new Promise(resolve => setTimeout(resolve, 250))
                    }

                    embed.setTitle('Statistics')
                    embed.setDescription(`*Comannd has finished running*\n\n**Unverified Users: \`\`${unverifiedUsers}\`\`\nVerified Users: \`\`${verifiedUsers}\`\`\nSuspended Users:** \`\`${suspendedUsers}\`\`\nAlready Unverified Users: \`\`${alreadyUnverifiedUsers}\`\``)
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
    }
}
