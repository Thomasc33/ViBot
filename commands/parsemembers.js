const Discord = require('discord.js');
const { createWorker } = require('tesseract.js');
const worker = createWorker();

module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    async execute(message, args, bot) {
        if (!(message.channel.name === 'dylanbot-commands' || message.channel.name === 'veteran-bot-commands')) {
            message.channel.send("Try again in dylanbot-commands or veteran-bot-commands");
            return;
        }
        if (message.channel.name == 'veteran-bot-commands') {
            isVet = true;
        } else {
            isVet = false;
        }
        const channelN = args.shift();
        var image;
        if (message.attachments.size == 0) {
            image = args[0];
        } else {
            image = await message.attachments.first().proxyURL;
        }
        message.channel.send(`Starting the parse.. This will take around a minute`);

        const result = await parseImage(image).catch(er => { console.log(er); message.channel.send('Error parsing. Please try again'); return; });
        try {
            const players = result.substring(20, result.length - 2).split(/,\s*\s/);
            players[0] = players[0].replace(/\s/g, '');
            var voiceUsers = []
            var alts = []
            var crashers = []
            var movedIn = []
            if (message.channel.name === 'veteran-bot-commands') var channel = message.guild.channels.cache.find(c => c.name == `Veteran Raiding ${channelN}` || c.name == `Veteran Raiding ${this.channelN} <--Join Now!`);
            else var channel = message.guild.channels.cache.find(c => c.name == `raiding-${channelN}` || c.name == `raiding-${channelN} <--Join Now!`);
            voiceUsers = channel.members.array();
            if (voiceUsers.size == 0) {
                message.channel.send('Voice Channel is empty. Make sure the correct channel was entered')
            }

            for (let i in players) {
                let player = players[i];
                let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(player.toLowerCase()));
                if (member == null) {
                    crashers.push(player);
                } else if (!voiceUsers.includes(member)) {
                    if (member.voice.channel == 'lounge' || member.voice.channel == 'afk') {
                        member.edit({ channel: channel });
                        movedIn.push(`<@!${member.id}>`);
                    }
                    crashers.unshift(`<@!${member.id}>`);
                }
            }
            for (let i in voiceUsers) {
                let nick = voiceUsers.nickname
                if (!players.includes(nick)) {
                    alts.push(`<@!${voiceUsers[i].id}>`);
                }
            }
            var crashersS = ' ', altsS = ' ', movedS = ' '
            for (let i in crashers) { crashersS = crashersS.concat(crashers[i]) + ', ' }
            for (let i in alts) { altsS = altsS.concat(alts[i]) + ', ' }
            for (let i in movedIn) { movedS = movedS.concat(movedIn[i]) + ', ' }
            if (crashersS == ' ') { crashersS = 'None' }
            if (altsS == ' ') { altsS = 'None' }
            if (movedS == ' ') { movedS = 'None' }
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
        } catch (er) {
            console.log(er);
            message.channel.send(`Error handling parsed data. Try again`)
        }
    }
}

async function parseImage(image) {
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data: { text } } = await worker.recognize(image);
    await worker.terminate();
    return text;
}