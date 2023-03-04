const Discord = require("discord.js")
const reScrape = require('../lib/realmEyeScrape')

var statusMessages = {}
const StatusEmbed = new Discord.EmbedBuilder()

async function checkDataBase(db) {
    return new Promise((res) => {
        db.query('SELECT id FROM users LIMIT 1', (err, rows) => {
            if (!err || (rows && rows.length > 0)) return res(true)
            else return res(false)
        })
    })
}

module.exports = {
    name: 'botstatus',
    role: 'developer',
    args: 'send/update',
    //requiredArgs: 1,
    async execute(message, args, bot, db) {
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
        if (!StatusEmbed.data.fields || StatusEmbed.data.fields.length == 0) {
            //embed stuff
            StatusEmbed.setColor('#0000ff')
                .setTitle('ViBot Status')
                .addFields([
                    { name: 'Status', value: 'Initializing' },
                    { name: 'DB OK', value: await checkDataBase(db) ? '✅' : '❌', inline: true },
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
    async update(guild) {
        if (!statusMessages[guild.id]) return
        m = statusMessages[guild.id]
        await m.edit({ embeds: [StatusEmbed] })
    },
    async updateAll(db) {
        if (!StatusEmbed || !StatusEmbed.data || StatusEmbed.data.fields.length < 3) return //happens on bot initialization
        if (StatusEmbed.data.fields[0].value == 'Initializing') {
            StatusEmbed.data.fields[0].value = 'Chilling';
            StatusEmbed.setColor('#00ff00')
        }
        StatusEmbed.data.fields[1].value = await checkDataBase(db) ? '✅' : '❌'
        StatusEmbed.data.fields[2].value = await reScrape.handler.next() ? '✅' : '❌'
        for (let i in statusMessages) {
            await statusMessages[i].edit({ embeds: [StatusEmbed] })
        }
    },
    async setStatus() {

    },
    statusMessages,
    StatusEmbed,
}
