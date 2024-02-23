const Discord = require('discord.js')
const { settings: botSettings, config: { botOwners } } = require('../lib/settings');

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
    async execute(message, args, bot, db) {
        if (!botOwners.includes(message.author.id)) return;
        const command = message.content.substring(6, message.content.length)
        const settings = botSettings[message.guild.id] // make settings easier to access in eval
        console.log(`evaling from ${message.member.nickname} -> \n${command}`)
        try {
            console.log(eval(command))
        } catch (er) {
            console.log(`eval failed with error: \n${er}`)
            message.channel.send(`Error: \n${er}`)
        }
    }
}
