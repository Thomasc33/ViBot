
//keyFilename: './ViBot-7ff3dbd920ee.json',
//projectId: 'vibot-275815'


module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    execute(message, args, bot) {
        message.channel.send("Feature coming soon™");
        return;
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again in dylanbot-commands or veteran-bot-commands");
            return;
        }
        console.log(message.attachments.array.length);
        if (message.attachments.array.length !== 1) {
            message.channel.send("Issue with attachment, make sure the image and command are on same message");
        }
        var image = message.attachments.array[0];
        message.channel.send(image);
    }
}