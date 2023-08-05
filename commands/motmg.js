const Discord = require('discord.js')
const leaderboardTemplates = require('../data/motmgLeaderboard.json')
const ErrorLogger = require(`../lib/logError`)
const { iterServers } = require('../jobs/util.js')
const dbSetup = require('../dbSetup.js');
const { RepeatedJob } = require('../jobs/RepeatedJob.js')

class Motmg extends RepeatedJob {
    async run(bot) {
        await iterServers(bot, async function (bot, g) {
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
    async getLeaderboardEmbed(guild, bot, db, dungeon, startWeek, endWeek) {
        const settings = bot.settings[guild.id]
        const emojis = bot.storedEmojis
        const startUnixTimestamp = module.exports.getTimestamp(startWeek, settings)
        const endUnixTimestamp = module.exports.getTimestamp(endWeek, settings)

        const discordTimestampStart = `<t:${Math.floor(startUnixTimestamp / 1000)}:f>`
        const discordTimestampEnd = `<t:${Math.floor(endUnixTimestamp / 1000)}:f>`
        let template = module.exports.getMotmgLeaderboardTemplate(guild)
        const databaseColumn = template[dungeon].databaseColumn
        const [rows,] = await db.promise().query('SELECT userid, amount FROM loggedusage WHERE guildid = ? AND logged = ? AND utime BETWEEN ? AND ?', [guild.id, databaseColumn, startUnixTimestamp, endUnixTimestamp])
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
            if (strings.join('\n').length + prettyString.length >= 950) {
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
            .setDescription(`These runs are between ${discordTimestampStart} and ${discordTimestampEnd}`)
            .setColor('#015c21')
        let embedIndex = 1
        for (let index in seperateFieldStrings) {
            if (embedIndex >= 9 || embed.length + stringArray.join('\n').length + `${emoji} ${dungeon} Week ${startWeek + 1} - ${endWeek} (${embedIndex}) ${emoji}`.length >= 5950) { // giving it a 50 buffer
                embeds.push(embed)
                embed = new Discord.EmbedBuilder()
                    .setTitle('Leaderboard')
                    .setDescription(`These runs are between ${discordTimestampStart} and ${discordTimestampEnd}`)
                    .setColor('#015c21')
                embedIndex = 1
            }
            let stringArray = seperateFieldStrings[index]
            embed.addFields({
                name: `${emoji} ${dungeon} Week ${startWeek + 1} - ${endWeek} (${embedIndex}) ${emoji}`,
                value: stringArray.join('\n'),
                inline: true
            })
            embedIndex++
        }
        if (embed.data && embed.data.fields && embed.data.fields.length > 0) { embeds.push(embed) }
        return embeds
    },
    getTimestamp(week, settings) {
        week = parseInt(week)
        switch (week) {
            case 0:
                return settings.numerical.milestoneStartTimestamp
            case 1:
                return settings.numerical.timestamp1
            case 2:
                return settings.numerical.timestamp2
            case 3:
                return settings.numerical.timestamp3
            case 4:
                return settings.numerical.timestamp4
            default:
                return settings.numerical.milestoneStartTimestamp
        }
    },
    async getLeaderboardEmbedTotal(guild, bot, db, startWeek, endWeek) {
        const settings = bot.settings[guild.id]
        const emojis = bot.storedEmojis

        const startUnixTimestamp = module.exports.getTimestamp(startWeek, settings)
        const endUnixTimestamp = module.exports.getTimestamp(endWeek, settings)

        const discordTimestampStart = `<t:${Math.floor(startUnixTimestamp / 1000)}:f>`
        const discordTimestampEnd = `<t:${Math.floor(endUnixTimestamp / 1000)}:f>`

        let template = module.exports.getMotmgLeaderboardTemplate(guild)
        let databaseColumns = Object.keys(template).map(key => template[key].databaseColumn)
        const [rows,] = await db.promise().query('SELECT userid, logged, amount FROM loggedusage WHERE guildid = ? AND utime BETWEEN ? AND ?', [guild.id, startUnixTimestamp, endUnixTimestamp])
        var dungeonPoints = {}
        for (let i in rows) {
            let row = rows[i]
            if (!databaseColumns.includes(row.logged)) { continue }
            dungeonPoints[row.logged] = 0
        }
        for (let i in rows) {
            let row = rows[i]
            if (!databaseColumns.includes(row.logged)) { continue }
            dungeonPoints[row.logged] += row.amount
        }
        const sortedDungeonPoints = module.exports.sortObject(dungeonPoints)
        const totalPoints = module.exports.getTotalPoints(sortedDungeonPoints)

        let dungeonWithMostPoints = Object.keys(sortedDungeonPoints)[0]
        let emoji;

        function getEmoji(dungeon) {
            for (let i in template) {
                if (dungeon == template[i].databaseColumn) {
                    emoji = emojis[template[i].emoji].text
                }
            }
            return emoji
        }
        function getPrettyName(dungeon) {
            for (let i in template) {
                if (dungeon == template[i].databaseColumn) {
                    prettyName = i
                }
            }
            return prettyName
        }
        emoji = getEmoji(dungeonWithMostPoints)

        var seperateFieldStrings = []
        var strings = []
        userIndex = 1;
        for (let user in sortedDungeonPoints) {
            let userPoints = sortedDungeonPoints[user]
            let userPercentage = Math.round((userPoints / totalPoints) * 100)
            let userEmoji = getEmoji(user)
            let prettyName = getPrettyName(user)
            let prettyString = `\`${userIndex.toString().padStart(3, ' ')}.\` \`${userPoints.toString().padStart(4, ' ')}\` \`${userPercentage.toString().padStart(3, ' ')}%\` ${userEmoji} ${prettyName}`
            userIndex++
            if (strings.length == 0) { strings.push(prettyString); continue; }
            if (strings.join('\n').length + prettyString.length >= 950) {
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
            .setDescription(`These runs are between ${discordTimestampStart} and ${discordTimestampEnd}`)
        let embedIndex = 1
        for (let index in seperateFieldStrings) {
            if (embedIndex >= 9 || embed.length + stringArray.join('\n').length + `${emoji} Week ${startWeek + 1} - ${endWeek} (${embedIndex}) ${emoji}`.length >= 5950) { // giving it a 50 buffer
                embeds.push(embed)
                embed = new Discord.EmbedBuilder()
                    .setTitle('Leaderboard')
                    .setColor('#015c21')
                    .setDescription(`These runs are between ${discordTimestampStart} and ${discordTimestampEnd}`)
                embedIndex = 1
            }
            let stringArray = seperateFieldStrings[index]
            embed.addFields({
                name: `${emoji} Week ${startWeek + 1} - ${endWeek} (${embedIndex}) ${emoji}`,
                value: stringArray.join('\n'),
                inline: true
            })
            embedIndex++
        }
        if (embed.data && embed.data.fields && embed.data.fields.length > 0) { embeds.push(embed) }
        return embeds
    },
    async getLeaderboardEmbedTotalTeam(guild, bot, db, team, startWeek, endWeek) {
        const settings = bot.settings[guild.id]
        const emojis = bot.storedEmojis

        const startUnixTimestamp = module.exports.getTimestamp(startWeek, settings)
        const endUnixTimestamp = module.exports.getTimestamp(endWeek, settings)

        const discordTimestampStart = `<t:${Math.floor(startUnixTimestamp / 1000)}:f>`
        const discordTimestampEnd = `<t:${Math.floor(endUnixTimestamp / 1000)}:f>`

        let template = module.exports.getMotmgLeaderboardTemplate(guild)
        let databaseColumns = Object.keys(template).map(key => template[key].databaseColumn)
        let teamMembersIDs = await guild.findUsersWithRole(team).map(member => member.id)
        let teamRole = await guild.findRole(team)
        const [rows,] = await db.promise().query('SELECT userid, logged, amount FROM loggedusage WHERE guildid = ? AND utime BETWEEN ? AND ?', [guild.id, startUnixTimestamp, endUnixTimestamp])
        var dungeonPoints = {}
        for (let i in rows) {
            let row = rows[i]
            if (!databaseColumns.includes(row.logged)) { continue }
            dungeonPoints[row.logged] = 0
        }
        for (let i in rows) {
            let row = rows[i]
            if (!databaseColumns.includes(row.logged)) { continue }
            if (!teamMembersIDs.includes(row.userid)) { continue }
            dungeonPoints[row.logged] += row.amount
        }
        hasThisEmbedGotPoints = true
        if (!hasThisEmbedGotPoints) { return }
        const sortedDungeonPoints = module.exports.sortObject(dungeonPoints)
        const totalPoints = module.exports.getTotalPoints(sortedDungeonPoints)

        let dungeonWithMostPoints = Object.keys(sortedDungeonPoints)[0]
        let emoji;

        function getEmoji(dungeon) {
            for (let i in template) {
                if (dungeon == template[i].databaseColumn) {
                    emoji = emojis[template[i].emoji].text
                }
            }
            return emoji
        }
        function getPrettyName(dungeon) {
            for (let i in template) {
                if (dungeon == template[i].databaseColumn) {
                    prettyName = i
                }
            }
            return prettyName
        }
        emoji = getEmoji(dungeonWithMostPoints)

        var seperateFieldStrings = []
        var strings = []
        userIndex = 1;
        for (let user in sortedDungeonPoints) {
            let userPoints = sortedDungeonPoints[user]
            let userPercentage = Math.round((userPoints / totalPoints) * 100)
            if (!userPercentage) userPercentage = 0
            let userEmoji = getEmoji(user)
            let prettyName = getPrettyName(user)
            let prettyString = `\`${userIndex.toString().padStart(3, ' ')}.\` \`${userPoints.toString().padStart(4, ' ')}\` \`${userPercentage.toString().padStart(3, ' ')}%\` ${userEmoji} ${prettyName}`
            userIndex++
            if (strings.length == 0) { strings.push(prettyString); continue; }
            if (strings.join('\n').length + prettyString.length >= 950) {
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
            .setDescription(`These runs are between ${discordTimestampStart} and ${discordTimestampEnd}\nTeam: ${teamRole}`)
        let embedIndex = 1
        for (let index in seperateFieldStrings) {
            if (embedIndex >= 9 || embed.length + stringArray.join('\n').length + `${emoji} ${teamRole.name} Week ${startWeek + 1} - ${endWeek} (${embedIndex}) ${emoji}`.length >= 5950) { // giving it a 50 buffer
                embeds.push(embed)
                embed = new Discord.EmbedBuilder()
                    .setTitle('Leaderboard')
                    .setColor('#015c21')
                    .setDescription(`These runs are between ${discordTimestampStart} and ${discordTimestampEnd}\nTeam: ${teamRole}`)
                embedIndex = 1
            }
            let stringArray = seperateFieldStrings[index]
            embed.addFields({
                name: `${emoji} ${teamRole.name} Week ${startWeek + 1} - ${endWeek} (${embedIndex}) ${emoji}`,
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
            let embeds = await module.exports.getLeaderboardEmbed(guild, bot, db, row, 0, 4)
            for (let i in embeds) {
                embedList.push(embeds[i])
            }
        }
        for (let row in template) {
            for (let i = 0; i < 5; i++) {
                let embeds = await module.exports.getLeaderboardEmbed(guild, bot, db, row, i, i + 1)
                for (let i in embeds) {
                    embedList.push(embeds[i])
                }
            }
        }
        let embeds = await module.exports.getLeaderboardEmbedTotal(guild, bot, db, 0, 4)
        for (let i in embeds) {
            embedList.push(embeds[i])
        }
        for (let i = 0; i < 5; i++) {
            let embeds = await module.exports.getLeaderboardEmbedTotal(guild, bot, db, i, i + 1)
            for (let i in embeds) {
                embedList.push(embeds[i])
            }
        }
        teams = module.exports.getTeams(guild, bot)
        for (let teamIndex in teams) {
            let embeds = await module.exports.getLeaderboardEmbedTotalTeam(guild, bot, db, teams[teamIndex], 0, 4)
            for (let i in embeds) {
                embedList.push(embeds[i])
            }
        }
        for (let teamIndex in teams) {
            for (let i = 0; i < 5; i++) {
                let embeds = await module.exports.getLeaderboardEmbedTotalTeam(guild, bot, db, teams[teamIndex], i, i + 1)
                for (let i in embeds) {
                    embedList.push(embeds[i])
                }
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
            } catch (e) {
                ErrorLogger.log(e, bot, guild);
            }
        }
    },
    getTeams(guild, bot) {
        const settings = bot.settings[guild.id]
        const teamRoles = []
        for (let i = 0; i < 30; i++) {
            if (!settings.roles[`motmgTeam${i + 1}`]) { continue; }
            teamRoles.push(settings.roles[`motmgTeam${i + 1}`])
        }
        return teamRoles
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
        iterServers(bot, async function (bot, g) {
            await module.exports.sendMotmgLeaderboardChannelMessage(g, bot, dbSetup.getDB(g.id))
        })
    }
}