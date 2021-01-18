const Discord = require('discord.js')
const CachedMessages = {}

module.exports = {
    name: 'eventcurrentweek',
    description: 'Updates the current week stats or force starts the next week',
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
        let leaderLog = guild.channels.cache.get(settings.channels.eventpastweeks)
        if (!leaderLog) return console.log('Channel not found')
        await this.sendEmbed(leaderLog, db, bot)
        await db.query(`UPDATE users SET currentweekEvents = 0`)
        this.update(guild, db, bot)
    },
    async update(guild, db, bot) {
        let settings = bot.settings[guild.id]
        let currentweek = guild.channels.cache.get(settings.channels.eventcurrentweek)
        if (!currentweek) return;
        this.sendEmbed(currentweek, db, bot)
    },
    async sendEmbed(channel, db, bot) {
        let settings = bot.settings[channel.guild.id]
        console.log("returning promise")
        return new Promise(async function (resolve, reject) {
            console.log("calling db")
            db.query(`SELECT * FROM users WHERE currentweekEvents != 0`, async function (err, rows) {
                if (err) reject(err)
                console.log("db call done")
                let logged = []
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged runs!')
                    .setDescription('None!')
                console.log('about to sort')
                rows.sort((a, b) => (parseInt(a.currentweekEvents) < parseInt(b.currentweekEvents)) ? 1 : -1)
                console.log("done sorting")
                let index = 0
                let embeds = []
                console.log("about to fit logged strings in embed")
                for (let i of rows) {
                    let string = `**[${index + 1}]** <@!${i.id}>:\nMinutes Lead: \`${parseInt(i.currentweekEvents) * 10}\``
                    fitStringIntoEmbed(embed, string)
                    logged.push(i.id)
                    index++;
                }
                console.log("done fitting logged strings in embed")
                console.log('logged length', logged.length)
                console.log("about to add in rls who didnt log")
                console.log(channel.guild.members.cache.filter(m => m.roles.highest.id == settings.roles.eventrl).size)
                console.log("bruhh")
                await channel.guild.members.cache.filter(m => m.roles.highest.id == settings.roles.eventrl).each(m => {
                    if (!logged.includes(m.id)) {
                        let string = `<@!${m.id}> has not logged any runs or been assisted this week`
                        fitStringIntoEmbed(embed, string)
                    }
                })
                console.log("dont adding rls stuff")
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
                if (channel.id == settings.channels.eventcurrentweek) {
                    try {
                        console.log('ready to send messages')
                        if (CachedMessages[channel.guild.id] && CachedMessages[channel.guild.id].length > 0) {
                            if (embeds.length !== CachedMessages[channel.guild.id].length) resendMessages()
                            else editMessages()
                        } else gatherMessages()
                        async function resendMessages() {
                            console.log("resending messages")
                            await channel.bulkDelete(20)
                            if (CachedMessages[channel.guild.id]) CachedMessages[channel.guild.id] = []
                            for (let i in embeds) {
                                let m = await channel.send(embeds[i])
                                CachedMessages[channel.guild.id].push(m)
                            }
                            console.log("done resending messages")
                        }
                        async function gatherMessages() {
                            console.log("gathering messages")
                            CachedMessages[channel.guild.id] = []
                            let messages = await channel.messages.fetch({ limit: 3 })
                            let messageArray = messages.array()
                            if (messageArray.length !== embeds.length) resendMessages()
                            else for (let i of messageArray) { CachedMessages[channel.guild.id].push(i); editMessages(); }
                            console.log("done gathering messages")
                        }
                        async function editMessages() {
                            console.log("editing messages")
                            for (let i in CachedMessages[channel.guild.id]) {
                                CachedMessages[channel.guild.id][i].edit(embeds[i])
                            }
                            console.log('messages edited')
                        }
                    } catch (er) { console.log(er) }
                } else for (let i in embeds) channel.send(embeds[i])
                console.log('done')
                resolve(true)
            })
        })
    }
}