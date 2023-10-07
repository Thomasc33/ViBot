const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'getfeedback',
    description: 'Fetches all mentions of the user in customer feedback',
    args: '<user mention/id>',
    requiredArgs: 1,
    role: 'rl',
    alias: ['gfb'],
    async execute(message, args, bot) {
        const settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (member == undefined) {
            member = message.guild.members.cache.get(args[0])
        }
        if (member == undefined) return message.channel.send('User not found')
        const customerFeedback = message.guild.channels.cache.get(settings.channels.rlfeedback)
        try {
            const findings = await message.channel.send(`Searching for mentions of ${member} in ${customerFeedback}`)
            let mentions = `Messages found mentioning ${member} in ${customerFeedback} in past 500 messages:\n`
            const messages = await getMessages(customerFeedback, 500)
            messages.forEach(m => {
                if (m.mentions.users.get(member.id)) {
                    mentions = mentions.concat(`\n${m.url}`)
                }
            })
            findings.edit(mentions)
        } catch (er) {
            message.channel.send('Error occured and details have been sent to Vi')
            ErrorLogger.log(er, bot, message.guild)
        }
    },
    async getFeedback(member, guild, bot) {
        const settings = bot.settings[member.guild.id]
        const feedbackChannel = guild.channels.cache.get(settings.channels.rlfeedback)
        const messages = await getMessages(feedbackChannel, 500)
        const mentions = []
        messages.forEach(m => {
            if (m.mentions.users.get(member.id)) {
                mentions.push(m.url)
            }
        })
        return mentions
    }
}

/**
 * @param {import('discord.js').GuildTextBasedChannel} channel
 * @param {number} limit
 * @returns {import('discord.js').Message[]}
 */
async function getMessages(channel, limit) {
    const sumMessages = []
    const options = { limit: 100 }
    while (sumMessages.length >= limit) {
        // eslint-disable-next-line no-await-in-loop
        const messages = await channel.messages.fetch(options)
        sumMessages.push(...messages.map(m => m))
        options.before = messages.last().id
        if (messages.size != 100) break
    }
    return sumMessages
}
