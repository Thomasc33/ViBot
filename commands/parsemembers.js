const Discord = require('discord.js');
const ErrorLogger = require('../logError')
const vision = require('@google-cloud/vision')
const client = new vision.ImageAnnotatorClient();


module.exports = {
    name: 'parsemembers',
    description: 'Parse',
    alias: 'pm',
    args: '<image>',
    notes: 'Image can either be a link, or an embeded image',
    role: 'Almost Raid Leader',
    async execute(message, args, bot) {
        var channel = message.member.voice.channel
        if (channel == null) {
            message.channel.send('Channel not found. Make sure you are in a channel, then try again');
            return;
        }
        var image;
        if (message.attachments.size == 0) {
            image = args[0];
        } else {
            image = await message.attachments.first().proxyURL;
        }
        if (image == null) return;
        console.log(image)

        message.channel.send(`Starting the parse.. This will take around a minute`);
        const [result] = await client.textDetection(image)
        var players = result.fullTextAnnotation.text.replace(/[\n,]/g, " ").split(/ +/)
        players.shift()
        players.shift()
        players.shift()
        console.log(players)
        try {
            var raiders = []
            for (let i in players) {
                raiders.push(players[i].toLowerCase())
            }
            var voiceUsers = []
            var alts = []
            var crashers = []
            var movedIn = []
            var findA = []
            var kickList = '/kick '
            voiceUsers = channel.members.array();
            if (voiceUsers.size == 0) {
                message.channel.send('Voice Channel is empty. Make sure the correct channel was entered')
                return;
            }
            for (let i in raiders) {
                let player = raiders[i];
                if (player == '') continue;
                let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(player.toLowerCase()));
                if (member == null) {
                    crashers.push(player);
                    kickList = kickList.concat(` ${player}`)
                } else if (!voiceUsers.includes(member)) {
                    if (member.roles.highest.position >= message.guild.roles.cache.find(r => r.name === 'Almost Raid Leader').position) continue;
                    if (member.voice.channel == 'lounge' || member.voice.channel == 'afk') {
                        member.edit({ channel: channel });
                        movedIn.push(`<@!${member.id}>`);
                    }
                    crashers.unshift(`<@!${member.id}>`);
                    kickList = kickList.concat(` ${player}`)
                    findA.push(player)
                }
            }
            for (let i in voiceUsers) {
                if (voiceUsers[i].roles.highest.position >= message.guild.roles.cache.find(r => r.name === 'Almost Raid Leader').position) continue;
                let nick = voiceUsers[i].nickname.toLowerCase().replace(/[^a-z|]/gi, '')
                if (!raiders.includes(nick)) {
                    alts.push(`<@!${voiceUsers[i].id}>`);
                }
            }
            var crashersS = ' ', altsS = ' ', movedS = ' ', find = `;find `
            for (let i in crashers) { crashersS = crashersS.concat(crashers[i]) + ', ' }
            for (let i in alts) { altsS = altsS.concat(alts[i]) + ', ' }
            for (let i in movedIn) { movedS = movedS.concat(movedIn[i]) + ', ' }
            for (let i in findA) { find = find.concat(findA[i]) + ' ' }
            if (crashersS == ' ') { crashersS = 'None' }
            if (altsS == ' ') { altsS = 'None' }
            if (movedS == ' ') { movedS = 'None' }
            let embed = new Discord.MessageEmbed()
                .setTitle(`Parse for ${channel.name}`)
                .setColor('#00ff00')
                .setDescription(`There are ${crashers.length} crashers, ${alts.length} potential alts, and ${movedIn.length} people that got moved in`)
                .addFields(
                    { name: 'Potential Alts', value: altsS },
                    { name: 'Moved In', value: movedS },
                    { name: 'Crashers', value: crashersS },
                    { name: 'Find Command', value: `\`\`\`${find}\`\`\`` },
                    { name: 'Kick List', value: `\`\`\`${kickList}\`\`\`` }
                )
            message.channel.send(embed);
        } catch (er) {
            ErrorLogger.log(er, bot)
            message.channel.send(`Error handling parsed data. Details have been shared with Vi. Please try again`)
            return;
        }
    }
}
