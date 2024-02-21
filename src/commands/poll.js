const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError');
const pollInfo = require('../data/poll.json');

module.exports = {
    name: 'poll',
    description: 'Puts a poll in a raid status channel',
    args: '<poll type>',
    requiredArgs: 1,
    role: 'eventrl',
    getNotes(guild) {
        if (pollInfo.hasOwnProperty(guild.id)) {
            return pollInfo[guild.id].map(pollTemplate => `${pollTemplate.name}: \`${pollTemplate.aliases.join('\`, \`')}\``).join('\n')
        }
        return 'This server has no poll templates.'
    },
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

                if (choice.toLowerCase() == poll.name.toLowerCase()) return poll
                if (poll.aliases.includes(choice.toLowerCase())) return poll
            }
            return false
        }
        const poll = getChoice(choice)
        if (!poll) return message.channel.send(`No poll found for ${choice}`)

        let embedNew = new Discord.EmbedBuilder()
            .setColor('#fefefe')
            .setTitle(poll.name)
            .setDescription(`Please react to one of the below dungeons.\nAlternatively, please react to one of the items displayed below that you are bringing.\n\n${poll.reacts.map(react => `${bot.storedEmojis[react.emoji].text}: ${react.name}`).join('\n')}`)
            .setFooter({ text: `Started by ${message.member.displayName}` })
        let newMessage = await message.channel.send({ embeds: [embedNew] })
        poll.reacts.map(async react => {
            await newMessage.react(bot.storedEmojis[react.emoji].id)
        })
    }
}
