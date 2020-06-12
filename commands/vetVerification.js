const Discord = require('discord.js')
const botSettings = require('../settings.json')
const ErrorLogger = require('../logError')
const realmEyeScrape = require('../realmEyeScrape')

var embedMessage, bot

module.exports = {
    name: 'vetverification',
    role: 'Moderator',
    description: 'createmessage',
    execute(message, args, bot, db) {
        switch (args[0]) {
            case 'createmessage':
                this.createMessage(message, bot, db)
                break;
        }
    },
    async createMessage(message, bot, db) {
        let vetVeriChannel = message.guild.channels.cache.find(c => c.name === 'veteran-verification')
        if (vetVeriChannel == null) {
            message.channel.send('`veteran-verification` not found')
            return;
        }
        let vetVeriEmbed = new Discord.MessageEmbed()
            .setTitle('Veteran Verification for Lost Halls')
            .addField('How to', 'React with the :white_check_mark: to get the role.\nMake sure to make your graveyard and character list public on realmeye before reacting\nAlso run the command ;stats and -stats and see if you have a total of 100 runs completed.')
            .addField('Requirements', '-2 8/8 Characters\n-1 8/8 Melee Character\n-100 Completed Lost Halls')
        embedMessage = await vetVeriChannel.send(vetVeriEmbed)
        embedMessage.react('✅')
        this.init(message.guild, bot, db)
    },
    async init(guild, bott, db) {
        bot = bott
        if (embedMessage == undefined) {
            let vetVeriChannel = guild.channels.cache.find(c => c.name === 'veteran-verification')
            if (vetVeriChannel == null) return;
            let messages = await vetVeriChannel.messages.fetch({ limit: 1 })
            embedMessage = messages.first()
            let reactionCollector = new Discord.ReactionCollector(embedMessage, checkFilter)
            reactionCollector.on('collect', (r, u) => {
                this.vetVerify(u, guild, db)
            })
        }
    },
    async vetVerify(u, guild, db) {
        let member = guild.members.cache.get(u.id)
        let vetRaider = guild.roles.cache.find(r => r.name === 'Veteran Raider')
        if (member == null) return;
        if (members.roles.cache.has(vetRaider.id)) return;
        let runs = 0
        db.query(`SELECT * FROM users WHERE id = '${u.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            runs += parseInt(rows[0].cultRuns)
            runs += parseInt(rows[0].voidRuns)
        })
        let userInfo = realmEyeScrape.getUserInfo(member.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|')[0])
    }
}
const checkFilter = (r, u) => !u.bot && r.emoji.name === '✅'