const Discord = require('discord.js');
const vision = require('@google-cloud/vision');
const botSettings = require('../settings.json')
const client = new vision.ImageAnnotatorClient(botSettings.gcloudOptions);

module.exports = {
    name: 'complete',
    description: 'Completion Parser',
    guildSpecific: true,
    // alias: ['pm'],
    args: '<image>',
    getNotes(guildid, member) {
        return 'Image can either be a link, or an embeded image'
    },
    role: 'eventrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]

        let parseStatusEmbed = new Discord.EmbedBuilder()
            .setColor(`#00ff00`)
            .setTitle('Completion Parse Status')
            .addFields([{ name: 'Completion Parse By', value: `${message.member}` }])
            .addFields([{ name: 'Status', value: 'Gathering image' }])
        let parseStatusMessage = await message.channel.send({ embeds: [parseStatusEmbed] })
        let image;
        if (message.attachments.size) image = await message.attachments.first().proxyURL;
        else if (args.length) image = args[0]; //added check if args actually exists
        if (!image) {
            parseStatusEmbed.setColor('#ff0000')
                .data.fields[1].value = 'Error Getting Image'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            return;
        }
        parseStatusEmbed.data.fields[1].value = 'Sending Image to Google'
        parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
        try {
            const [result] = await client.textDetection(image);
            var players = result.fullTextAnnotation;
            players = players.text.replace(/[\n,]/g, " ").split(/ +/)
            players.shift()
            players.shift()
            players.shift()
        } catch (er) {
            parseStatusEmbed.data.fields[1].value = `Error: \`${er.message}\``
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            return;
        }

        let members = []
        for (let p of players) {
            let player = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(p.toLowerCase()))
            if (player) members.push(player)
        }
        if (!members.length) {
            parseStatusEmbed.data.fields[1].value = 'No players found'
            await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
            return;
        }
        let query = `UPDATE users SET o3runs = o3runs + 1 WHERE ${members.map(m => `id = '${m.id}'`).join(' OR ')}`
        await db.promise().query(query)
        parseStatusEmbed.data.fields[1].value = 'Completed'

        const maxMembersPerField = 40
        for (let i = 0; i < Math.ceil(members.length / maxMembersPerField); i++) parseStatusEmbed.data.fields.push({ name: `Members`, value: members.slice(i * maxMembersPerField, Math.min(startIndex + maxMembersPerField, members.length)).map(m => m.toString()).join(', ') })

        await parseStatusMessage.edit({ embeds: [parseStatusEmbed] })
    }
}
