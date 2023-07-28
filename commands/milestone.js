const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const extensions = require(`../lib/extensions`)
const milestones = require('../data/milestone.json')

module.exports = {
    name: 'milestone',
    description: 'Gives users milestones',
    args: '(user)',
    role: 'raider',
    async execute(message, args, bot, db) {
        let member
        if (args.length == 0) member = message.member
        if (!member) member = message.guild.findMember(args.join(''))
        if (!member) return message.reply('Could not find a member.')
        const embed = extensions.createEmbed(message, `__**Milestone Stats for**__ ${member} ${member ? '\`' + (member.nickname || member.user.tag) + '\`' : ''}\n\nHold on... Processing`)
        embed.setColor('#015c21')
        let milestoneMessage = await message.reply({ embeds: [embed] })

        let [userRows,] = await db.promise().query('SELECT * FROM completionruns WHERE userid = ? AND unixtimestamp > ?', [member.id, bot.settings[message.guild.id].numerical.milestoneStartTimestamp])

        for (let milestoneName of Object.keys(milestones[message.guild.id])) {
            let filteredUserRows = userRows.filter(row => milestones[message.guild.id][milestoneName].templateIDs.includes(parseInt(row.templateid)))
            let completed = filteredUserRows.length
            let milestoneNumber = 0
            let recentMilestoneNumber = 0
            let milestoneIndex = 0
            let index = 0
            while (completed >= milestoneNumber) {
                recentMilestoneNumber = milestones[message.guild.id][milestoneName].milestones[index].number
                milestoneNumber += recentMilestoneNumber
                milestoneIndex++
                if (!milestones[message.guild.id][milestoneName].milestones[index].recurring) index++
            }
            let progress = 1 - ((milestoneNumber - completed) / recentMilestoneNumber)
            let filled = Math.floor(progress * 20)
            let empty = 20 - filled
            const name = `${bot.storedEmojis[milestones[message.guild.id][milestoneName].emoji].text} **${milestoneName}** ${bot.storedEmojis[milestones[message.guild.id][milestoneName].emoji].text} \`${milestoneIndex}\``
            const value = `**\`${completed.toString().padStart(3)}\` ${'█'.repeat(filled)}${'▁'.repeat(empty)} \`${milestoneNumber.toString().padStart(3)}\`**`
            embed.addFields({ name: name, value: value, inline: false })
        }
        embed.setDescription(`__**Milestone Stats for**__ ${member} ${member ? '\`' + (member.nickname || member.user.tag) + '\`' : ''}`)
        
        await milestoneMessage.edit({ embeds: [embed] })
    }
}
