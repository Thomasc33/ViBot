const Discord = require('discord.js')
const afkCheck = require('./afkCheck.js')

module.exports = {
    name: 'location',
    description: 'Changes the location of the current run',
    alias: ['loc'],
    requiredArgs: 1,
    args: '<location>',
    role: 'eventrl',
    async execute(message, args, bot) {
        let voiceChannel = message.member.voice.channel
        let location = args.join(' ')
        if (location.length >= 1024) return await message.channel.send('Location must be below 1024 characters, try again')
        if (location == '') location = 'None'
        let raidID = undefined
        const raidIDs = afkCheck.returnRaidIDsbyAll(bot, message.member.id, voiceChannel ? voiceChannel.id : null, null)
        if (raidIDs.length == 0) return message.channel.send('Could not find an active run. Please try again.')
        else if (raidIDs.length == 1) raidID = raidIDs[0]
        else {
            const locationMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Active Runs`)
                .setMinValues(1)
                .setMaxValues(1)
            let text = `Which active run would you like to change location for?.\n If no response is received, the command will use the default run at \`\`${1}.\`\`.`
            let index = 0
            for (let raidID of raidIDs) {
                text += `\n\`\`${index+1}.\`\` ${bot.afkChecks[raidID].afkTemplate.name} by ${bot.afkChecks[raidID].leader} at <t:${Math.floor(bot.afkChecks[raidID].time/1000)}:f>`
                locationMenu.addOptions({ label: `${index+1}. ${bot.afkChecks[raidID].afkTemplate.name} by ${bot.afkChecks[raidID].leader}`, value: raidID })
                index++
            }
            const {value: locationValue, interaction: subInteraction} = await message.selectPanel(text, null, locationMenu, 30000, false, true)
            raidID = locationValue
        }
        bot.afkChecks[raidID].location = location
        bot.afkModules[raidID].updateLocation()
        message.react('✅')
    }
}