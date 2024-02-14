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
    slashCommandName: 'parse',
    description: 'read the name',
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
    if (!playerImgURL) return await message.reply('You must provide a /who image to parse.');
    const raid = bot.afkModules[message.options.getString('raid')] || getRaid(message, bot, message.member.voice?.channelID);
    if (!raid) return; // error message already sent in getRaid()
    const imgPlayers = await parseWhoImage(message, playerImgURL);
    if (!imgPlayers) return; // error message already sent in parseWhoImage()

    const whoImgPlayers = imgPlayers.map(player => player.toLowerCase());
    const allowedRaiders = raid.members.map(member => member.id);

    const { alts, crashers, kick, find, otherChannel, allowedCrashers } = processPlayers(whoImgPlayers, message.guild, allowedRaiders, raid);

    // const embed = buildParseMembersEmbed(raid, actualCrashers, possibleAlts, otherChannel, actualKicks, actualFind, allowedCrashers);
    // await message.channel.send({ embeds: [embed] });
}

// async function parseReacts(message, bot) { }

// async function parseSimple(message, bot) { }

/**
 * 
 * @param {string[]} whoImgPlayers - names of players in the dungeon, from OCR
 * @param {Discord.Guild} guild - discord guild of the raid taking place
 * @param {string[]} allowedRaiders - discord members who are allowed to be in the raid
 * @param {AfkCheck} raid - raid object taken from bot.afkModules
 */
async function processPlayers(whoImgPlayers, guild, allowedRaiders, raid = null) {
    /** @type Discord.Member[] */
    const inRaidCrashers = [];
    /** @type Discord.Member[] */
    const otherCrashers = [];
    /** @type string[] */
    const unidentifiedCrashers = [];
    /** @type Discord.Member[] */
    const membersInDungeon = [];
    /**
     * @type {{id: string, nicknames: string[]}[]}
     * @description A map of raid member ids and their nicknames
     */
    const allowedRaidersNicknames = new Map();
    for (const member of allowedRaiders) {
        allowedRaidersNicknames.set(member.id, splitNickNames(member));
    }

    // TODO rework logic to allow checking if member who was in vc was deafened
    for (const player of whoImgPlayers) {
        let matchedRaider = allowedRaidersNicknames.find(({ nicknames }) => nicknames.includes(player));
        if (matchedRaider) continue;
        // takes 3 whoimgplayers to check for sequential combinations of names, checking for the longest combination first
        matchedRaider = searchCombinationNames(whoImgPlayers.slice(whoImgPlayers.indexOf(player), whoImgPlayers.indexOf(player) + 3), allowedRaidersNicknames);
        // TOOD add skipping forward if there was a matched name
        if (matchedRaider) continue;
        matchedRaider = guild.findMember(player);
        if (matchedRaider) continue;
        // TODO try matching combindation of names with entire guild
        if (matchecRaider) continue;
        unidentifiedCrashers.push(player);

        return { potentialAlts, inRaidCrashers, notInRaidCrashers, unidentifiedCrashers };
    }
}


/**
 * Determines the raid via interactive modal
 * @param {Discord.Message} message - The message object.
 * @param {Discord.Client} bot - The bot object.
 * @param {Bot.afkCheck} memberVoiceChannel - The member's voice channel ID.
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

/**
 * @description Searches for a sequential combination of playerArray strings in allowedRaidersNicknames, starting by combining all strings, then all but the last, then but the last two, etc.
 *  If a match is found, the Discord.Member object is returned. and the playerArray is spliced to remove the matched names.
 * @param {string[]} playerArray - names to combine and check
 * @param {{{id: Discord.Member, nicknames: string[]}[]}} allowedRaidersNicknames - map of raider id to their nicknames
 */
function searchCombinationNames(playerArray, allowedRaidersNicknames) { // TODO validate this function and add levenstein distance equivalent, need to actually modify the original playerArray if a match is found
    let combinedName = playerArray.join('');
    let matchedRaider = allowedRaidersNicknames.find(({ nicknames }) => nicknames.includes(combinedName));
    if (matchedRaider) return matchedRaider;
    for (let i = 0; i < playerArray.length; i++) {
        combinedName = playerArray.slice(0, i).join('');
        matchedRaider = allowedRaidersNicknames.find(({ nicknames }) => nicknames.includes(combinedName));
        if (matchedRaider) return matchedRaider;
    }
    return null;
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

function splitNickNames(member) {
    return member.map(member => member.nickname?.replace(/[^a-z|]/gi, '').toLowerCase().split('|'));
}
