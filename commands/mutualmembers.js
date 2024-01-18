const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');
const cron = require('cron');

module.exports = {
    name: 'mutualmembers',
    description: 'Holds testing code. Do not issue command if you do not know what is in it',
    guildspecific: true,
    role: 'developer',
    args: '<Run id 1> <Run id 2> ... <Run id N>',
    async execute(message, args, bot, db) {
        const targetChannelId = '701483952233250866';
        allRaids = [];
        for (let i = 0; i < args.length; i++) {
            const targetChannel = message.guild.channels.cache.get(targetChannelId); // Makes a targetChannel object using the id
            const fetchedMessage = await targetChannel.messages.fetch(args[i]); // Assigns fetchedMessage to the message corresponding to message id given in the first argument
            const afkEmbedFields = fetchedMessage.embeds[0].fields; // fetchedMessage.embeds[0] takes first element from list of embeds, then we select fields.
            const raidersField = afkEmbedFields.find(item => item.name === "Raiders"); // Selects the object in the list with key "Raiders".
            const raiders = raidersField.value;
            const raidersList = raiders.split(" ");
            for (let j = 0; j < raidersList.length; j++) {
                if (raidersList[j].includes(",")) {
                    commaIndex = raidersList[j].indexOf(",");
                    allRaids.push(raidersList[j].slice(0,commaIndex));
                }
                else {
                    allRaids.push(raidersList[j]);
                }
            }
        }

        function onlyUnique(value, index, array) {
            return array.indexOf(value) === index;
        }
        
        const uniqueRaiders = allRaids.filter(onlyUnique); // List of all unique raiders
        
        const countRaiders = [];
        for (let i = 0; i < uniqueRaiders.length; i++) {
            counter = 0;
            for (let j = 0; j < allRaids.length; j++) {
                if (uniqueRaiders[i] === allRaids[j]) {
                    counter += 1;
                }
            }
            countRaiders.push(counter);
        }

        let returnString = "";
        for (let i = 0; i < uniqueRaiders.length; i++) {
            returnString += `${uniqueRaiders[i]} appears ${countRaiders[i]} times.\n`;
        }

        // await message.reply(returnString);
        console.log(returnString);
    }
}


//To do: Only print the name if it appears at least twice, 
//args is a list. args[0] etc. come from args
