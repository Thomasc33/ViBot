const botSettings = require('../settings.json')
const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const afkCheck = require('./afkCheck.js');

require(`../lib/extensions`)
module.exports = {
    name: 'request',
    description: 'If you need more keys or in the event someone fake reacts, simply use this command and a message will be sent to raid-status/vet-status where a new raider can react and get sent location',
    args: '<number of reacts requested>',
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
        //check vc for an active afk check
        let vc = message.member.voice.channel
        if (!vc) return message.channel.send('Join a VC to request')
        let afkRuns = afkCheck.runs
        let found = false, afk
        for (let i of afkRuns) if (i.channel == vc.id && i.afk.active) { found = true; afk = i.afk }
        if (!found || !afk) return message.channel.send('No active afk checks found')
        if (args[0]) if (isNaN(parseInt(args[0]))) return message.channel.send('Invalid number of reacts requested')
        let num = args[0] ? parseInt(args[0]) : 1

        customIds = []
        for (let componentRow of afk.raidStatusMessage.components) {
            for (let component of componentRow.components) {
                if (component.disabled) customIds.push(component.data.emoji.name)
            }
        }
        if (customIds.length == 0) return message.channel.send('All reacts still have slots available, no need to request.')
        
        //prompt for what emote to request
        let promptEmbed = new Discord.EmbedBuilder()
            .setDescription('Select a reaction to request')
        const components = []
        const actionRows = []
        let curRow = []
        function addButton(button) {
            if (curRow.length >= 5) { actionRows.push(curRow); curRow = [] }
            let b = new Discord.ButtonBuilder({ ...button })
            curRow.push(b)
        }

        for (let customId of customIds) addButton({ emoji: bot.storedEmojis[customId].id, style: Discord.ButtonStyle.Secondary, customId: `req_${customId}` })
        if (curRow.length > 0) actionRows.push(curRow)
        for (let i of actionRows) { let n = new Discord.ActionRowBuilder({ components: i }); components.push(n) }
        let m = await message.channel.send({ embeds: [promptEmbed], components: components })

        let interactionCollector = new Discord.InteractionCollector(bot, {message: m, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })

        interactionCollector.on('collect', async subInteraction => {
            subInteraction.deferUpdate()
            m.editButton({[subInteraction.component.customId]: { label: null, disabled: true }})
            let raidStatusEmbed = new Discord.EmbedBuilder()
                .setDescription(`A ${bot.storedEmojis[subInteraction.component.emoji.name].text} has been requested in ${afk.channel}.`)
            let button = new Discord.ButtonBuilder({ emoji: subInteraction.component.emoji, label: `0/${num}`, style: Discord.ButtonStyle.Secondary, customId: subInteraction.component.emoji.name })
            let rm = afk.raidStatus.send({ embeds: [raidStatusEmbed], components: [new Discord.ActionRowBuilder({ components: [button] })] })
            let rsInteractionCollector = new Discord.InteractionCollector(bot, {message: rm, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
            rsInteractionCollector.on('collect', (interaction) => afkCheck.requestButtonHandler(interaction, vc.id, num))
        })
    }
}