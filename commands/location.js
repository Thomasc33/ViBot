const Discord = require('discord.js')
const afkCheck = require('./afkCheck.js');

module.exports = {
    name: 'location',
    description: 'Changes the location of the current run',
    alias: ['loc'],
    requiredArgs: 1,
    args: '<location>',
    role: 'eventrl',
    async execute(message, args, bot) {
        let location = args.join(' ')
        if (location.length >= 1024) return await message.channel.send('Location must be below 1024 characters, try again')
        if (location == '') location = 'None'
        let raidID = undefined
        const raidIDs = afkCheck.returnRaidIDsbyMemberID(bot, message.member.id)
        if (raidIDs.length == 0) return message.channel.send('There is no active run to change the location of')
        else if (raidIDs.length == 1) raidID = raidIDs[0]
        else {
            const locationMenu = new Discord.StringSelectMenuBuilder()
                .setCustomId(`location`)
                .setPlaceholder(`Active Runs`)
                .setMinValues(1)
                .setMaxValues(1)
            for (let raidID of raidIDs) locationMenu.addOptions({ label: `${bot.afkCheck[raidID].afkTemplate.name} ${bot.afkCheck[raidID].time}`, value: raidID })
            const locationMessage = await message.channel.send({ content: `${message.member}`, components: [] })
            const locationValue = await locationMessage.selectPanel(locationMenu, this.#message.member.id, 10000)
            await locationMessage.delete()
            raidID = locationValue
        }
        bot.afkCheck[raidID].location = location
        bot.afkCheck[raidID].afk.updateLocation()
        message.react('✅')
    }
}