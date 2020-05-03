/*
COMMANDS TO RUN:
gcloud iam service-accounts create ViBot
gcloud projects add-iam-policy-binding vibot-275815 --member "serviceAccount:ViBot@vibot-275815.iam.gserviceaccount.com" --role "roles/owner"
cloud iam service-accounts keys create ViBot-7ff3dbd920ee.json --iam-account ViBot@vibot-275815.iam.gserviceaccount.com
*/


const vision = require('@google-cloud/vision')
//keyFilename: 'C:/Users/Carrt/OneDrive/Desktop/ViBot/ViBot-7ff3dbd920ee.json'
const client = new vision.ImageAnnotatorClient();

module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    async execute(message, args, bot) {
        //message.channel.send("Feature coming soon™");
        //return;
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again in dylanbot-commands or veteran-bot-commands");
            return;
        }
        //if (message.attachments.size !== 1) {
        //      message.channel.send("Issue with attachment, make sure the image and command are on same message");
        //return;
        //}
        const channel = args.shift();
        var image;
        if (message.attachments.size == 0) {
            image = args[0];
        } else {
            var image = await message.attachments.first().proxyURL;
        }
        message.channel.send(`test ${image}`);
    }
}