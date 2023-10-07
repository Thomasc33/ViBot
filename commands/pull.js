const { spawn } = require('child_process')
const { botOwners } = require('../settings.json')
const Discord = require('discord.js')
const process = require('process')
const cwd = process.cwd()

module.exports = {
    name: 'pull',
    role: 'moderator',
    description: 'pull code from github',
    /**
     *
     * @param {Discord.Message} message
     * @param {String[]} args
     * @param {Discord.Client} bott
     * @param {import('mysql').Connection} db
     */
    async execute(message) {
        if (!botOwners.includes(message.author.id)) return

        const embed = new Discord.EmbedBuilder({
            title: 'Pulling From Github',
            color: 0x00FF00
        })

        const m = await message.channel.send({ embeds: [embed] })

        let desc = '```shell\n'

        console.log('Pulling from github')
        try {
            const gitpull = spawn('git', ['pull'], {
                cwd
            })

            gitpull.on('error', (err) => {
                console.error(`Error running command: ${err}`)
                desc += err.message + '\n'
                embed.setDescription(desc + '```')
                embed.setColor(0xFF0000)
                m.edit({ embeds: [embed] })
            })

            gitpull.on('close', (code) => {
                console.log(`Command exited with code ${code}`)
                embed.setDescription(desc + '\n```\nExited with code ' + code)
                m.edit({ embeds: [embed] })
            })

            gitpull.stdout.on('data', (data) => {
                console.log(`Command output: ${data}`)
                desc += data + '\n'
                embed.setDescription(desc + '```')
                m.edit({ embeds: [embed] })
            })
        } catch (e) {
            console.error(e)
        }
    }
}
