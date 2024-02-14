const Discord = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

module.exports = {
    name: 'location',
    slashCommandName: 'location',
    description: 'Changes the location of the current run',
    alias: ['loc'],
    varargs: true,
    requiredArgs: 1,
    args: [
        slashArg(SlashArgType.String, 'location', {
            description: 'new location for the raid',
            maxLength: 1024,
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
    async autocomplete(interaction, bot) {
        const raidIdMappings = Object.keys(bot.afkModules).filter(raidId => bot.afkModules[raidId].guild.id == interaction.guild.id).map(raidId => ({
            name: bot.afkModules[raidId].afkTitle(),
            value: raidId }));
        const focusedValue = interaction.options.getFocused().trim().toLowerCase();
        const filteredValues = raidIdMappings.filter(raidIdMapping => raidIdMapping.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filteredValues);
    },
    async execute(message, args, bot) {
        let location = args.join(' ');
        if (location.length >= 1024) return await message.reply('Location must be below 1024 characters, try again');
        if (location == '') location = 'None';

        const raidIDs = Object.keys(bot.afkModules).filter(raidId => bot.afkModules[raidId].guild.id == message.guild.id);
        const raidID = await determineRaidID(message, bot, raidIDs);

        await handleLocationUpdate(message, bot, location, raidID);
    },
    async slashCommandExecute(interaction, bot) {
        const location = interaction.options.getString('location');
        let raidID = interaction.options.getString('raid');

        // check validity of raidID
        const raidIDs = Object.keys(bot.afkModules).filter(raidId => bot.afkModules[raidId].guild.id == interaction.guild.id);
        // if options didn't have a raidID or had an invalid one, figure out which raid to select
        if (!raidID || (raidID && !raidIDs.includes(raidID))) raidID = await determineRaidID(interaction, bot, raidIDs);
        if (!raidID) return interaction.reply({ content: 'Command failed', ephemeral: true }); // error message already sent in determineRaidID

        await handleLocationUpdate(interaction, bot, location, raidID);
    }
};

/**
 * Detemines the raid ID to use for the location update, based on available raid IDs, then voice channel, then user selection
 * @param {Discord.Message} message - original command interaction
 * @param {Discord.Client} bot - bot client
 * @param {string[]} raidIDs - array of active raid IDs
 * @returns {string} raidID selection
 */
async function determineRaidID(message, bot, raidIDs) {
    const voiceChannel = message.member.voice?.channel;
    if (raidIDs.length == 0) return message.reply('Could not find an active run. Please try again.');
    if (raidIDs.length == 1) return raidIDs[0];
    if (voiceChannel) {
        const matchingRaidID = raidIDs.find(raidId => bot.afkModules[raidId].channel?.id == voiceChannel.id);
        if (matchingRaidID) return matchingRaidID;
    }

    const locationMenu = new Discord.StringSelectMenuBuilder()
        .setPlaceholder('Active Runs')
        .setMinValues(1)
        .setMaxValues(1);
    let text = 'Which active run would you like to change location for?';
    let index = 0;
    for (const raidID of raidIDs) {
        const label = `${bot.afkModules[raidID].afkTitle()}`;
        text += `\n\`\`${index + 1}.\`\` ${label} at <t:${Math.floor(bot.afkModules[raidID].timer / 1000)}:f>`;
        locationMenu.addOptions({ label: `${index + 1}. ${label}`, value: raidID });
        index++;
    }
    const locationValue = await message.selectPanel(text, null, locationMenu, 30000, false, true);
    if (!locationValue) return await message.reply('You must specify the raid to change a location.');
    return locationValue.value;
}

/**
 * Handles the location update for the raid
 * @param {Discord.Message} message - original command interaction
 * @param {Discord.Client} bot - bot client
 * @param {string} location - new location for the raid
 * @param {string} raidID - raid ID to update location for
 */
async function handleLocationUpdate(message, bot, location, raidID) {
    // bot.afkChecks[raidID].location = location; // remove this or nah?
    bot.afkModules[raidID].updateLocation();

    const locationUpdateEmbed = new Discord.EmbedBuilder()
        .setAuthor({ name: `${message.member.displayName}`, iconURL: message.member.avatarURL() })
        .setTitle('Location Updated')
        .setDescription(`Set location for ${bot.afkModules[raidID].afkTitle()} to \`${location}\``);
    await message.reply({ embeds: [locationUpdateEmbed] });
}
