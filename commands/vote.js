const Discord = require('discord.js')
const getFeedback = require('./getFeedback')
const ErrorLogger = require('../lib/logError')

module.exports = {
    name: 'vote',
    role: 'headrl',
    args: '<ign>',
    requiredArgs: 1,
    description: 'Puts up a vote for promotions based on users current role.',
    notes: 'Puts the message in leader-chat/veteran-rl-chat based on vote',
    async execute(message, args, bot, db) {
        if (args.length == 0) return;
        for (let i in args) {
            let member = message.guild.members.cache.get(args[0])
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[i].toLowerCase()));
            if (!member) return message.channel.send(`Issue finding ${args[i]}. Try again`);
            postVote(message, member, bot, db)
        }
        message.delete()
    }
}

async function postVote(message, member, bot, db) {
    let settings = bot.settings[message.guild.id]
    let voteType
    if (member.roles.cache.has(settings.roles.fullskip)) {
        voteType = 'Veteran Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.vetleaderchat)
    } else if (member.roles.cache.has(settings.roles.rl)) {
        voteType = 'Fullskip'
        var channel = message.guild.channels.cache.get(settings.channels.vetleaderchat)
    } else if (member.roles.cache.has(settings.roles.almostrl)) {
        voteType = 'Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.leaderchat)
    } else if (member.roles.cache.has(settings.roles.trialrl)) {
        voteType = 'Almost Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.leaderchat)
    } else return message.channel.send(`${member} doesn't have a role eligible for promotion`)
    let feedback = await getFeedback.getFeedback(member, message.guild, bot)
    let voteEmbed = new Discord.MessageEmbed()
        .setColor('#ff0000')
        .setAuthor(`${member.nickname} to ${voteType}`)
        .setDescription(`${member}\n`)
    if (member.user.avatarURL()) voteEmbed.author.iconURL = member.user.avatarURL()
    db.query(`SELECT * FROM users WHERE id = ${member.id}`, async (err, rows) => {
        if (err) ErrorLogger.log(err, bot)
        if (voteType != 'Almost Raid Leader')
            if (rows[0]) {
                voteEmbed.description += `Runs Logged: \`${rows[0].voidsLead}\` Voids, \`${rows[0].cultsLead}\` Cults\nRecent Feedback:\n`
            } else voteEmbed.description += `Issue getting runs\nRecent Feedback:\n`
        else voteEmbed.description += `Feedback:\n`
        let cont = true
        feedback.forEach(m => {
            if (cont)
                if (voteEmbed.description.length + `[Link](${m}) `.length < 2048) voteEmbed.description += `[Link](${m}) `
                else cont = false
        })
        let m = await channel.send(voteEmbed)
        await m.react('✅')
        await m.react('😐')
        await m.react('❌')
        if (voteType == 'Raid Leader') {
            m.react('👀')
        }
    })

}