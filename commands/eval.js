const { botOwners } = require('../settings.json')
// eslint-disable-next-line no-unused-vars
const Discord = require('discord.js')

module.exports = {
    name: 'eval',
    role: 'moderator',
    description: 'Runs the message given as if it was code',
    /**
     *
     * @param {Discord.Message} message
     * @param {String[]} args
     * @param {Discord.Client} bott
     * @param {import('mysql').Connection} db
     */
    async execute(message) {
        if (!botOwners.includes(message.author.id)) return
        const command = message.content.substring(6, message.content.length)
        console.log(`evaling from ${message.member.nickname} -> \n${command}`)
        try {
            // eslint-disable-next-line no-eval
            console.log(eval(command))
        } catch (er) {
            console.log(`eval failed with error: \n${er}`)
            message.channel.send(`Error: \n${er}`)
        }
    }
}
