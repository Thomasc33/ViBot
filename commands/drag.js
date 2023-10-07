const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'drag',
    description: 'Starts a process where it will drag all of the users mentioned to your current voice channel',
    role: 'eventrl',
    requiredArgs: 1,
    args: '[users/ids/mentions]',
    async execute(message, args, bot, db) {
        if (!message.member.voice) { return message.channel.send('You are not in any voice channel') }
        const users = []
        const toBeMoved = []
        const haveBeenMoved = []
        const usersCouldntFind = []
        const minutes = 5
        const intervalTicker = 5
        let intervalCounter = minutes * 60
        let interval = true
        const memberVoice = message.member.voice
        for (const i in args) {
            const memberSearch = args[i]
            let member = null
            if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D+/gi, ''))
            if (!member && /#\d{4}$/.test(memberSearch)) member = message.guild.members.cache.find(user => user.user.tag.toLowerCase() == memberSearch.toLowerCase())
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.toLowerCase() == memberSearch || nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()))
            if (!member) usersCouldntFind.push(memberSearch)
            else users.push(member)
        }
        for (const i in users) { toBeMoved.push(users[i]) }
        embed = new Discord.EmbedBuilder()
            .setColor('#00D166')
            .addFields(
                { name: 'Move Pending', value: 'Setting up please hold', inline: false },
                { name: 'Have Been Moved', value: 'Setting up please hold', inline: false }
            )
            .setFooter({ text: "Press 'Stop' to stop the process" })
        if (usersCouldntFind.length > 0) { embed.addFields({ name: 'Could not find', value: `${usersCouldntFind.map(user => user).join(', ')}`, inline: false })}
        component = new Discord.ActionRowBuilder().addComponents([
            new Discord.ButtonBuilder()
                .setLabel('Stop')
                .setStyle(4)
                .setCustomId('stop')
        ])
        const messageDashboard = await message.channel.send({ embeds: [embed], components: [component] })
        messageDashboardCollector = new Discord.InteractionCollector(bot, { message: messageDashboard, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        messageDashboardCollector.on('collect', interaction => interactionHandler(interaction))

        timer = setInterval(async () => {
            if (toBeMoved.length == 0) { interval = false }
            async function endProcess() {
                embed.setColor('#0099E1')
                embed.setFooter({ text: 'Process has stopped at' })
                embed.setTimestamp()
                embed = updateEmbed(embed, toBeMoved, haveBeenMoved)
                await messageDashboard.edit({ embeds: [embed], components: [] })
                clearInterval(timer)
                messageDashboardCollector.stop()
            }
            if (!interval) {
                await endProcess()
                return
            }
            const movedUsers = await moveUsersIn(toBeMoved, memberVoice, message.guild)
            for (const i in toBeMoved) {
                user = toBeMoved[i]
                if (movedUsers.includes(user.id)) {
                    toBeMoved.splice(i, 1)
                    haveBeenMoved.push(user)
                }
            }
            embed = updateEmbed(embed, toBeMoved, haveBeenMoved)
            await messageDashboard.edit({ embeds: [embed] })
            if (toBeMoved.length == 0) { interval = false }
            if (!interval) {
                await endProcess()
                return
            }
            intervalCounter -= intervalTicker
            if (intervalCounter <= 0) interval = false
        }, intervalTicker * 1000)

        async function interactionHandler(interaction) {
            if (!interaction.isButton()) { return }
            if (interaction.customId === 'stop') {
                interval = false
                await interaction.deferUpdate()
            }
        }

        async function moveUsersIn(users, voiceChannel, guild) {
            const updatedUsers = []
            const movedUsers = []
            for (const i in users) { user = users[i]; updatedUsers.push(guild.members.cache.get(user.id)) }
            for (const i in updatedUsers) {
                member = updatedUsers[i]
                if (member.voice) {
                    let moved = true
                    await member.voice.setChannel(voiceChannel.channelId).catch(er => { moved = false })
                    if (moved) { movedUsers.push(member.id) }
                }
            }
            return movedUsers
        }
        function updateEmbed(embed, userListToBeMoved, userListHaveBeenMoved) {
            embed.data.fields[0].value = userListToBeMoved.length > 0 ? `${userListToBeMoved.map(user => user).join(', ')}` : 'None!'
            embed.data.fields[1].value = userListHaveBeenMoved.length > 0 ? `${userListHaveBeenMoved.map(user => user).join(', ')}` : 'None!'
            return embed
        }
    }
}
