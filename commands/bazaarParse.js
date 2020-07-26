const Discord = require('discord.js');
const ErrorLogger = require('../logError')
const vision = require('@google-cloud/vision')
const botSettings = require('../settings.json')
const client = new vision.ImageAnnotatorClient(botSettings.gcloudOptions);

module.exports = {
    name: 'bazaarparse',
    description: 'Parses people in bazaar to find people entering location early',
    role: 'Almost Raid Leader',
    alias: ['bp', 'bpm'],
    args: '<image>',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        let channel = message.member.voice.channel
        if (!channel) return message.channel.send('Make sure you are in a voice channel before parsing')
        let EarlyLocation = bot.afkChecks[channel.id].earlyLocation
        if (!EarlyLocation) return message.channel.send('I do not have any logs of runs for the channel you are currently in. Bazaar parse is only compatable with afk checks made by me.')
        let parseStatusEmbed = new Discord.MessageEmbed()
            .setColor(`#00ff00`)
            .setTitle('Bazaar-Parse Status')
            .addField('Parse by', `${message.member}`)
            .addField('Status', 'Getting Image')
        let parseStatusMessage = await message.channel.send(parseStatusEmbed)
        var image;
        if (message.attachments.size == 0) {
            image = args[0];
        } else {
            image = await message.attachments.first().proxyURL;
        }
        if (image == null) {
            parseStatusEmbed.setColor('#ff0000')
                .fields[1].value = `Error Getting Image`
            parseStatusMessage.edit(parseStatusEmbed)
            return;
        }
        parseStatusEmbed.fields[1].value = `Sending Image to Google`
        parseStatusMessage.edit(parseStatusEmbed)
        const [result] = await client.textDetection(image)
        var players = result.fullTextAnnotation.text.toLowerCase().replace(/[\n,]/g, " ").split(/ +/)
        players.shift()
        players.shift()
        players.shift()

        parseStatusEmbed.fields[1].value = `Processing Results`
        parseStatusMessage.edit(parseStatusEmbed)

        let crashers = []
        let supposedToBeThere = []
        let earlyLocationNames = []

        for (let i in EarlyLocation) {
            let m = message.guild.members.cache.get(EarlyLocation[i])
            let found = false
            if (m.nickname) {
                m.nickname.replace(/[^a-zA-Z|]/g, '').split('|').forEach(nick => {
                    earlyLocationNames.push(nick.toLowerCase())
                    if (players.includes(nick.toLowerCase())) found = true;
                })
            }
            if (!found) {
                supposedToBeThere.push(m)
            }
        }
        for (let i in players) {
            let name = players[i]
            if (name != '') {
                if (!earlyLocationNames.includes(name)) {
                    let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(name.toLowerCase()));
                    if (!member) crashers.push(name)
                    else if (member.roles.highest.position < message.guild.roles.cache.get(settings.roles.almostrl).position) crashers.push(name)
                }
            }
        }

        let embed = new Discord.MessageEmbed()
            .setTitle('Bazaar Parse')
            .setColor('#00ff00')
            .addField('Given Location, Not in Bazaar', 'None!')
            .addField('In Location Early', 'None!')

        for (let i in supposedToBeThere) {
            if (embed.fields[0].value == 'None!') embed.fields[0].value = `${supposedToBeThere[i]}`
            else embed.fields[0].value += `, ${supposedToBeThere[i]}`
        }
        for (let i in crashers) {
            if (embed.fields[1].value == 'None!') embed.fields[1].value = `${crashers[i]}`
            else embed.fields[1].value += `, ${crashers[i]}`
        }

        await message.channel.send(embed)
        parseStatusEmbed.fields[1].value = 'Parse Complete.'
        parseStatusMessage.edit(parseStatusEmbed)


    }
}  