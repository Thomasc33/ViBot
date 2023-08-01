const Discord = require('discord.js')
const leaderboardTemplates = require('../data/motmgLeaderboard.json')
const ErrorLogger = require(`../lib/logError`)
const { iterServers } = require('../jobs/util.js')
const dbSetup = require('../dbSetup.js');
const { RepeatedJob } = require('../jobs/RepeatedJob.js')

class Motmg extends RepeatedJob {
    async run(bot) {
        await iterServers(bot, async function(bot, g) {
            await module.exports.sendMotmgLeaderboardChannelMessage(g, bot, dbSetup.getDB(g.id))
        })
    }
}

module.exports = {
    name: 'motmg',
    role: 'headrl',
    guildSpecific: true,
    description: 'Manually updates the leaderboard channel',
    async execute(message, args, bot, db) {
        await module.exports.sendMotmgLeaderboardChannelMessage(message.guild, bot, db)
        await message.replySuccess()
    },
    Motmg,
    async getLeaderboardEmbed(guild, bot, db, dungeon) {
        const settings = bot.settings[guild.id]
        const emojis = bot.storedEmojis
        const unixTimestamp = settings.numerical.milestoneStartTimestamp
        let template = module.exports.getMotmgLeaderboardTemplate(guild)
        const databaseColumn = template[dungeon].databaseColumn
        const [rows,] = await db.promise().query('SELECT userid, amount FROM loggedusage WHERE guildid = ? AND logged = ? AND utime > ?', [guild.id, databaseColumn, unixTimestamp])
        const uniqueUsers = module.exports.getUniqueUsers(rows)
        var userPoints = module.exports.addAllUserPoints(uniqueUsers)
        userPoints = module.exports.accumulateAllUserPoints(rows, userPoints, uniqueUsers)
        const emoji = emojis[template[dungeon].emoji].text
        const sortedUserPoints = module.exports.sortObject(userPoints)
        const totalPoints = module.exports.getTotalPoints(sortedUserPoints)
        var seperateFieldStrings = []
        var strings = []
        userIndex = 1;
        for (let user in sortedUserPoints) {
            let prettyString = `\`${userIndex.toString().padStart(3, ' ')}.\` \`${sortedUserPoints[user].toString().padStart(4, ' ')}\` \`${Math.round((sortedUserPoints[user] / totalPoints) * 100).toString().padStart(3, ' ')}%\` <@!${user}>`
            userIndex++
            if (strings.length == 0) { strings.push(prettyString); continue; }
            if ((strings.join('\n') + prettyString.length) >= 1023) {
                seperateFieldStrings.push(strings)
                strings = []
                strings.push(prettyString)
                continue
            }
            strings.push(prettyString)
        }
        if (strings.length > 0) { seperateFieldStrings.push(strings) }
        const embeds = []
        var embed = new Discord.EmbedBuilder()
            .setTitle('Leaderboard')
            .setColor('#015c21')
        let embedIndex = 1
        for (let index in seperateFieldStrings) {
            if (embedIndex >= 9) {
                embeds.push(embed)
                embed = new Discord.EmbedBuilder()
                    .setTitle('Leaderboard')
                    .setColor('#015c21')
                embedIndex = 1
            }
            let stringArray = seperateFieldStrings[index]
            embed.addFields({
                name: `${emoji} ${dungeon} (${embedIndex}) ${emoji}`,
                value: stringArray.join('\n'),
                inline: true
            })
            embedIndex++
        }
        if (embed.data && embed.data.fields && embed.data.fields.length > 0) { embeds.push(embed) }
        return embeds
    },
    async deleteMotmgLeaderboardChannelMessages(guild, bot) {
        const settings = bot.settings[guild.id]
        let channel = bot.channels.cache.get(settings.channels.motmgLeaderboard)
        await channel.bulkDelete(100)
    },
    async sendMotmgLeaderboardChannelMessage(guild, bot, db) {
        const settings = bot.settings[guild.id]
        let channel = bot.channels.cache.get(settings.channels.motmgLeaderboard)
        if (!channel) { return }
        await module.exports.deleteMotmgLeaderboardChannelMessages(guild, bot)
        let template = module.exports.getMotmgLeaderboardTemplate(guild)
        var embedList = []
        for (let row in template) {
            let embeds = await module.exports.getLeaderboardEmbed(guild, bot, db, row)
            for (let i in embeds) {
                embedList.push(embeds[i])
            }
        }
        var embedListArray = []
        var temporaryEmbedList = []
        for (let i in embedList) {
            if (temporaryEmbedList.length >= 5) {
                embedListArray.push(temporaryEmbedList)
                temporaryEmbedList = []
            }
            temporaryEmbedList.push(embedList[i])
        }
        if (temporaryEmbedList.length > 0) { embedListArray.push(temporaryEmbedList) }
        for (let i in embedListArray) {
            try {
                await channel.send({ embeds: embedListArray[i] })
            }  catch (e) {
                ErrorLogger.log(e, bot, guild);
            }
        }
    },
    getMotmgLeaderboardTemplate(guild) {
        if (!Object.hasOwn(leaderboardTemplates, guild.id)) return undefined
        var template = leaderboardTemplates[guild.id]
        if (Object.hasOwn(template, '__REDIRECTION')) template = leaderboardTemplates[leaderboardTemplates[guild.id]['__REDIRECTION']]
        return template
    },
    sortObject(object) {
        return Object.fromEntries(Object.entries(object).sort(
            (a, b) => b[1] - a[1]
        ));
    },
    getUniqueUsers(object) {
        const uniqueUsers = []
        object.map(row => {
            if (!uniqueUsers.includes(row.userid)) {
                uniqueUsers.push(row.userid)
            }
        })
        return uniqueUsers
    },
    accumulateAllUserPoints(rows, object, users) {
        rows.map(row => {
            if (!Object.hasOwn(object, row.userid)) { return }
            object[row.userid.toString()] += row.amount
        })
        return object
    },
    addAllUserPoints(users) {
        let newObject = {}
        for (let i in users) {
            let user = users[i]
            newObject[user] = 0
        }
        return newObject
    },
    getTotalPoints(object) {
        let points = 0;
        for (const key in object) {
            points += object[key]
        }
        return points
    },
    async sendMessages(bot) {
        iterServers(bot, async function(bot, g) {
            await module.exports.sendMotmgLeaderboardChannelMessage(g, bot, dbSetup.getDB(g.id))
        })
    }
}