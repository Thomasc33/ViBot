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

        // Obtains all relevant information from the #raidbot-info embeds for each raid, storing them in lists
        const targetChannel = message.guild.channels.cache.find(channel => channel.name === 'raidbot-info');
        const targetChannelID = targetChannel.id;
        const guildID = message.guild.id;
        const allRaidsRaiders = [];
        const allRaidsInfo = [];
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
            const raidLink = `https://discord.com/channels/${guildID}/${targetChannelID}/` + args[i];
            allRaidsInfo.push([raidTime, raidRLandType, raidLink]);
        }

        // Creates strings containing the times and linked raid descriptions (RL and Type), ordered chronologically.
        allRaidsInfo.sort((a,b) => a[0]-b[0]);
        let allRaidsDescriptionsEmbed = '';
        let allRaidsTimesEmbed = '';
        for (i = 0 ; i < allRaidsInfo.length; i++) {
            allRaidsTimesEmbed += `<t:${(parseInt(allRaidsInfo[i][0])/1000).toFixed(0)}:f>\n`
            allRaidsDescriptionsEmbed += `[${allRaidsInfo[i][1]}](${allRaidsInfo[i][2]})\n`
        }

        //Finds all unique raiders and how many times they appear. Note that uniqueRaiders and countRaiders have the same length.
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

        //Creates a string that contains raiders who have appeared at least twice: "suspicious" members. Ordered by descending observed frequency.
        const allSuspiciousMembers =[];
        for (let i = 0; i < uniqueRaiders.length; i++) {
            if (countRaiders[i] >= 2) {
                allSuspiciousMembers.push([uniqueRaiders[i], countRaiders[i]]);
            }
        }
        allSuspiciousMembers.sort((a,b) => b[1]-a[1]);
        let allSuspiciousMembersEmbed = '';
        for (let i = 0; i < allSuspiciousMembers.length; i++) {
            allSuspiciousMembersEmbed += `${allSuspiciousMembers[i][0]} appears ${allSuspiciousMembers[i][1]} times.\n`
        }

        //Makes and outputs an embed containing all relevant information.
        const exampleEmbed = new Discord.EmbedBuilder()
            .setColor('#63C5DA')
            .setAuthor({ name: `${message.member.displayName}`, iconURL: message.member.user.avatarURL() })
            .setTitle(`Mutual Member Analysis`)
            .setDescription(`**Runs Analysed**: ${args.length}`)
            .addFields(
                { name: '\u00A0', value: '\u00A0' },
                { name: 'Raids', value: allRaidsTimesEmbed, inline: true },
                { name: '\u200B', value: allRaidsDescriptionsEmbed, inline: true},
                { name: '\u00A0', value: '\u00A0' },
                { name: 'Suspicious Raiders', value: allSuspiciousMembersEmbed},
            )
            .setTimestamp()
            .setFooter({ text: `${message.guild.name} • Mutual Member Analysis`, iconURL: message.guild.iconURL() });

        message.reply({embeds: [exampleEmbed]})
    }
}