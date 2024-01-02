const fs = require('fs')
const botStatus = require('./botstatus')
const { EmbedBuilder } = require('discord.js')

module.exports = {
    name: 'restart',
    description: 'Restarts the bot',
    role: 'moderator',
    restarting: false,
    allowedInRestart: true,

    async execute({ channel }, args, bot) {
        // Log channel the message was sent to
        const d = {
            guild: channel.guild.id,
            channel: channel.id
        }
        // Save channel object to file
        fs.writeFileSync('./data/restart_channel.json', JSON.stringify(d, null, 2))

        module.exports.restarting = true

        /** @type {afkCheck.afkCheck[]} */
        const afks = Object.values(bot.afkModules).filter(afk => afk.active)

        for (const afk of afks) {
            afk.saveBotAfkCheck()
        }

        if (args[0]?.toLowerCase() == 'force' || !afks.length) process.exit()

        const fields = afks.reduce((fields, afk) => {
            const field = fields.find(field => field.name === afk.guild.name)
            if (field) field.value += `\n${afk.raidStatusMessage.url}`
            else fields.push({ name: afk.guild.name, value: afk.raidStatusMessage.url })
            return fields
        }, [])

        await channel.send({ embeds: [
            new EmbedBuilder()
                .setTitle('Restarting')
                .setDescription(`Restart is waiting for ${afks.length} Afks:`)
                .setFields(fields)
        ] })
        await botStatus.updateStatus(bot, 'Restart Pending', '#ff0000')

        new Promise((resolve) => {
            setInterval(() => {
                if (!Object.values(bot.afkModules).some(afk => afk.active)) resolve()
            }, 5000)
        }).then(async () => {
            await channel.send('Bot restarting now, please wait...').catch(() => {})
            process.exit()
        })
    }
}
