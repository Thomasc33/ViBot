const Discord = require('discord.js')
const leaderboardTemplates = require('../data/motmgLeaderboard.json')
const ErrorLogger = require(`../lib/logError`)

module.exports = {
    name: 'motmg',
    role: 'headrl',
    guildSpecific: true,
    description: 'Hold on, still figuring it out. Just contact me ~Ben',
    async execute(message, args, bot, db) {
        await module.exports.sendMotmgLeaderboardChannelMessage(message.guild, bot, db)
        await message.replySuccess()
    },
    async getLeaderboardEmbed(guild, bot, db, dungeon) {
        const settings = bot.settings[guild.id]
        const emojis = bot.storedEmojis
        const unixTimestamp = settings.numerical.milestoneStartTimestamp
        let template = module.exports.getMotmgLeaderboardTemplate(guild)
        const databaseColumn = template[dungeon].databaseColumn
        const [rows,] = await db.promise().query('SELECT userid, amount FROM loggedusage WHERE guildid = ? AND logged = ? AND utime > ?', [guild.id, databaseColumn, unixTimestamp])
        const uniqueUsers = await module.exports.getUniqueUsers(rows)
        var userPoints = module.exports.addAllUserPoints(uniqueUsers)
        userPoints = module.exports.accumulateAllUserPoints(rows, userPoints, uniqueUsers)
        const emoji = emojis[template[dungeon].emoji].text
        const sortedUserPoints = module.exports.sortObject(userPoints)
        var seperateFieldStrings = []
        var strings = []
        for (let user in sortedUserPoints) {
            let prettyString = `<@!${user}>: \`${sortedUserPoints[user]}\``
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
        await module.exports.deleteMotmgLeaderboardChannelMessages(guild, bot)
        let template = module.exports.getMotmgLeaderboardTemplate(guild)
        Object.keys(template).map(async row => {
            let embedList = await module.exports.getLeaderboardEmbed(guild, bot, db, row)
            try {
                await channel.send({ embeds: embedList })
            } catch (e) {
                ErrorLogger.log(e, bot, guild);
            }
        })
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
    async getUniqueUsers(object) {
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
    }
}