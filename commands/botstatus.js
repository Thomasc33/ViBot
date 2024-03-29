const Discord = require('discord.js')
const reScrape = require('../lib/realmEyeScrape')
const { uptimeString } = require('./status.js')
const { iterServers } = require('../jobs/util.js')
const { getDB } = require('../dbSetup.js')

let StatusData = {
    'color': '#00ff00',
    'text': 'Chilling'
}

async function checkDataBase(db) {
    return await db.promise().query('SELECT id FROM users LIMIT 1').then(([rows, _]) => Boolean(rows && rows.length), () => false)
}

const embedTemplate = {
    'DB OK': async (bot, guild) => {
        const db = getDB(guild.id)
        if (!db) return 'N/A'
        return checkDataBase(db)
    },
    'RealmEye': async () => Boolean(await reScrape.handler.next()),
    'Uptime': async (bot) => uptimeString(bot)
}

// Generate an Embed from the base `embedTemplate` and any overrides
async function generateEmbed(bot, guild, templateOverrides) {
    const builder = new Discord.EmbedBuilder()
    // Apply overrides to the `embedTemplate` if they exist
    const fieldGenerator = templateOverrides ? { ...embedTemplate, ...templateOverrides } : embedTemplate;
    // Build the embed from the `fieldGenerator`
    builder.setTitle('ViBot Status')
           .setColor(StatusData.color)
           .addFields([{ name: 'Status', value: StatusData.text, inline: true },
                       ...await Promise.all(Object.entries(fieldGenerator).map(async ([key, valueGenerator]) => {
                                                let v = await valueGenerator(bot, guild)
                                                // If the field generator function returns a boolean, emoji-ify it
                                                if (typeof v === 'boolean') v = v ? '✅' : '❌'
                                                return { name: key, value: v, inline: true }
                                            }))
                     ])
           .setTimestamp()
    return builder
}

// Returns true if the update was sucessful, returns false if the update failed
async function update(bot, channel, embed) {
    const recentMessages = await channel.messages.fetch({ limit: 10 })
    const lastStatusMessage = recentMessages.find(m => m.author.id == bot.user.id && m.embeds.length == 1 && m.embeds[0].title == 'ViBot Status')
    if (!lastStatusMessage) return false
    await lastStatusMessage.edit({ embeds: [embed] })
    return true
}

module.exports = {
    name: 'botstatus',
    role: 'developer',
    args: 'send/update',
    //requiredArgs: 1,
    async execute(message, args, bot) {
        const settings = bot.settings[message.guild.id]
        if (!settings) return;

        const botstatusChannel = message.guild.channels.cache.get(settings.channels.botstatus)
        if (!botstatusChannel) return console.log('botstatus not found for ', message.guild.id)

        if (args.length == 0) return
        switch (args[0].toLowerCase()) {
            case 'send': {
                const embed = await generateEmbed(bot, message.channel.guild)
                await botstatusChannel.send({ embeds: [embed] })
                await message.channel.send(`Message sent in <#${botstatusChannel.id}>`)
                break;
            }

            case 'update': {
                const embed = await generateEmbed(bot, message.channel.guild)
                const updateSuccessful = await update(bot, botstatusChannel, embed)
                await message.channel.send(updateSuccessful ? `Message updated in <#${botstatusChannel.id}>` : 'Could not find an existing message to update')
                break;
            }

            default:
                await message.channel.send('Unknown argument, valid arguments are: "send", "update"')
        }
    },
    async updateAll(bot) {
        // Cache realmeye status across all servers
        const overrides = {
            'RealmEye': async () => Boolean(await reScrape.handler.next())
        }

        await iterServers(bot, async (bot, guild) => {
            const botstatusChannel = guild.channels.cache.get(bot.settings[guild.id].channels.botstatus)
            if (!botstatusChannel) return
            const embed = await generateEmbed(bot, guild, overrides)
            await update(bot, botstatusChannel, embed)
        })
    },
    async updateStatus(bot, newStatus, newColor) {
        StatusData.text = newStatus
        if (newColor) StatusData.color = newColor
        await this.updateAll(bot)
    },
}
