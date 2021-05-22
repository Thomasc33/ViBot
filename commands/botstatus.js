const Discord = require("discord.js")
const reScrape = require('../lib/realmEyeScrape')

var statusMessages = {}, Bot, DB
const interval = setInterval(() => { module.exports.updateAll() }, 120000) //update every 2 mins
const StatusEmbed = new Discord.MessageEmbed()
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
            default:
                return message.channel.send('Unknown arg')
        }
    },
    async init(guild, bot, db) {
        if (!Bot) Bot = bot
        if (!DB) DB = db
        if (StatusEmbed.fields.length == 0) {
            //embed stuff
            StatusEmbed.setColor('#0000ff')
                .setTitle('ViBot Status')
                //.setDescription('i put real shit in here :wink:')
                .addField('Status', 'Initializing', false)
                .addField('DB OK', await this.checkDataBase() ? '✅' : '❌', true)
                .addField('RealmEye', await reScrape.checkProxy() ? '✅' : '❌', true)
                .setTimestamp()
        }
        let settings = bot.settings[guild.id]
        if (!settings || !settings.channels.botstatus) return;

        let c = guild.channels.cache.get(settings.channels.botstatus)
        if (!c) return console.log('botstatus not found for ', guild.id)
        let ms = await c.messages.fetch({ limit: 10 })
        ms.filter(m => m.author.id == bot.user.id)
        statusMessages[guild.id] = ms.first()
        this.update(guild)
    },
    async send(guild) {
        let settings = Bot.settings[guild.id]
        let c = guild.channels.cache.get(settings.channels.botstatus)
        if (!c) return console.log('botstatus not found for ', guild.id)
        let m = await c.send(StatusEmbed)
        statusMessages[guild.id] = m
    },
    async update(guild) {
        if (!statusMessages[guild.id]) return
        m = statusMessages[guild.id]
        await m.edit(StatusEmbed)
    },
    async updateAll() {
        if (!DB || !Bot || StatusEmbed.fields.length < 3) return //happens on bot initialization
        if (StatusEmbed.fields[0].value == 'Initializing') {
            StatusEmbed.fields[0].value = 'Chilling';
            StatusEmbed.setColor('#00ff00')
        }
        StatusEmbed.fields[1].value = await this.checkDataBase() ? '✅' : '❌'
        StatusEmbed.fields[2].value = await reScrape.checkProxy() ? '✅' : '❌'
        for (let i in statusMessages) {
            await statusMessages[i].edit(StatusEmbed)
        }
    },
    async setStatus() {

    },
    statusMessages,
    StatusEmbed,
    async checkDataBase() {
        return new Promise((res) => {
            DB.query('SELECT id FROM users LIMIT 1', (err, rows) => {
                if (!err || (rows && rows.length > 0)) return res(true)
                else return res(false)
            })
        })

    }
}