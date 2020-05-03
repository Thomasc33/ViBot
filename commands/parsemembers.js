const vision = require('@google-cloud/vision')
//keyFilename: 'C:/Users/Carrt/OneDrive/Desktop/ViBot/ViBot-7ff3dbd920ee.json'
const client = new vision.ImageAnnotatorClient();

module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    async execute(message, args, bot) {
        message.channel.send("Feature coming soon™");
        return;
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (message.attachments.size !== 1) {
            message.channel.send("Issue with attachment, make sure the image and command are on same message");
        }
        var image = await message.attachments.first().proxyURL;
        message.channel.send(' ', image);
    }
}