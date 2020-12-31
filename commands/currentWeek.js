const Discord = require('discord.js')
const tables = [
    { //halls
        id: '343704644712923138',
        runs: [
            'currentweekCult',
            'currentweekVoid'
        ],
        assists: [
            'currentweekAssists'
        ],
    },
    { //dev halls
        id: '701483950559985705',
        runs: [
            'currentweekCult',
            'currentweekVoid'
        ],
        assists: [
            'currentweekAssists'
        ],
    },
    { //o3
        id: '708026927721480254',
        runs: [
            'currentweeko3'
        ],
        assists: [
            'currentweekAssistso3'
        ],
    }
]
module.exports = {
    name: 'currentweek',
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
        let leaderLog = guild.channels.cache.get(settings.channels.pastweeks)
        if (!leaderLog) return console.log('Channel not found');
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
        let info
        for (let i of tables) {
            if (channel.guild.id == i.id) info = i
        }
        if (!info) return
        return new Promise(async function (resolve, reject) {
            let query1 = `SELECT * FROM users WHERE `
            for (let i of info.runs) query1 += `${i} != 0 OR `
            for (let i of info.assists) query1 += `${i} != 0 OR `
            db.query(query1.substring(0, query1.length - 3), async function (err, rows) {
                if (err) reject(err)
                let logged = []
                let runs = 0
                let embed = new Discord.MessageEmbed()
                    .setColor('#00ff00')
                    .setTitle('This weeks current logged runs!')
                    .setDescription('None!')
                rows.sort((a, b) => {
                    let aTot = 0, bTot = 0;
                    for (let i of info.runs) {
                        aTot += a[i]
                        bTot += b[i]
                    }
                    for (let i of info.assists) {
                        aTot += a[i] / 2
                        bTot += b[i] / 2
                    }
                    return (aTot < bTot) ? 1 : -1
                })
                let index = 0
                let embeds = []
                for (let i of rows) {
                    let runTot = 0
                    for (let j of info.runs) runTot += parseInt(i[j])
                    runs += runTot
                    for (let j of info.assists) runTot += parseInt(i[j]) / 2
                    let string = `**[${index + 1}]** <@!${i.id}>:\nRaids: \`${runTot}\` (`
                    for (let j of info.runs) string += `${j.replace('currentweek', '')}: ${i[j]}, `
                    for (let j of info.assists) string += `${j.replace('currentweek', '')}: ${i[j]}, `
                    string = string.substring(0, string.length - 2)
                    string += ')'
                    fitStringIntoEmbed(embed, string)
                    logged.push(i.id)
                    index++;
                }
                await channel.guild.members.cache.filter(m => m.roles.cache.has(settings.roles.almostrl) || m.roles.cache.has(settings.roles.rl)).each(m => {
                    if (!logged.includes(m.id)) {
                        let string = `<@!${m.id}> has not logged any runs or been assisted this week`
                        fitStringIntoEmbed(embed, string)
                    }
                })
                embed.setFooter(`${runs} Total Runs`)
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
                if (channel.id == settings.channels.currentweek) {
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