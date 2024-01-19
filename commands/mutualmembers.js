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
        // Obtaining all relevant information from the #raidbot-info embed.
        const targetChannelID = '701483952233250866';
        const allRaidsRaiders = [];
        let allRaidsDescriptions = '';
        for (let i = 0; i < args.length; i++) {
            const targetChannel = message.guild.channels.cache.get(targetChannelID); // Makes a targetChannel object using the id
            const fetchedMessage = await targetChannel.messages.fetch(args[i]); // Assigns fetchedMessage to the message corresponding to message id given in the first argument
            const afkEmbedFields = fetchedMessage.embeds[0].fields; // fetchedMessage.embeds[0] takes first element from list of embeds, then we select fields.
            const raidersField = afkEmbedFields.find(item => item.name === 'Raiders'); // Selects the object in the list with key "Raiders".
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
            allRaidsDescriptions += `${raidRLandType} at <t:${(parseInt(raidTime)/1000).toFixed(0)}:f>\n`;
        }
        //Finding all unique raiders and how many times they appear.
        function onlyUnique(value, index, array) {
            return array.indexOf(value) === index;
        }
        const uniqueRaiders = allRaidsRaiders.filter(onlyUnique); // List of all unique raiders

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
        let returnString = '';
        for (let i = 0; i < uniqueRaiders.length; i++) {
            returnString += `${uniqueRaiders[i]} appears ${countRaiders[i]} times.\n`;
        }


        const guildID = message.guild.id;
        const channelID = targetChannelID;
        let allRaidLinks = '';
        for (let i = 0; i < args.length; i++) {
            let linkString = `https://discord.com/channels/${guildID}/${channelID}/`;
            linkString += args[i] + ' ';
            allRaidLinks += linkString;
        }

        const exampleEmbed = new Discord.EmbedBuilder()
            .setColor('#FFC0CB')
            .setAuthor({ name: `${message.member.displayName}`, iconURL: message.member.user.avatarURL() })
            .setTitle(`Mutual Member Analysis`)
            .setDescription(`${args.length} runs included, X matches`)
            .addFields(
                { name: 'Raids', value: allRaidsDescriptions},
                { name: 'Links to Raids', value: allRaidLinks },
                { name: '\u00A0', value: '\u00A0' },
                { name: 'Suspicious members', value: 'Some value here'},
            )
            .setTimestamp()
            .setFooter({ text: `${message.guild.name} • Mutual Member Analysis`, iconURL: message.guild.iconURL() });

        message.reply({embeds: [exampleEmbed]})
    }
}


//To do: Only print the name if it appears at least twice, 
//args is a list. args[0] etc. come from args
