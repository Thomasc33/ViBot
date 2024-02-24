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
const { TemplateButtonType } = require('./afkTemplate.js');

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
            value: `
            The slash version of this command is highly recommended!

            \`/parse members <raid> </who image>\`
            - This is the standard parse
            - **Note:** you must include the RSA id of the raid to parse if using the legacy command

            \`/parse reacts <raid>\`
            - This displays raid reactions in a parse-friendly formatting output

            \`/parse basic (vc) </who image>\`
            - This parse only checks vc against /who players
            - **Note:** This isn't the standard parse, use \`/parse members\` for that
        ` };
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
                await parseReacts(message, bot);
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
    const allowedMembers = raid?.members.map(member => message.guild.findMember(member));

    const { potentialAlts, otherChannels, inRaidCrashers, otherCrashers, unidentifiedCrashers, deafenedMembers } = processPlayers(whoImgPlayers, message.guild, allowedMembers, raid);

    const embed = buildParseMembersEmbed(raid, potentialAlts, otherChannels, inRaidCrashers, otherCrashers, unidentifiedCrashers, deafenedMembers);
    await message.channel.send({ embeds: [embed] });
}

async function parseReacts(message, bot) {
    const raid = bot.afkModules[message.options.getString('raid')] || getRaid(message, bot, message.member.voice?.channelID);
    if (!raid) return; // error message already sent in getRaid()
    const reacts = raid.buttons.filter(button =>
        [
            TemplateButtonType.NORMAL,
            TemplateButtonType.LOG,
            TemplateButtonType.LOG_SINGLE
        ].includes(button.type) && button.name.toLowerCase() != 'join')
        .map(button => {
            const { name, members: memberIDS, emote } = button;
            console.log(memberIDS);
            const members = memberIDS.map(member => message.guild.findMember(member));
            return { name, members, emote };
        });
    const fields = reacts.map(react => {
        const name = `${react.emote.text} ${react.name}: \`${react.members.length}\``;
        const value = react.members.map((member, idx) => `\`${idx + 1}.\` <@${member.id}> \n \`${member.nickname}\``).join('\n') || '`None`';
        return { name, value, inline: true };
    });
    const embed = new Discord.EmbedBuilder()
        .setTitle(`React parse for ${raid.afkTitle()}`)
        .setColor('#00ff00')
        .setDescription('Enjoy a sneak peek')
        .addFields(fields);
    await message.reply({ embeds: [embed] });
}

// async function parseSimple(message, bot) { }

/**
 *
 * @param {string[]} whoImgPlayers - names of players in the dungeon, from OCR
 * @param {Discord.Guild} guild - discord guild of the raid taking place
 * @param {string[]} allowedRaiders - discord members who are allowed to be in the raid
 * @param {AfkCheck} raid - raid object taken from bot.afkModules
 */
async function processPlayers(whoImgPlayers, guild, allowedMembers, raid) {
    const matchedRaiders = [];
    const comboMatchedRaiders = []; // just contains the id's of the matched raiders and their matched names
    const potentialAlts = [];
    const deafenedMembers = [];
    const otherChannels = []; // allowedRaiders in other channels, drag command
    const inRaidCrashers = [];
    const otherCrashers = [];
    const unidentifiedCrashers = [];
    const idMatchMap = new Map(); // for mapping id's to the matched /who name

    const nicknameToIdMap = new Map();
    for (const member of allowedMembers) {
        const nicknames = splitNickNames(member);
        nicknames.forEach(nickname => {
            nicknameToIdMap.set(nickname, member);
        });
    }

    for (let i = 0; i < whoImgPlayers.length; i++) {
        const playerName = whoImgPlayers[i];
        { // check for names in the allowedRaidersNicknames
            const member = nicknameToIdMap.find(playerName);
            if (!member) {
                const { matchedRaider, nameArray } = searchCombinationNames(whoImgPlayers.slice(i, i + 3), nicknameToIdMap);
                if (matchedRaider) {
                    matchedRaiders.push(matchedRaider);
                    idMatchMap.set(matchedRaider.id, playerName);
                    comboMatchedRaiders.push({ id: matchedRaider.id, whoNames: nameArray });
                    i += nameArray.length - 1; // skip forward by the length of combination
                }
            }
            if (member) {
                matchedRaiders.push(member);
                idMatchMap.set(member.id, playerName);
                if (!raid.vcLess) { // check for other channels
                    if (member.voice?.channelID != raid.channel.id) otherChannels.push(member);
                    else inRaidCrashers.push(member);
                }
                continue;
            }
        }
        { // check for names in the guild
            const inGuild = guild.findMember(playerName);
            if (!inGuild) {
                const { matchedMember, nameArray } = searchCombinationNamesGuild(whoImgPlayers.slice(i, i + 3), guild);
                if (matchedMember) {
                    otherCrashers.push(matchedMember);
                    idMatchMap.set(matchedMember.id, playerName);
                    comboMatchedRaiders.push({ id: matchedMember.id, whoNames: nameArray });
                    i += nameArray.length - 1; // skip forward by the length of combination
                }
            }
            if (inGuild) {
                otherCrashers.push(inGuild);
                idMatchMap.set(inGuild.id, playerName);
                continue;
            }
        }
        unidentifiedCrashers.push(playerName);
    }

    // check for deafened members
    if (!raid.vcLess) {
        for (const member of matchedRaiders) {
            if (member.voice?.deaf) deafenedMembers.push(member);
        }
    }

    // check for extra allowedRaiders
    for (const member of allowedMembers) {
        if (!matchedRaiders.includes(member)) {
            potentialAlts.push(member);
        }
    }
    return { idMatchMap, potentialAlts, otherChannels, inRaidCrashers, otherCrashers, deafenedMembers, unidentifiedCrashers };
}

function buildParseMembersEmbed(raid, idMatchMap, potentialAlts, otherChannels, inRaidCrashers, otherCrashers, unidentifiedCrashers, deafenedMembers) {
    const potentialAltsString = potentialAlts.length > 0 ? potentialAlts.map(member => `<@${member.id}>`).join(', ') : 'None';
    const deafenedMembersString = deafenedMembers.length > 0 ? deafenedMembers.map(member => `<@${member.id}>\`${idMatchMap.find(member.id)}\``).join(' ') : 'None';
    const inRaidCrashersString = inRaidCrashers.length > 0 ? inRaidCrashers.map(member => `<@${member.id}>`).join(', ') : 'None';
    const otherCrashersString = otherCrashers.length > 0 ? otherCrashers.map(member => `<@${member.id}>`).join(', ') : 'None';
    const unidentifiedCrashersString = unidentifiedCrashers.length > 0 ? unidentifiedCrashers.join(', ') : 'None';
    const kickList = '```';
    if (inRaidCrashers.length > 0) kickList.concat('In Raid: ' + inRaidCrashers.map(member => idMatchMap.find(member.id)).join(' ') + '\n');
    if (otherCrashers.length > 0) kickList.concat('Other: ' + inRaidCrashers.map(member => idMatchMap.find(member.id)).join(' ') + '\n');
    if (unidentifiedCrashers.length > 0) kickList.concat('Unidentified: ' + unidentifiedCrashers.join(' ') + '\n');
    kickList.concat('```');
    const otherChannelsString = otherChannels.length > 0 ? otherChannels.map(member => `<@${member.id}>\`${idMatchMap.find(member.id)}\``).join(', ') : 'None';

    const embed = new Discord.EmbedBuilder()
        .setTitle(`Parse for ${raid.afkTitle()}`)
        .setColor('#00ff00');
    embed.addField('Potential Alts', potentialAltsString);
    embed.addField('Deafened Members', deafenedMembersString);
    embed.addField('In Raid Crashers', inRaidCrashersString);
    embed.addField('Other Crashers', otherCrashersString);
    embed.addField('Unidentified Crashers', unidentifiedCrashersString);
    embed.addField('Kick List', kickList);
    embed.addField('Raid members in other channels', otherChannelsString);
    return embed;
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
 * @returns {Discord.Member, number} - The matched raider and the number of names combined to match
 */
function searchCombinationNames(playerArray, nicknameToIdMap) { // TODO validate this function and add levenstein distance equivalent
    for (let i = playerArray.length; i > 1; i--) { // don't bother ot search for single names, that was already checked before
        const combinedName = playerArray.slice(0, i).join('');
        const matchedRaider = nicknameToIdMap.find(combinedName);
        if (matchedRaider) return { matchedRaider, nameArry: playerArray.slice(0, i) };
    }
    return { matchedRaider: null, num: 0 };
}

function searchCombinationNamesGuild(playerArray, guild) {
    for (let i = playerArray.length; i > 1; i--) { // don't bother ot search for single names, that was already checked before
        const combinedName = playerArray.slice(0, i).join('');
        const matchedRaider = guild.findMember(combinedName);
        if (matchedRaider) return { matchedRaider, nameArray: playerArray.slice(0, i) };
    }
    return { matchedRaider: null, num: 0 };
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
    return member.nickname?.replace(/[^a-z|]/gi, '').toLowerCase().split('|');
}
