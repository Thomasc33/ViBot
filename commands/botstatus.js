const Discord = require("discord.js")
const reScrape = require('../lib/realmEyeScrape')

var statusMessages = {}, Bot, DB
const interval = setInterval(() => { module.exports.updateAll() }, 30000) //update every 2 mins
const StatusEmbed = new Discord.EmbedBuilder()
module.exports = {
    name: 'botstatus',
    role: 'developer',
    args: 'send/update',
    //requiredArgs: 1,
    async execute(message, args, bot, db) {
        if (!Bot) Bot = bot
        let settings = bot.settings[message.guild.id]
        if (!settings) return;

        //get arg
        if (args.length == 0) return
        switch (args[0].toLowerCase()) {
            case 'send':
                this.send(message.guild)
                break;
            case 'update':
                this.update(message.guild)
                break;
            default:
                return message.channel.send('Unknown arg')
        }
    },
    async init(guild, bot, db) {
        if (!Bot) Bot = bot
        if (!DB) DB = db
        if (!StatusEmbed.data.fields || StatusEmbed.data.fields.length == 0) {
            //embed stuff
            StatusEmbed.setColor('#0000ff')
                .setTitle('ViBot Status')
                .addFields([
                    { name: 'Status', value: 'Initializing' },
                    { name: 'DB OK', value: await this.checkDataBase() ? '✅' : '❌', inline: true },
                    { name: 'RealmEye', value: await reScrape.handler.next() ? '✅' : '❌', inline: true },
                ])
                .setTimestamp()
        }
        let settings = bot.settings[guild.id]
        if (!settings || !settings.channels.botstatus) return;

        let c = guild.channels.cache.get(settings.channels.botstatus)
        if (!c) return console.log('botstatus not found for ', guild.id)
        let ms = await c.messages.fetch({ limit: 10 })
        ms = ms.filter(m => m.author.id == bot.user.id)
        statusMessages[guild.id] = ms.first()
        this.update(guild)
    },
    async send(guild) {
        let settings = Bot.settings[guild.id]
        let c = guild.channels.cache.get(settings.channels.botstatus)
        if (!c) return console.log('botstatus not found for ', guild.id)
        let m = await c.send({ embeds: [StatusEmbed] })
        statusMessages[guild.id] = m
    },
    async update(guild) {
        if (!statusMessages[guild.id]) return
        m = statusMessages[guild.id]
        await m.edit({ embeds: [StatusEmbed] })
    },
    async updateAll() {
        if (!DB || !Bot || !StatusEmbed || !StatusEmbed.data || StatusEmbed.data.fields.length < 3) return //happens on bot initialization
        if (StatusEmbed.data.fields[0].value == 'Initializing') {
            StatusEmbed.data.fields[0].value = 'Chilling';
            StatusEmbed.setColor('#00ff00')
        }
        StatusEmbed.data.fields[1].value = await this.checkDataBase() ? '✅' : '❌'
        StatusEmbed.data.fields[2].value = await reScrape.handler.next() ? '✅' : '❌'
        for (let i in statusMessages) {
            await statusMessages[i].edit({ embeds: [StatusEmbed] })
        }
    },
    async setStatus() {

    },
    statusMessages,
    StatusEmbed,
    async checkDataBase() {
        return new Promise((res) => {
            if (!DB) DB = require('../index').bot.dbs['343704644712923138']
            DB.query('SELECT id FROM users LIMIT 1', (err, rows) => {
                if (!err || (rows && rows.length > 0)) return res(true)
                else return res(false)
            })
        })
    }
}