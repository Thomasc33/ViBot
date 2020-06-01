const Discord = require('discord.js')
module.exports = {
    name: 'currentweek',
    description: 'Updates the current week stats or force starts the next week',
    role: 'Developer',
    execute(message, args, bot, db) {
        return;
        if (args.length == 0) return;
        switch (args[0].toLowerCase()) {
            case 'reset':
                this.newWeek(message, bot, db)
                break;
            case 'update':
                this.update(message, db);
                break;
        }
    },
    newWeek(message, bot, db) {
        db.query(`SELECT * FROM users WHERE currentweek != '0' OR currentweekfailed != '0' OR currentweekassists != '0'`, (err, rows) => {
            let embed = new Discord.MessageEmbed()
                .setDescription(`**This weeks total logged runs**\n`)
                .setColor('#015c21')
            for (let i in rows) {
                let desc = `<@!${rows[i].id}>:\n\`${parseInt(rows[i].currentweek) + parseInt(rows[i].currentweekfailed)}\` runs: \`${rows[i].currentweek}\` Successful, \`${rows[i].currentweekfailed}\` Failed, and \`${rows[i].currentweekassists}\` Assists\n`
                if (embed.description.length + desc.length > 2048) {
                    message.guild.channels.cache.find(c => c.name === 'leader-activity-log').send(embed)
                    embed.setDescription('')
                }
                embed.setDescription(embed.description.concat(desc))
            }
            message.guild.channels.cache.find(c => c.name === 'leader-activity-log').send(embed)
        })
        db.query(`UPDATE users SET currentweek = '0', currentweekfailed = '0', currentweekassists = '0'`)
        this.update(message, db)
    },
    async update(message, db) {
        let currentweek = message.guild.channels.cache.find(c => c.name === 'current-week');
        if (currentweek == undefined) return;
        await currentweek.bulkDelete(100);
        db.query(`SELECT * FROM users WHERE currentweek != '0' OR currentweekfailed != '0' OR currentweekassists != '0'`, (err, rows) => {
            let embed = new Discord.MessageEmbed()
                .setDescription(`**This weeks total logged runs**\n`)
                .setColor('#015c21')
            for (let i in rows) {
                let desc = `<@!${rows[i].id}>:\n\`${parseInt(rows[i].currentweek) + parseInt(rows[i].currentweekfailed)}\` runs: \`${rows[i].currentweek}\` Successful, \`${rows[i].currentweekfailed}\` Failed, and \`${rows[i].currentweekassists}\` Assists\n`
                if (embed.description.length + desc.length > 2048) {
                    currentweek.send(embed)
                    embed.setDescription('')
                }
                embed.setDescription(embed.description.concat(desc))
            }
            currentweek.send(embed)
        })
    }
}