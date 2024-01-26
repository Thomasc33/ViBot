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
    for (const string of list) {
        if (currentChunk.join('').length + string.length + currentChunk.length < maxLength) { // Total chars + "\n" for each entry
            currentChunk.push(string);
        } else {
            chunks.push([...currentChunk]);
            currentChunk = [string];
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    return chunks;
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
        const allRaidsInfo = fetchedMessages
            .map(fetchedMessage => {
                const embed = fetchedMessage.embeds[0];
                const raidersField = embed.fields.find(item => item.name === 'Raiders');
                const raiders = raidersField.value.split(' ').map(raider => raider.split(',')[0]);
                allRaidsRaiders.push(...raiders);
                const raidRLandType = embed.author.name;
                const raidLink = `https://discord.com/channels/${message.guild.id}/${targetChannel.id}/${fetchedMessage.id}`;
                const raidTime = new Date(fetchedMessage.createdTimestamp);
                const formattedRaidTime = `<t:${Math.floor(raidTime.getTime() / 1000)}:f>`;
                return [formattedRaidTime, `[${raidRLandType}](${raidLink})`];
            })
            .sort((a, b) => {
                const numericPartA = parseInt(a[0].substring(a[0].indexOf('t:') + 2, a[0].indexOf(':f')));
                const numericPartB = parseInt(b[0].substring(b[0].indexOf('t:') + 2, b[0].indexOf(':f')));
                return numericPartA - numericPartB;
            });
        const allRaidsTimes = allRaidsInfo.map(raidInfo => raidInfo[0]);
        const allRaidsDescriptions = allRaidsInfo.map(raidInfo => raidInfo[1]);

        // Finds all unique raiders and how many times they appear. >=2 means suspicious
        const uniqueRaiders = [...new Set(allRaidsRaiders)];
        const countRaiders = uniqueRaiders.map(raider => [raider, allRaidsRaiders.filter(r => r === raider).length]);
        const allSuspiciousRaiders = countRaiders
            .filter(([raider, count]) => count >= 2)
            .sort(([raiderA, countA], [raiderB, countB]) => countB - countA)
            .map(([raider, count]) => `${raider} appears ${count} times.`);

        // Splits lists into chunks that are less than 1024 characters long
        const allRaidsDescriptionsChunks = splitIntoChunks(allRaidsDescriptions, 1024);
        const allSuspiciousRaidersChunks = splitIntoChunks(allSuspiciousRaiders, 1024);

        // Dividing allRaidsTime into the same size chunks as allRaidDescriptionsChunks. Assumes character count of times always shorter than character count of description.
        const allRaidsTimesChunks = allRaidsDescriptionsChunks.map(chunk =>
            allRaidsTimes.splice(0, chunk.length)
        );

        // Constructs the "Raids" fields for the embed
        let raidsDescriptionFields = [];
        for (let i = 0; i < allRaidsDescriptionsChunks.length; i++) {
            raidsDescriptionFields = raidsDescriptionFields.concat(
                { name: '\u200B', value: allRaidsTimesChunks[i].join('\n'), inline: true },
                { name: '\u200B', value: '\u200B', inline: true },
                { name: '\u200B', value: allRaidsDescriptionsChunks[i].join('\n'), inline: true }
            );
        }
        raidsDescriptionFields[0].name = 'Raids';

        // Constructs the "Suspicious Raiders" fields for the embed
        const suspiciousRaidersFields = allSuspiciousRaidersChunks.map(chunk => ({ name: '\u200B', value: chunk.join('\n') }));
        suspiciousRaidersFields[0].name = 'Suspicious Raiders';

        // Combining the fields together
        const analysisEmbedFields = [
            { name: '\u00A0', value: '\u00A0' },
            ...raidsDescriptionFields,
            { name: '\u00A0', value: '\u00A0' },
            ...suspiciousRaidersFields
        ];
        if (analysisEmbedFields.length > 25) {
            return message.reply('The analysis result has too many fields to display. Remove a few input IDs and try again.');
        }
        // Makes and outputs an embed containing all relevant information.
        try {
            const analysisEmbed = new Discord.EmbedBuilder()
                .setColor('#63C5DA')
                .setAuthor({ name: `${message.member.displayName}`, iconURL: message.member.user.avatarURL() })
                .setTitle('Mutual Member Analysis')
                .setDescription(`**Runs Analysed**: ${args.length}`)
                .addFields(...analysisEmbedFields)
                .setTimestamp()
                .setFooter({ text: `${message.guild.name} • Mutual Member Analysis`, iconURL: message.guild.iconURL() });

            const analysisEmbedJSON = JSON.stringify(analysisEmbed);
            // Check the total character length of the JSON string before sending
            if (analysisEmbedJSON.length > 6000) {
                return message.reply('The analysis result is too long to display. Remove a few input IDs and try again.');
            }
            message.reply({ embeds: [analysisEmbed] });
        } catch (error) {
            console.error('Error creating embed:', error);
            message.reply('An unknown error occurred while creating the analysis embed.');
        }
    }
};
