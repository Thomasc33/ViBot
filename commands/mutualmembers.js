const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const cron = require('cron');

module.exports = {
    name: 'mutualmembers',
    description: 'Tells you which raiders appear at least twice in the raids corresponding to the input message IDs from #raidbot-info.',
    alias: ['mm'],
    guildspecific: true,
    role: 'security',
    args: '<Message ID 1> <Message ID 2> ... <Message ID N>',
    async execute(message, args, bot, db) {
        if (args.length < 2) {
            message.reply('Incorrect usage. Please provide at least two Message IDs.');
            return;
        }

        //Creates a list of links to all input raids.
        const targetChannelID = '701483952233250866';
        const guildID = message.guild.id;
        const channelID = targetChannelID;
        let allRaidsLinks = [];
        for (let i = 0; i < args.length; i++) {
            let linkString = `https://discord.com/channels/${guildID}/${channelID}/`;
            linkString += args[i];
            allRaidsLinks.push(linkString);
        }

        // Obtains all relevant information from the #raidbot-info embeds for each raid, storing them in lists
        const allRaidsRaiders = [];
        const allRaidsTimes = [];
        const allRaidsRLandType = [];
        for (let i = 0; i < args.length; i++) {
            const targetChannel = message.guild.channels.cache.get(targetChannelID);
            const fetchedMessage = await targetChannel.messages.fetch(args[i]);
            const afkEmbedFields = fetchedMessage.embeds[0].fields;
            const raidersField = afkEmbedFields.find(item => item.name === 'Raiders');
            const raiders = raidersField.value;
            const raidersList = raiders.split(" ");
            for (let j = 0; j < raidersList.length; j++) {
                if (raidersList[j].includes(",")) {
                    commaIndex = raidersList[j].indexOf(",");
                    allRaidsRaiders.push(raidersList[j].slice(0,commaIndex));
                }
                else {
                    allRaidsRaiders.push(raidersList[j]);
                }
            }
            const raidRLandType = fetchedMessage.embeds[0].author.name;
            const raidTime = fetchedMessage.createdTimestamp;
            allRaidsRLandType.push(raidRLandType);
            allRaidsTimes.push(`<t:${(parseInt(raidTime)/1000).toFixed(0)}:f>`);
        }

        // Creates strings containing the times and linked raid descriptions (RL and Type).
        let allRaidsDescriptionsEmbed = '';
        let allRaidsTimesEmbed = '';
        for (i = 0; i < allRaidsRLandType.length; i++) {
            allRaidsDescriptionsEmbed += `[${allRaidsRLandType[i]}](${allRaidsLinks[i]})\n`;
            allRaidsTimesEmbed += allRaidsTimes[i] + '\n'
        }

        //Finds all unique raiders and how many times they appear.
        function onlyUnique(value, index, array) {
            return array.indexOf(value) === index;
        }
        const uniqueRaiders = allRaidsRaiders.filter(onlyUnique);
        const countRaiders = [];
        for (let i = 0; i < uniqueRaiders.length; i++) {
            counter = 0;
            for (let j = 0; j < allRaidsRaiders.length; j++) {
                if (uniqueRaiders[i] === allRaidsRaiders[j]) {
                    counter += 1;
                }
            }
            countRaiders.push(counter);
        }

        //Creates a string that contains raiders who have appeared at least twice: "suspicious" members.
        let allSuspiciousMembersEmbed = '';
        for (let i = 0; i < uniqueRaiders.length; i++) {
            if (countRaiders[i] >= 2) {
                allSuspiciousMembersEmbed += `${uniqueRaiders[i]} appears ${countRaiders[i]} times.\n`;
            }
        }

        //Makes and outputs an embed containing all relevant information.
        const exampleEmbed = new Discord.EmbedBuilder()
            .setColor('#FFC0CB')
            .setAuthor({ name: `${message.member.displayName}`, iconURL: message.member.user.avatarURL() })
            .setTitle(`Mutual Member Analysis`)
            .setDescription(`**Runs Analysed**: ${args.length}`)
            .addFields(
                { name: '\u00A0', value: '\u00A0' },
                { name: 'Raids', value: allRaidsTimesEmbed, inline: true },
                { name: '\u200B', value: allRaidsDescriptionsEmbed, inline: true},
                { name: '\u00A0', value: '\u00A0' },
                { name: 'Common Raiders', value: allSuspiciousMembersEmbed},
            )
            .setTimestamp()
            .setFooter({ text: `${message.guild.name} • Mutual Member Analysis`, iconURL: message.guild.iconURL() });

        message.reply({embeds: [exampleEmbed]})
    }
}