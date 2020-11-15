const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
module.exports = {
    name: 'parsecurrentweek',
    description: 'Updates the parse current week stats or force starts the next week',
    role: 'developer',
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
        let leaderLog = guild.channels.cache.get(settings.channels.pastparseweeks)
        if (leaderLog == null) return ErrorLogger.log(new Error('parse previous week not found'), bot)
        await this.sendEmbed(leaderLog, db, bot)
        await db.query(`UPDATE users SET currentweekparses`)
        this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.get(settings.channels.parsecurrentweek)
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot)
    },
    async sendEmbed(channel, db, bot) {
        let settings = bot.settings[channel.guild.id]
        return new Promise(async function (resolve, reject) {
            db.query(`SELECT * FROM users WHERE currentweekparses != 0`, async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let parses = 0, nonSecParses = 0
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged parses!')
                    .setDescription('None!')
                rows.sort((a, b) => (parseInt(a.currentweekparses) < parseInt(b.currentweekparse)) ? 1 : -1)
                let index = 0
                let embeds = []
                for (let i in rows) {
                    let member = channel.guild.members.cache.get(rows[i].id)
                    if (!member) continue
                    if (!member.roles.cache.has(settings.roles.security) && !member.roles.cache.has(settings.roles.officer)) { nonSecParses += rows[i].currentweekparses; continue }
                    let string = `**[${index + 1}]** <@!${rows[i].id}>:\nParses: \`${rows[i].currentweekparses}\``
                    parses += rows[i].currentweekparses
                    fitStringIntoEmbed(embed, string)
                    logged.push(rows[i].id)
                    index++;
                }
                await channel.guild.members.cache.filter(m => m.roles.cache.has(settings.roles.security) || m.roles.cache.has(settings.roles.officer)).each(m => {
                    console.log(m.id)
                    if (!logged.includes(m.id)) {
                        let string = `<@!${m.id}> has not parsed this week`
                        fitStringIntoEmbed(embed, string)
                    }
                })
                embed.setFooter(`${parses} Total Parses, ${nonSecParses} From Non-Security+`)
                embeds.push(new Discord.MessageEmbed(embed))
                function fitStringIntoEmbed(embed, string) {
                    if (embed.description == 'None!') embed.setDescription(string)
                    else if (embed.description.length + `\n${string}`.length >= 2048) {//change to 2048
                        if (embed.fields.length == 0) embed.addField('-', string)
                        else if (embed.fields[embed.fields.length - 1].value.length + `\n${string}`.length >= 1024) { //change to 1024
                            if (embed.length + `\n${string}`.length >= 6000) {//change back to 6k
                                embeds.push(new Discord.MessageEmbed(embed))
                                embed.setDescription('None!')
                                embed.fields = []
                            } else embed.addField('-', string)
                        } else {
                            if (embed.length + `\n${string}`.length >= 6000) { //change back to 6k
                                embeds.push(new Discord.MessageEmbed(embed))
                                embed.setDescription('None!')
                                embed.fields = []
                            } else embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
                        }
                    } else embed.setDescription(embed.description.concat(`\n${string}`))
                }
                if (channel.id == settings.channels.parsecurrentweek) {
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