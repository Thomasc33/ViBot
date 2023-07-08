const Discord = require('discord.js')
const AfkTemplate = require('./afkTemplate.js')
const afkCheck = require('./afkCheck.js')

require(`../lib/extensions`)
module.exports = {
    name: 'request',
    description: 'If you need more keys or in the event someone fake reacts, simply use this command and a message will be sent to raid-status/vet-status where a new raider can react and get sent location\nThis command is completely interactive.',
    args: '(VC ID or RSA Message ID)',
    alias: ['rq'],
    role: 'eventrl',
    /**
     * 
     * @param {Discord.Message} message 
     * @param {Array} args 
     * @param {Discord.Client} bot 
     * @param {*} db 
     */
    async execute(message, args, bot, db) {
        let voiceChannel = message.member.voice.channel
        let raidID = undefined
        const raidIDs = afkCheck.returnRaidIDsbyAll(bot, message.member.id, voiceChannel ? voiceChannel.id : null, null)
        if (raidIDs.length == 0) return message.channel.send('Could not find an active run. Please try again.')
        else if (raidIDs.length == 1) raidID = raidIDs[0]
        else {
            const locationMenu = new Discord.StringSelectMenuBuilder()
                .setPlaceholder(`Active Runs`)
                .setMinValues(1)
                .setMaxValues(1)
            let text = `Which active run would you like to change location for?`
            let index = 0
            for (let raidID of raidIDs) {
                text += `\n\`\`${index+1}.\`\` ${bot.afkChecks[raidID].afkTemplate.name} by ${bot.afkChecks[raidID].leader} at <t:${bot.afkChecks[raidID].time}:f>`
                locationMenu.addOptions({ label: `${index+1}. ${bot.afkChecks[raidID].afkTemplate.name} by ${bot.afkChecks[raidID].leader}`, value: index })
                index++
            }
            const {value: locationValue, interaction: subInteraction} = await message.selectPanel(text, null, locationMenu, 30000, false, true)
            if (!locationValue) return
            raidID = locationValue
        }

        const raid = bot.afkChecks[raidID]
        message.react('✅')

        let text = `Which react would you like to request more of for the run?`
        const reactsMenu = new Discord.StringSelectMenuBuilder()
            .setPlaceholder(`Reacts`)
            .setMinValues(1)
            .setMaxValues(1)
        Object.keys(raid.afkTemplate.buttons).forEach((key) => { if (raid.afkTemplate.buttons[key].type == AfkTemplate.TemplateButtonType.NORMAL || raid.afkTemplate.buttons[key].type == AfkTemplate.TemplateButtonType.LOG) reactsMenu.addOptions({ label: `${key}`, value: `${key}` }) })
        const {value: reactsValue, interaction: subInteraction} = await message.selectPanel(text, null, reactsMenu, 30000, false, true)
        if (!reactsValue) return
        bot.afkModules[raidID].updateReactsRequest(reactsValue)
    }
}