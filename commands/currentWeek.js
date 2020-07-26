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
        let leaderLog = guild.channels.cache.get(settings.channels.pastweeks)
        if (leaderLog == null) { console.log('Channel not found'); return; }
        await this.sendEmbed(leaderLog, db, bot)
        await db.query(`UPDATE users SET currentweekCult = 0, currentweekVoid = 0, currentweekAssists = 0`)
        this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.get(settings.channels.currentweek)
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot)
    },
    async sendEmbed(channel, db, bot) {
        let settings = bot.settings[channel.guild.id]
        return new Promise(async function (resolve, reject) {
            db.query(`SELECT * FROM users WHERE currentweekCult != 0 OR currentweekVoid != 0 OR currentweekAssists != 0`, async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let runs = 0, cults = 0, voids = 0, assists = 0
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged runs!')
                    .setDescription('None!')
                rows.sort((a, b) => (parseInt(a.currentweekCult) + parseInt(a.currentweekVoid) + parseInt(a.currentweekAssists) / 2 < parseInt(b.currentweekCult) + parseInt(b.currentweekVoid) + parseInt(b.currentweekAssists) / 2) ? 1 : -1)
                let index = 0
                let embeds = []
                for (let i in rows) {
                    let string = `**[${index + 1}]** <@!${rows[i].id}>:\nRaids: \`${parseInt(rows[i].currentweekCult) + parseInt(rows[i].currentweekVoid) + parseInt(rows[i].currentweekAssists) / 2}\` (Void: ${rows[i].currentweekVoid}, Cult: ${rows[i].currentweekCult}, Assists: ${rows[i].currentweekAssists})`
                    runs += rows[i].currentweekCult + rows[i].currentweekVoid
                    cults += rows[i].currentweekCult
                    voids += rows[i].currentweekVoid
                    assists += rows[i].currentweekAssists
                    fitStringIntoEmbed(embed, string)
                    logged.push(rows[i].id)
                    index++;
                }
                await channel.guild.members.cache.filter(m => m.roles.cache.has(settings.roles.almostrl) || m.roles.cache.has(settings.roles.rl)).each(m => {
                    if (!logged.includes(m.id)) {
                        let string = `<@!${m.id}> has not logged any runs or been assisted this week`
                        fitStringIntoEmbed(embed, string)
                    }
                })
                embed.setFooter(`${runs} Total Runs (${voids} Voids, ${cults} Cults, ${assists} Assists)`)
                embeds.push(new Discord.MessageEmbed(embed))
                function fitStringIntoEmbed(embed, string) {
                    if (embed.description == 'None!') embed.setDescription(string)
                    else if (embed.description.length + string.length >= 2048) {//change to 2048
                        if (embed.fields.length == 0) embed.addField('-', string)
                        else if (embed.fields[embed.fields.length - 1].value.length + string.length >= 1024) { //change to 1024
                            if (embed.length + string.length + 1 >= 6000) {//change back to 6k
                                embeds.push(new Discord.MessageEmbed(embed))
                                embed.setDescription('None!')
                                embed.fields = []
                            } else embed.addField('-', string)
                        } else {
                            if (embed.length + string.length >= 6000) { //change back to 6k
                                embeds.push(new Discord.MessageEmbed(embed))
                                embed.setDescription('None!')
                                embed.fields = []
                            } else embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
                        }
                    } else embed.setDescription(embed.description.concat(`\n${string}`))
                }
                if (channel.name == settings.channels.currentweek) {
                    let messages = await channel.messages.fetch({ limit: 20 })
                    let messageArray = messages.array()
                    if (messageArray.length != embeds.length) channel.bulkDelete(20);
                    messages = await channel.messages.fetch({ limit: 20 })
                    messageArray = messages.array()
                    for (let i in embeds) {
                        if (messageArray[i]) await messageArray[i].edit(embeds[embeds.length - (parseInt(i) + 1)])
                        else channel.send(embeds[i])
                    }
                } else for (let i in embeds) await channel.send(embeds[i])
                resolve(true)
            })
        })
    }
}