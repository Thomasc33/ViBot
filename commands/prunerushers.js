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
        //Create lists of rushers
        let today = new Date()
        const dateOffset = 90
        const rushers = await this.getRushers(message.guild.id, db)
        const inactiveRushers = rushers.filter(rusher => new Date(parseInt(rusher.time)) < today.setDate(today.getDate() - dateOffset))

        if (inactiveRushers.length == 0) {
            message.channel.send(`No rushers to prune!`)
            return;
        } 
        //Create Embed
        let embed = new Discord.MessageEmbed()
            .setColor('#BF40BF')
            .setTitle('Prune Rushers')
            .setDescription('Prune Inactive Rushers? \n')
            .setFooter(`Please react ${message.member.name}!`)
        
        inactiveRushers.forEach(rusher => {
            embed.description += `${message.guild.members.cache.get(rusher.id)}\n` 
        })
        
        let embedMessage = await message.channel.send({ embeds: [embed] })
        if (await embedMessage.confirm( message.author.id)) {
            this.purgeRushers(message.guild.id, db, dateOffset)
            //Remove Rusher roles
            inactiveRushers.forEach(element => {
                message.guild.members.cache.get(element.id).roles.remove(bot.settings[message.guild.id].roles.rusher)
            })
            embed.setFooter('Purge Completed!')
        } else {
            embed.setFooter('Purge Canceled!')
        }
    },
    //DB Query for Rushers
    async getRushers(guildId, db) {
        return new Promise(res => {
            db.query(`SELECT * FROM rushers WHERE guildId = '${guildId}'`, (err, rows) => {
                res(rows && rows.length ? rows : []);
            })
        })
    },
    async purgeRushers(guildId, db, dateOffset) {
        let today = new Date()
        return new Promise(res => {
            db.query(`DELETE FROM rushers WHERE guildId = '${guildId}' and time < ${today.setDate(today.getDate() - dateOffset)}`, (err, rows) => {
                res(rows && rows.length ? rows : []);
            })
        })
    }
}