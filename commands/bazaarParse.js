const Discord = require('discord.js');
const ErrorLogger = require('../logError')
const vision = require('@google-cloud/vision')
const client = new vision.ImageAnnotatorClient();

module.exports = {
    name: 'bazaarparse',
    description: 'Parses people in bazaar to find people entering location early',
    role: 'Almost Raid Leader',
    alias: 'bp, bpm',
    args: '<embed message id> <image>',
    async execute(message, args, bot) {
        message.channel.send('Feature coming soon:tm:')
        return;
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again in dylanbot-commands or veteran-bot-commands");
            return;
        }
        const messageID = args.shift();
        var bazaarMembers
        console.log(messageID)
        var embedMessage = await message.channel.messages.cache.find(m => m.id == messageID)
        console.log(embedMessage)
        return;
        let bazaarEmbed = embedMessage.embeds[0]
        bazaarEmbed.fields.forEach(field => {
            console.log(field.value)
        })
        var image;
        if (message.attachments.size == 0) {
            image = args[0];
        } else {
            image = await message.attachments.first().proxyURL;
        }
        if (image == null) return;
        return;
        message.channel.send(`Starting the parse.. This will take around a minute`);
        const [result] = await client.textDetection(image)
        var players = result.fullTextAnnotation.text.replace(/[\n,]/g, " ").split(/ +/)
        players.shift()
        players.shift()
        players.shift()
        console.log(players)

        let embed = new Discord.MessageEmbed()
            .setTitle('Bazaar Parse')
            .setColor('#00ff00')
        message.channel.send(embed)
    }
}