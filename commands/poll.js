const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError');
const pollInfo = require('../data/poll.json');

module.exports = {
    name: 'poll',
    description: 'Puts a poll in a raid status channel',
    args: '<\`c/v\` -or- \`us/eu\` -or- \`r/a\` -or- \`exalts\`> -or- \`fc/n\`',
    requiredArgs: 1,
    role: 'eventrl',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (!settings) return message.channel.send('settings not setup')
        if (!pollInfo.hasOwnProperty(message.guild.id)) {
            return message.channel.send("Polls are not set up for this server.")
        }
        const choice = args.join(' ')
        function getChoice(choice) {
            let polls = pollInfo[message.guild.id]
            for (let i in polls) {
                let poll = polls[i]

                if (choice.toLowerCase() == poll.name) return poll
                if (poll.aliases.includes(choice.toLowerCase())) return poll
            }
            return false
        }
        const poll = getChoice(choice)
        if (!poll) return message.channel.send(`No poll found for ${choice}`)

        let embedNew = new Discord.EmbedBuilder()
            .setColor('#fefefe')
            .setTitle(poll.name)
            .setDescription(`Please react to one of the below dungeons\nOr react to one of the below gear or items that you're bringing\n\n${poll.reacts.map(react => `${bot.storedEmojis[react.emoji].text}: ${react.name}`).join('\n')}`)
            .setFooter({ text: `Started by ${message.guild.members.cache.get(message.author.id).nickname}` })
        let newMessage = await message.channel.send({ embeds: [embedNew] })
        poll.reacts.map(async react => {
            await newMessage.react(bot.storedEmojis[react.emoji].id)
        })
    }
}
