const Discord = require('discord.js')

module.exports = {
    name: 'prunerushers',
    alias: ['pr'],
    role: 'officer',
    description: 'Prunes all inactive rushers',
    guildSpecific: true,
    /**
     * Main Execution Function
     * @param {Discord.Message} message
     * @param {String[]} args
     * @param {Discord.Client} bot
     * @param {import('mysql').Connection} db
     */
    async execute(message, args, bot, db) {
        // Create lists of rushers
        const settings = bot.settings[message.guild.id]
        if (!settings) return message.channel.send('Settings missing')

        const today = new Date()
        const rushers = await this.getRushers(message.guild.id, db)
        const inactiveRushers = rushers.filter(rusher => new Date(parseInt(rusher.time)) < today.setDate(today.getDate() - settings.numerical.prunerushersoffset))

        if (inactiveRushers.length == 0) {
            message.channel.send('No rushers to prune!')
            return
        }
        // Create Embed
        const embed = new Discord.EmbedBuilder()
            .setColor('#BF40BF')
            .setTitle('Prune Rushers')
            .setDescription('Prune Inactive Rushers? \n')
            .setFooter({ text: `Please react ${message.member.name}!` })

        inactiveRushers.forEach(rusher => {
            embed.data.description += `${message.guild.members.cache.get(rusher.id)}\n`
        })

        const embedMessage = await message.channel.send({ embeds: [embed] })
        if (await embedMessage.confirmButton(message.author.id)) {
            this.purgeRushers(message.guild.id, db, settings.numerical.prunerushersoffset)
            const rusherRole = bot.settings[message.guild.id].roles.rusher
            await Promise.all(inactiveRushers.map(rusher => message.guild.members.cache.get(rusher.id)?.roles?.remove(rusherRole)))

            embed.setFooter({ text: 'Purge Completed!' })
        } else {
            embed.setFooter({ text: 'Purge Canceled!' })
        }
    },
    // DB Query for Rushers
    async getRushers(guildId, db) {
        return new Promise(res => {
            db.query(`SELECT * FROM rushers WHERE guildId = '${guildId}'`, (err, rows) => {
                res(rows && rows.length ? rows : [])
            })
        })
    },
    async purgeRushers(guildId, db, dateOffset) {
        const today = new Date()
        return new Promise(res => {
            db.query(`DELETE FROM rushers WHERE guildId = '${guildId}' and time < ${today.setDate(today.getDate() - dateOffset)}`, (err, rows) => {
                res(rows && rows.length ? rows : [])
            })
        })
    }
}
