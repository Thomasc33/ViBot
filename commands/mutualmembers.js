const Discord = require('discord.js');

async function fetchMessages(targetChannel, messageIDs) {
    const fetchedMessagePromises = messageIDs.map(messageID => targetChannel.messages.fetch(messageID).catch(error =>
        (error.code === 10008) ? null : console.error(`Error fetching message ${messageID}:`, error)
    ));
    const fetchingResults = await Promise.all(fetchedMessagePromises);
    const fetchedMessages = fetchingResults.filter(message => message !== null);
    const notFoundMessageIDs = fetchingResults
        .filter(messageID => messageID === null)
        .map((result, index) => messageIDs[index]);
    return { fetchedMessages, notFoundMessageIDs };
}

// Splits up the value inputs to the embed to satisfy Discord.js constraints
function splitIntoChunks(list, maxLength) {
    const chunks = [];
    let currentChunk = [];
    for (const element of list) {
        // Agnosticism w.r.t. list of two-membered list (allRaidsDescriptions) or list of strings (allSuspiciousRaiders)
        const string = Array.isArray(element) ? element[1] : element;
        if (currentChunk.join('').length + string.length < maxLength) {
            currentChunk.push(element);
        } else {
            chunks.push([...currentChunk]);
            currentChunk = [element];
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    return chunks;
}

// Obtains key information, selected for by index if applicable, from a chunk
function destructureChunk(chunk, index) {
    const embedString = chunk.map(item => {
        const string = Array.isArray(item) ? item[index] : item;
        return `${string}`;
    }).join('\n');
    return embedString;
}

module.exports = {
    name: 'mutualmembers',
    description: 'Tells you which raiders appear at least twice in the raids corresponding to the input message IDs from #raidbot-info.',
    alias: ['mm'],
    guildspecific: true,
    role: 'security',
    args: '[<Message ID 1>, <Message ID 2>, (Message ID 3), ...]',
    requiredArgs: 2,
    async execute(message, args, bot) {
        const targetChannel = message.guild.channels.cache.get(bot.settings[message.guild.id].channels.runlogs);
        const { fetchedMessages, notFoundMessageIDs } = await fetchMessages(targetChannel, args);
        if (notFoundMessageIDs.length > 0) {
            return message.reply(`Could not find message(s) with message ID(s) \`${notFoundMessageIDs.join(', ')}\` in ${targetChannel}.`);
        }

        // Obtains all relevant information from the #raidbot-info embeds for each raid, storing them in lists
        const allRaidsRaiders = [];
        const allRaidsInfo = fetchedMessages.map(fetchedMessage => {
            const embed = fetchedMessage.embeds[0];
            const raidersField = embed.fields.find(item => item.name === 'Raiders');
            const raiders = raidersField.value.split(' ').map(raider => raider.split(',')[0]);
            const raidTimestamp = fetchedMessage.createdTimestamp;
            const raidRLandType = embed.author.name;
            const raidLink = `https://discord.com/channels/${message.guild.id}/${targetChannel.id}/${fetchedMessage.id}`;
            allRaidsRaiders.push(...raiders);
            return [raidTimestamp, raidRLandType, raidLink];
        });

        // Sort allRaidsInfo chronologically based on raidTime (a[0])
        allRaidsInfo.sort((a, b) => a[0] - b[0]);

        // Create strings containing the times and linked raid descriptions
        const allRaidsDescriptions = allRaidsInfo.map(raidInfo => {
            const raidTime = new Date(raidInfo[0]);
            const formattedRaidTime = `<t:${Math.floor(raidTime.getTime() / 1000)}:f>`;
            return [formattedRaidTime, `[${raidInfo[1]}](${raidInfo[2]})`];
        });

        // Finds all unique raiders and how many times they appear. >=2 means suspicious
        // const uniqueRaiders = allRaidsRaiders.filter((value, index, array) => array.indexOf(value) === index);
        const uniqueRaiders = [...new Set(allRaidsRaiders)];
        const countRaiders = uniqueRaiders.map(raider => [raider, allRaidsRaiders.filter(r => r === raider).length]);
        const allSuspiciousRaiders = countRaiders
            .filter(([raider, count]) => count >= 2)
            .sort(([raiderA, countA], [raiderB, countB]) => countB - countA)
            .map(([raider, count]) => `${raider} appears ${count} times.`);

        // Splits lists into chunks that are less than 1024 characters long
        const allRaidDescriptionsChunks = splitIntoChunks(allRaidsDescriptions, 1024);
        const allSuspiciousRaidersChunks = splitIntoChunks(allSuspiciousRaiders, 1024);

        // Constructs the "Raids" fields for the embed
        const firstRaidsChunk = allRaidDescriptionsChunks.shift();
        const raidsDescriptionFields = [
            { name: 'Raids', value: destructureChunk(firstRaidsChunk, 0), inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '\u200B', value: destructureChunk(firstRaidsChunk, 1), inline: true }
        ];
        raidsDescriptionFields.push(
            ...allRaidDescriptionsChunks.reduce((acc, raidDescriptionsChunk) =>
                acc.concat(
                    { name: '\u200B', value: destructureChunk(raidDescriptionsChunk, 0), inline: true },
                    { name: '\u200B', value: '\u200B', inline: true },
                    { name: '\u200B', value: destructureChunk(raidDescriptionsChunk, 1), inline: true }
                ),
            []
            )
        );

        // Constructs the "Suspicious Raiders" fields for the embed
        const firstSuspiciousRaidersChunk = allSuspiciousRaidersChunks.shift();
        const suspiciousRaidersFields = [
            { name: 'Suspicious Raiders', value: destructureChunk(firstSuspiciousRaidersChunk) },
        ];
        suspiciousRaidersFields.push(
            ...allSuspiciousRaidersChunks.reduce((acc, suspiciousRaidersChunk) =>
                acc.concat({ name: '\u200B', value: destructureChunk(suspiciousRaidersChunk) }),
            []
            )
        );

        // Combining the fields together
        const analysisEmbedFields = [
            { name: '\u00A0', value: '\u00A0' },
            ...raidsDescriptionFields,
            { name: '\u00A0', value: '\u00A0' },
            ...suspiciousRaidersFields
        ];

        // Makes and outputs an embed containing all relevant information.
        const analysisEmbed = new Discord.EmbedBuilder()
            .setColor('#63C5DA')
            .setAuthor({ name: `${message.member.displayName}`, iconURL: message.member.user.avatarURL() })
            .setTitle('Mutual Member Analysis')
            .setDescription(`**Runs Analysed**: ${args.length}`)
            .addFields(...analysisEmbedFields)
            .setTimestamp()
            .setFooter({ text: `${message.guild.name} • Mutual Member Analysis`, iconURL: message.guild.iconURL() });

        message.reply({ embeds: [analysisEmbed] });
    }
};
