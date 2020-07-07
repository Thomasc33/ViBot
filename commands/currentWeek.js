const Discord = require('discord.js')
module.exports = {
    name: 'currentweek',
    description: 'Updates the current week stats or force starts the next week',
    role: 'Developer',
    async execute(message, args, bot, db) {
        if (args.length == 0) {
            this.sendEmbed(message.channel, db, bot)
            return;
        }
        switch (args[0].toLowerCase()) {
            case 'reset':
                this.newWeek(message.guild, bot, db)
                break;
            case 'update':
                this.update(message.guild, db, bot);
                break;
        }
    },
    async newWeek(guild, bot, db) {
        let settings = bot.settings[guild.id]
        let leaderLog = guild.channels.cache.find(c => c.name === settings.pastweeks)
        if (leaderLog == null) { console.log('Channel not found'); return; }
        await this.sendEmbed(leaderLog, db, bot)
        await db.query(`UPDATE users SET currentweekCult = '0', currentweekVoid = '0', currentweekAssists = '0'`)
        //this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        return;
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.find(c => c.name === settings.currentweek);
        if (currentweek == undefined) return;
        await currentweek.bulkDelete(100);
        this.sendEmbed(currentweek, db, bot)
    },
    async sendEmbed(channel, db, bot) {
        let settings = bot.settings[channel.guild.id]
        return new Promise(async function (resolve, reject) {
            db.query(`SELECT * FROM users WHERE currentweekCult != '0' OR currentweekVoid != '0' OR currentweekAssists != '0'`, async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged runs!')
                    .setDescription('None!')
                rows.sort((a, b) => (parseInt(a.currentweekCult) + parseInt(a.currentweekVoid) + parseInt(a.currentweekAssists) / 2 < parseInt(b.currentweekCult) + parseInt(b.currentweekVoid) + parseInt(b.currentweekAssists) / 2) ? 1 : -1)
                let index = 0
                for (let i in rows) {
                    let string = `**[${index + 1}]** <@!${rows[i].id}>:\nRaids: \`${parseInt(rows[i].currentweekCult) + parseInt(rows[i].currentweekVoid) + parseInt(rows[i].currentweekAssists) / 2}\` (Void: ${rows[i].currentweekVoid}, Cult: ${rows[i].currentweekCult}, Assists: ${rows[i].currentweekAssists})`
                    fitStringIntoEmbed(embed, string)
                    logged.push(rows[i].id)
                    index++;
                }
                channel.guild.members.cache.filter(m => m.roles.cache.has(channel.guild.roles.cache.find(r => r.name === settings.arl).id) || m.roles.cache.has(channel.guild.roles.cache.find(r => r.name === settings.rl).id)).each(m => {
                    if (!rows.includes(m.id)) {
                        let string = `<@!${m.id}> has not logged any runs or been assisted this week`
                        fitStringIntoEmbed(embed, string)
                    }
                })
                channel.send(embed)
                function fitStringIntoEmbed(embed, string) {
                    if (embed.description == 'None!') {
                        embed.setDescription(string)
                    } else if (embed.description.length + string.length >= 2048) {
                        if (embed.fields.length == 0) {
                            embed.addField('-', string)
                        } else if (embed.fields[embed.fields.length - 1].value.length + string.length >= 1024) {
                            if (embed.length + string.length + 1 >= 6000) {
                                channel.send(embed)
                                embed.setDescription('None!')
                                embed.fields = []
                            } else {
                                embed.addField('-', string)
                            }
                        } else {
                            if (embed.length + string.length >= 6000) {
                                channel.send(embed)
                                embed.setDescription('None!')
                                embed.fields = []
                            } else {
                                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
                            }
                        }
                    } else {
                        embed.setDescription(embed.description.concat(`\n${string}`))
                    }
                }
                resolve(true)
            })
        })
    }
}