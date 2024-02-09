/**
 * Represents the 'parse' command.
 * @module parseCommand
 */

const Discord = require('discord.js');
const botSettings = require('../settings.json');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient(botSettings.gcloudOptions);

module.exports = {
    name: 'parse',
    description: 'read the name',
    alias: ['parse'],
    args: [
        slashArg(SlashArgType.Subcommand, 'members', {
            description: 'regular old parse',
            options: [
                slashArg(SlashArgType.Attachment, 'players', {
                    required: true,
                    description: '/who image'
                }),
                slashArg(SlashArgType.String, 'raid', {
                    autocomplete: true,
                    required: false,
                    description: 'The raid to parse'
                })
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'reacts', {
            description: 'Lists reacts for the run',
            options: [
                slashArg(SlashArgType.String, 'raid', {
                    autocomplete: true,
                    required: false,
                    description: 'The raid to parse'
                })
            ]
        }),
        slashArg(SlashArgType.Subcommand, 'basic', {
            description: 'Checks vc against /who only',
            options: [
                slashArg(SlashArgType.Attachment, 'players', {
                    required: true,
                    description: '/who image'
                }),
                slashArg(SlashArgType.String, 'vc', {
                    required: false,
                    description: 'The vc id to parse against (optional)'
                })
            ]
        })
    ],
    getNotes() {
        return {
            title: 'Subcommand Options',
            value: 'The slash version of this command is highly recommended!\n\n'
                + '`/parse members <raid> </who image>`\n'
                + '- This is the standard parse\n'
                + '- **Note:** you must include the RSA id of the raid to parse if using the legacy command\n\n'
                + '`/parse reacts <raid>`\n'
                + '- This displays raid reactions in a parse-friendly formatting output\n\n'
                + '`/parse basic (vc) </who image>`\n'
                + '- This parse only checks vc against /who players\n'
                + '- **Note:** This isn\'t the standard parse, use `/parse members` for that\n'
        };
    },
    /**
     * Returns the slash command data.
     * @param {Discord.Guild} guild - The guild object.
     * @returns {Object} The slash command data in JSON form.
     */
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    role: 'eventrl',
    /**
     * Handles autocomplete for the command.
     * @param {Object} interaction - The interaction object.
     * @param {Object} bot - The bot object.
     * @returns {Promise} A promise that resolves with the autocomplete result.
     */
    async autocomplete(interaction, bot) {
        const focusedOption = interaction.options.getFocused(true);
        switch (focusedOption.name) { // switch statement for future autocomplete types, may remove later
            case 'raid':
                return await filterRaidIds(interaction, bot);
            default:
        }
    },
    /**
     * Executes the command.
     * @param {Discord.Message} message - The message object.
     */
    async execute(message, args, bot) {
        const action = message.options.getSubcommand();
        switch (action) {
            case 'members':
                await parseMembers(message, bot);
                break;
            case 'reacts':
                break;
            case 'simple':
                break;
            default:
        }
    }
};

async function parseMembers(message, bot) {
    const playerImgURL = message.options.getAttachment('players')?.url;
    if (!playerImgURL) return message.reply('You must provide a /who image to parse.');
    const raid = bot.afkModules[message.options.getString('raid')] || getRaid(message, bot, message.member.voice?.channelID);
    if (!raid) return; // error message already sent in getRaid()

    const imgPlayers = await parseWhoImage(message, playerImgURL);
    if (!imgPlayers) return; // error message already sent in parseWhoImage()

    await runRaidParse(message, bot, raid, imgPlayers);
}

// async function parseReacts(message, bot) { }

// async function parseSimple(message, bot) { }

/**
 *
 * @param {Discord.Message} message - Command message object
 * @param {Discord.Client} bot - Bot object cutosm???
 * @param {AfkCheck} raid - the raid to parse
 * @param {String[]} imgPlayers - the names of the players in the /who image
 * @param {Discord.Message} parseStatusMessage - the message to edit with the status of the parse
 * @param {Discord.Embed} parseStatusEmbed - the embed to edit with the status of the parse
 */
// eslint-disable-next-line complexity
async function runRaidParse(message, bot, raid, imgPlayers) {
    const minimumStaffRolePosition = message.guild.roles.cache.get(botSettings.roles.almostrl).position;
    const raiders = imgPlayers.map(player => player.toLowerCase());
    const members = raid.isVcless() ? raid.members : bot.channels.cache.get(raid.channel.id).members.map(m => m.id);

    /** @type {{ id: string, nicknames: string[] }[]} */
    const alts = [];
    /** @type {string[]} */
    const crashers = [];
    const kick = [];
    const find = [];
    const otherChannel = [];
    const allowedCrashers = [];

    for (const player of raiders) {
        const member = message.guild.findMember(player);
        if (!member) {
            crashers.push(player);
            kick.push(player);
        } else if (!members.includes(member.id)) {
            if (member.roles.highest.position >= minimumStaffRolePosition) continue;

            if (!raid.isVcless()) {
                if (raid.members.includes(member.id)) allowedCrashers.push(member.id);
                if (member.voice.channel) otherChannel.push(`${member}: ${member.voice.channel}`);
                else crashers.unshift(`${member}`);
            } else crashers.unshift(`${member}`);

            kick.push(player);
            find.push(player);
        }
    }

    for (const memberId of members) {
        const member = message.guild.members.cache.get(memberId);
        if (member.roles.highest.position > minimumStaffRolePosition) continue;
        if (!member.nickname) continue;
        const nicknames = member.nickname.toLowerCase().replace(/[^a-z|]/gi, '').split('|');
        if (!raiders.some(raider => nicknames.includes(raider)) && !alts.some(alt => alt.id == member.id)) alts.push({ id: member.id, nicknames });
    }

    const normalizedCrashers = crashers.map(normalizeName);
    const normalizedAlts = alts.map(({ id, nicknames }) => ({ id, nicknames: nicknames.map(normalizeName) }));
    const results = reassembleAndCheckNames(normalizedCrashers, normalizedAlts);
    const [matchKeys, matchValues] = [Array.from(results.keys()), Array.from(results.values())];

    const actualCrashers = crashers.filter((_, idx) => !matchValues.some(m => m.parts.includes(normalizedCrashers[idx])));
    const possibleAlts = normalizedAlts.filter(alt => !matchKeys.some(full => alt.nicknames.some(name => full == name))).map(alt => `<@${alt.id}>`);
    const actualKicks = kick.filter(raider => !matchValues.some(m => m.parts.includes(normalizeName(raider))));
    const actualFind = find.filter(raider => !matchValues.some(m => m.parts.includes(normalizeName(raider))));

    const embed = new Discord.EmbedBuilder()
        .setTitle(`Parse for ${raid.afkTitle()}`)
        .setColor('#00ff00')
        .setDescription(`There are ${actualCrashers.length} crashers, ${possibleAlts.length} potential alts` + (raid.isVcless() ? '' : `, and ${otherChannel.length} people in other channels`))
        .addFields({ name: 'Potential Alts', value: possibleAlts.join(', ') || 'None' });

    if (!raid.isVcless()) embed.addFields({ name: 'Other Channels', value: otherChannel.join('\n') || 'None' });

    embed.addFields(
        { name: 'Crashers', value: actualCrashers.join(', ') || 'None' },
        { name: 'Find Command', value: `\`\`\`;find ${actualFind.join(' ')}\`\`\`` },
        { name: 'Kick List', value: actualKicks.length ? `\`\`\`${actualKicks.join(' ')}\`\`\`` : 'None' }
    );

    if (!raid.isVcless()) {
        embed.addFields({
            name: 'Were in VC',
            value: `The following can use the \`reconnect\` button:\n${allowedCrashers.map(u => `<@${u}>`).join(' ')}`
        });
    }

    await message.channel.send({ embeds: [embed] });
}
/**
 * Determines the raid via interactive modal
 * @param {Object} message - The message object.
 * @param {Object} bot - The bot object.
 * @param {string} memberVoiceChannel - The member's voice channel ID.
 * @returns {Promise} A promise that resolves with the raid.
 */
async function getRaid(message, bot, memberVoiceChannel) {
    const raids = Object.values(bot.afkModules).filter(afk => afk.guild?.id == message.guild.id);
    if (raids.length == 0) {
        message.channel.send('Could not find an active run. Please try again.');
        return;
    }

    if (raids.length == 1) return raids[0];
    if (raids.filter(afk => afk.channel?.id == memberVoiceChannel).length == 1) {
        return raids.find(afk => afk.channel?.id == memberVoiceChannel);
    }

    const raidMenu = new Discord.StringSelectMenuBuilder()
        .setPlaceholder('Active Runs')
        .setMinValues(1)
        .setMaxValues(1);
    let text = 'Which active run would you like to parse for?';
    for (let index = 0; index < raids.length; index++) {
        text += `\n\`\`${index + 1}.\`\` ${raids[index].afkTitle()}`;
        raidMenu.addOptions({ label: `${index + 1}. ${raids[index].afkTitle()}`, value: String(index) });
    }
    const { value } = await message.selectPanel(text, null, raidMenu, 30000, false, true);
    if (value) return raids[value];
    await message.reply('You must specify the raid to parse, or join the raid\'s voice channel.');
}

/**
 * Filters raid IDs based on the interaction and bot.
 * @param {Discord.Interaction} interaction - The discord interaction object.
 * @param {Discord.Client} bot - The bot client instance.
 * @returns {Promise} A promise that resolves with the filtered raid IDs.
 */
async function filterRaidIds(interaction, bot) {
    const raidIdMappings = Object.keys(bot.afkModules).filter(raidId => bot.afkModules[raidId].guild.id == interaction.guild.id).map(raidId => ({
        name: bot.afkModules[raidId].afkTitle(),
        value: raidId })); // may need some null-proofing here, unsure if I should bother
    if (raidIdMappings.length == 0) { return; }
    const focusedValue = interaction.options.getFocused().trim().toLowerCase();
    const filteredValues = raidIdMappings.filter(raidIdMapping => raidIdMapping.name.toLowerCase().includes(focusedValue)).slice(0, 25);
    await interaction.respond(filteredValues);
}

// Normalization function as defined earlier
function normalizeName(name) {
    return name.toLowerCase().replace(/\s/g, '').replace(/i/g, 'l');
}

// Function to reassemble and check split names
/**
 *
 * @param {string[]} crasherNames
 * @param {[{id: string, nicknames: string[]}]} raidMembers
 * @returns {Map<string, { parts: string[], id: string }}
 */
function reassembleAndCheckNames(crasherNames, raidMembers) {
    const matchedNamesMap = new Map();

    const namesToCheck = crasherNames.slice(); // Copy array

    while (namesToCheck.length > 0 && raidMembers.length > 0) {
        const currentName = namesToCheck.shift();

        for (let i = 0; i <= namesToCheck.length; i++) {
            const matchedMember = raidMembers.find(({ nicknames }) => nicknames.includes(currentName + namesToCheck.slice(0, i).join('')));
            if (matchedMember) {
                const matchedComponents = namesToCheck.splice(0, i);
                matchedNamesMap.set(currentName + matchedComponents.join(''), { parts: [currentName, ...matchedComponents], id: matchedMember.id });
            }
        }
    }
    return matchedNamesMap;
}

/**
 *
 * @param {Discord.Message} message - The command message object
 * @param {String} playerImgURL - The URL of the /who image
 * @returns String[] - The names of the players in the /who image
 */
async function parseWhoImage(message, playerImgURL) {
    try {
        const [result] = await client.textDetection(playerImgURL);
        const imgPlayers = result.fullTextAnnotation.text.replace(/[\n,]/g, ' ').split(/ +/); // regex: split on spaces, remove newlines and commas
        imgPlayers.splice(0, 3); // remove the /who header 'Players online (x):'
        return imgPlayers;
    } catch (er) {
        await message.reply(er.message);
    }
}
