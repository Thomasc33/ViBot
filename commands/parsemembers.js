/*
COMMANDS TO RUN:
gcloud iam service-accounts create vibotparse
gcloud projects add-iam-policy-binding vibot-275815 --member "serviceAccount:vibotparse@vibot-275815.iam.gserviceaccount.com" --role "roles/owner"
gcloud iam service-accounts keys create viBot-7ff3dbd920ee.json --iam-account vibotparse@vibot-275815.iam.gserviceaccount.com

set GOOGLE_APPLICATION_CREDENTIALS=[PATH]
*/
const Discord = require('discord.js')

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
        if (message.channel.name == 'veteran-bot-commands') {
            isVet = true;
        } else {
            isVet = false;
        }
        //if (message.attachments.size !== 1) {
        //      message.channel.send("Issue with attachment, make sure the image and command are on same message");
        //return;
        //}
        const channelN = args.shift();
        var image;
        if (message.attachments.size == 0) {
            image = args[0];
        } else {
            image = await message.attachments.first().proxyURL;
        }
        message.channel.send(`test ${image}`);

        const [result] = await client.labelDetection(image);

        const [players] = result[0].fullTextAnnotation.text.replace(/\n/g, " ").split(' ').slice(3);
        var [voiceUsers] = {}
        var [alts] = {}
        var [crashers] = {}
        var [movedIn] = {}
        if (this.isVet) var channel = message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${channelN}` || c.name == `Veteran Raiding ${this.channelN} <--Join Now!`);
        else var channel = message.guild.channels.cache.find(c => c.name == `raiding-${channelN}` || c.name == `raiding-${channelN} <--Join Now!`);

        for (let i in players) {
            let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(i.toLowerCase()));
            if (member == null) {
                crashers.push(i);
            } else if (!voiceUsers.inclues(member)) {
                if (member.voice.channel == 'lounge' || member.voice.channel == 'afk') {
                    member.edit({ channel: channel });
                    movedIn.push(`<@!#${member.id}>`);
                }
                crashers.push(`<@!#${member.id}>`);
            }
        }
        for (let i in voiceUsers) {
            let nick = voiceUsers.nickname
            if (!players.includes(nick)) {
                alts.push(`<@!#${i.id}>`);
            }
        }
        var crashersS = '', altsS = '', movedS = ''
        for (let i in crashers) { crashersS = crashersS.concat(i) }
        for (let i in alts) { altsS = altsS.concat(i) }
        for (let i in movedIn) { movedS = movedS.concat(i) }
        let embed = new Discord.MessageEmbed()
            .setTitle(`Parse for ${channel.name}`)
            .setColor('#00ff00')
            .setDescription(`There are ${crashers.length} crashers, ${alts.length} alts, and ${movedIn.length} people that got moved in`)
            .addFields(
                { name: 'Alts', value: altsS },
                { name: 'Moved In', value: movedS },
                { name: 'Crashers', value: crashersS }
            )
        message.channel.send(embed);
    }
}