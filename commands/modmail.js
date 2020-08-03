const Discord = require('discord.js');
var watchedModMails = []

module.exports = {
    name: 'modmail',
    description: 'Mod Mail Handler',
    role: 'moderator',
    args: '<update>',
    async execute(message, args, bot, db) {
        switch (args[0].toLowerCase()) {
            case 'update':
                this.update(message.guild, bot, db)
                break;
        }
    },
    async update(guild, bot, db) {
        let settings = bot.settings[guild.id]
        let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        let messages = await modMailChannel.messages.fetch({ limit: 100 })
        messages.filter(m => m.author.id == bot.user.id && m.reactions.cache.has('🔑')).each(async function (m) {
            if (!m.reactions.cache.has('🔑') || watchedModMails.includes(m.id)) return;
            module.exports.watchMessage(m, db)
        })
    },
    async sendModMail(message, guild, bot, db) {
        let settings = bot.settings[guild.id]
        if (await checkBlacklist(message.author, db)) return
        message.react('📧')
        message.channel.send('Message has been sent to mod-mail. If this was a mistake, don\'t worry')
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setAuthor(message.author.tag, message.author.avatarURL())
            .setDescription(`<@!${message.author.id}> send the bot: "${message.content}"`)
            .setFooter(`User ID: ${message.author.id} MSG ID: ${message.id}`)
            .setTimestamp()
        let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        let embedMessage = await modMailChannel.send(embed).catch(er => ErrorLogger.log(er, bot))
        await embedMessage.react('🔑')
        setTimeout(() => module.exports.watchMessage(embedMessage, db), 1000)

    },
    async watchMessage(message, db) {
        watchedModMails.push(message.id)
        let m = message
        let guild = m.guild
        let bot = message.client
        let settings = bot.settings[guild.id]
        let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        let embed = m.embeds[0]
        if (embed == undefined) return;
        let modMailMessageID = embed.footer.text.split(/ +/g)[5]
        let raider = guild.members.cache.get(embed.footer.text.split(/ +/g)[2])
        let dms = await raider.user.createDM()
        let modMailMessage = await dms.messages.fetch(modMailMessageID)
        let keyCollector = new Discord.ReactionCollector(m, keyFilter)
        keyCollector.on('collect', async function (r, u) {
            let reactor = guild.members.cache.get(u.id)
            let choiceCollector = new Discord.ReactionCollector(m, choiceFilter)
            let collected = false;
            choiceCollector.on('collect', async function (r, u) {
                collected = true;
                choiceCollector.stop()
                if (reactor.id !== u.id) return;
                switch (r.emoji.name) {
                    case '📧':
                        let originalMessage = embed.description;
                        originalMessage = originalMessage.substring(originalMessage.indexOf(':') + 3, originalMessage.length - 1)
                        let responseEmbed = new Discord.MessageEmbed()
                            .setDescription(`__How would you like to respond to ${raider}'s [message](${m.url})__\n${originalMessage}`)
                        let responseEmbedMessage = await modMailChannel.send(responseEmbed)
                        let responseCollector = new Discord.MessageCollector(modMailChannel, m => m.author.id === reactor.id)
                        responseCollector.on('collect', async function (mes) {
                            let response = mes.content.trim()
                            responseCollector.stop()
                            await mes.delete()
                            responseEmbed.setDescription(`__Are you sure you want to respond with the following?__\n${response}`)
                            await responseEmbedMessage.edit(responseEmbed)
                            await responseEmbedMessage.react('✅')
                            await responseEmbedMessage.react('❌')
                            let ConfirmReactionCollector = new Discord.ReactionCollector(responseEmbedMessage, ConfirmationFilter)
                            ConfirmReactionCollector.on('collect', async function (r, u) {
                                if (u.id !== reactor.id) return;
                                if (r.emoji.name === '✅') {
                                    ConfirmReactionCollector.stop()
                                    await dms.send(response)
                                    responseEmbedMessage.delete()
                                    embed.addField(`Response by ${reactor.nickname}:`, response)
                                    m.edit(embed)
                                    await m.reactions.removeAll()
                                    await m.react('📫')
                                    keyCollector.stop()
                                }
                                else if (r.emoji.name === '❌') {
                                    ConfirmReactionCollector.stop()
                                    await responseEmbedMessage.delete()
                                    await m.reactions.removeAll()
                                    await m.react('🔑')
                                }
                                else return;
                            })
                        })
                        break;
                    case '👀':
                        let eyesEmbed = new Discord.MessageEmbed()
                            .setDescription(`Your [message](${modMailMessage.url}) has been recieved and read`)
                        await dms.send(eyesEmbed)
                        await m.reactions.removeAll()
                        await m.react('👀')
                        break;
                    case '🗑️':
                        await m.reactions.removeAll()
                        await m.react('🗑️')
                        keyCollector.stop()
                        break;
                    case '❌':
                        await m.delete()
                        keyCollector.stop()
                        return;
                    case '🔨':
                        db.query(`INSERT INTO modmailblacklist (id) VALUES ('${raider.id}')`)
                        await m.reactions.removeAll()
                        await m.react('🔨')
                        keyCollector.stop()
                        break;
                    case '🔒':
                        await m.reactions.removeAll()
                        await m.react('🔑')
                        break;
                }
            })
            await m.reactions.removeAll()
            if (!collected) await m.react('📧')
            if (!collected) await m.react('👀')
            if (!collected) await m.react('🗑️')
            if (!collected) await m.react('❌')
            if (!collected) await m.react('🔨')
            if (!collected) await m.react('🔒')
        })
    }
}

async function checkBlacklist(member, db) {
    return new Promise(async (res, rej) => {
        db.query(`SELECT * FROM modmailblacklist WHERE id = '${member.id}'`, (err, rows) => {
            if (err) return rej(err)
            if (rows.length == 0) {
                res(false)
            } else {
                res(true)
            }
        })
    })
}

const keyFilter = (r, u) => !u.bot && r.emoji.name === '🔑'
const choiceFilter = (r, u) => !u.bot && (r.emoji.name === '📧' || r.emoji.name === '👀' || r.emoji.name === '🗑️' || r.emoji.name === '❌' || r.emoji.name === '🔨' || r.emoji.name === '🔒')
const ConfirmationFilter = (r, u) => !u.bot && (r.emoji.name === '❌' || r.emoji.name === '✅')