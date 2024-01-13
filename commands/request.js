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
        const raidIDs = afkCheck.returnRaidIDsbyAll(bot, message.member.id, voiceChannel ? voiceChannel.id : null, args.shift())
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
                const label = `${bot.afkChecks[raidID].afkTemplateName} by ${bot.afkChecks[raidID].leader?.nickname ?? bot.afkChecks[raidID].leader?.user?.id}`
                text += `\n\`\`${index+1}.\`\` ${label} at <t:${Math.floor(bot.afkChecks[raidID].time/1000)}:f>`
                locationMenu.addOptions({ label: `${index+1}. ${label}`, value: raidID })
                index++
            }
            const {value: locationValue, interaction: subInteraction} = await message.selectPanel(text, null, locationMenu, 30000, false, true)
            if (!locationValue) return await message.reply('You must specify the raid to request a react.')
            raidID = locationValue
        }

        const raid = bot.afkChecks[raidID]
        message.react('✅')

        let text = `Which react would you like to request more of for the run?`
        const reactsMenu = new Discord.StringSelectMenuBuilder()
            .setPlaceholder(`Reacts`)
            .setMinValues(1)
            .setMaxValues(1)
        Object.keys(raid.buttons).forEach((key) => { if (raid.buttons[key].type == AfkTemplate.TemplateButtonType.NORMAL || raid.buttons[key].type == AfkTemplate.TemplateButtonType.LOG || raid.buttons[key].type == AfkTemplate.TemplateButtonType.LOG_SINGLE) reactsMenu.addOptions({ label: `${key}`, value: `${key}` }) })
        const {value: reactsValue, interaction: subInteractionReacts} = await message.selectPanel(text, null, reactsMenu, 30000, false, true)
        if (!reactsValue) return

        text = `How many of the react would you like to request for the run?`
        const numbersMenu = new Discord.StringSelectMenuBuilder()
            .setPlaceholder(`Number`)
            .setMinValues(1)
            .setMaxValues(1)
            .setOptions(
                { label: '1', value: '1' },
                { label: '2', value: '2' },
                { label: '3', value: '3' },
            )
        const {value: numberValue, interaction: subInteractionNumber} = await message.selectPanel(text, null, numbersMenu, 30000, false, true)
        if (!numberValue) return

        bot.afkModules[raidID].updateReactsRequest(reactsValue, numberValue)
    }
}