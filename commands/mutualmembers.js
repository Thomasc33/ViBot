const Discord = require('discord.js');

async function fetchMessages(targetChannel, messageIDs) {
    const fetchedMessagePromises = messageIDs.map(messageID => targetChannel.messages.fetch(messageID).catch(error =>
        (error.code === 10008) ? null : console.error(`Error fetching message ${messageID}:`, error)
    ));
    const fetchingResults = await Promise.all(fetchedMessagePromises);
    const fetchedMessages = fetchingResults.filter(message => message !== null);
    const notFoundMessageIDs = fetchingResults
        .map((result, index) => (result === null ? messageIDs[index] : null))
        .filter(messageID => messageID !== null);
    return { fetchedMessages, notFoundMessageIDs };
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
        const guildID = message.guild.id;
        const allRaidsRaiders = [];
        const allRaidsInfo = fetchedMessages.map(fetchedMessage => {
            const embed = fetchedMessage.embeds[0];
            const raidersField = embed.fields.find(item => item.name === 'Raiders');
            const raiders = raidersField.value.split(' ').map(raider => raider.split(',')[0]);
            const raidRLandType = embed.author.name;
            const raidTime = fetchedMessage.createdTimestamp;
            const raidLink = `https://discord.com/channels/${guildID}/${targetChannel.id}/${fetchedMessage.id}`;
            allRaidsRaiders.push(...raiders);
            return [raidTime, raidRLandType, raidLink];
        });

        // Sort allRaidsInfo chronologically based on raidTime (a[0])
        allRaidsInfo.sort((a, b) => a[0] - b[0]);

        // Create strings containing the times and linked raid descriptions
        const allRaidsTimesEmbed = allRaidsInfo.map(raidInfo => {
            const raidTime = new Date(raidInfo[0]);
            return `<t:${Math.floor(raidTime.getTime() / 1000)}:f>`;
        }).join('\n');
        const allRaidsDescriptionsEmbed = allRaidsInfo.map(raidInfo => `[${raidInfo[1]}](${raidInfo[2]})`).join('\n');

        // Finds all unique raiders and how many times they appear. >=2 means suspicious.
        const uniqueRaiders = allRaidsRaiders.filter((value, index, array) => array.indexOf(value) === index);
        const countRaiders = uniqueRaiders.map(raider => [raider, allRaidsRaiders.filter(r => r === raider).length]);
        const suspiciousMembers = countRaiders
            .filter(([raider, count]) => count >= 2)
            .sort(([raiderA, countA], [raiderB, countB]) => countB - countA)
            .map(([raider, count]) => `${raider} appears ${count} times.`);

        const allSuspiciousMembersEmbed = suspiciousMembers.join('\n');

        // Creates variable analysisEmbedFields containing the fields for analysisEmbed.
        const analysisEmbedFields = [
            { name: '\u00A0', value: '\u00A0' },
            { name: 'Raids', value: allRaidsTimesEmbed, inline: true },
            { name: '\u200B', value: allRaidsDescriptionsEmbed, inline: true },
            { name: '\u00A0', value: '\u00A0' },
            { name: 'Suspicious Raiders', value: allSuspiciousMembersEmbed }
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
