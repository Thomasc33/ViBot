const Discord = require('discord.js')
const afkCheck = require('./afkCheck.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js');

module.exports = {
    name: 'location',
    description: 'Changes the location of the current run',
    alias: ['loc'],
    varargs: 1, // TODO check if this is necessary
    requiredArgs: 1,
    args: [
        slashArg(SlashArgType.String, 'location', {
            description: 'new location for the raid',
            required: true
        }),
        slashArg(SlashArgType.String, 'raid', {
            description: 'raid to change location for',
            required: false,
            autocomplete: true
        })
    ],
    role: 'eventrl',
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    async autocomplete(interaction) {
        const raidIdMappings = Object.keys(bot.afkModules).filter(raidId => bot.afkModules[raidId].guild.id == interaction.guild.id).map(raidId => ({
            name: bot.afkModules[raidId].afkTitle(),
            value: raidId })); // may need some null-proofing here, unsure if I should bother
        if (raidIdMappings.length == 0) { return; }
        const focusedValue = interaction.options.getFocused().trim().toLowerCase();
        const filteredValues = raidIdMappings.filter(raidIdMapping => raidIdMapping.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filteredValues);
    },
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
                const label = `${bot.afkChecks[raidID].afkTemplateName} by ${bot.afkChecks[raidID].leader?.nickname ?? bot.afkChecks[raidID].leader?.user?.id}`
                text += `\n\`\`${index+1}.\`\` ${label} at <t:${Math.floor(bot.afkChecks[raidID].time/1000)}:f>`
                locationMenu.addOptions({ label: `${index+1}. ${label}`, value: raidID })
                index++
            }
            const {value: locationValue, interaction: subInteraction} = await message.selectPanel(text, null, locationMenu, 30000, false, true)
            if (!locationValue) return await message.reply('You must specify the raid to change a location.')
            raidID = locationValue
        }
        bot.afkChecks[raidID].location = location
        bot.afkModules[raidID].updateLocation()
        message.react('✅')
    }
}