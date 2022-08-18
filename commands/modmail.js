const Discord = require('discord.js');
const { init } = require('./vetVerification');
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
            case 'sendinfo':
                this.sendInfo(message)
                break;
        }
    },
    // async update(guild, bot, db) {
    //     let settings = bot.settings[guild.id]
    //     let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
    //     let messages = await modMailChannel.messages.fetch({ limit: 100 })
    //     messages.filter(m => m.author.id == bot.user.id && m.reactions.cache.has('🔑')).each(async function (m) {
    //         if (!m.reactions.cache.has('🔑') || watchedModMails.includes(m.id)) return;
    //         module.exports.watchMessage(m, db)
    //     })
    // },
    async sendModMail(message, guild, bot, db) {
        let settings = bot.settings[guild.id]
        if (await checkBlacklist(message.author, db)) return
        message.react('📧')
        message.channel.send('Message has been sent to mod-mail. If this was a mistake, don\'t worry')
        let embed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setAuthor({ name: message.author.tag, iconURL: message.author.avatarURL() })
            .setDescription(`<@!${message.author.id}> send the bot: "${message.content}"`)
            .setFooter({ text: `User ID: ${message.author.id} MSG ID: ${message.id}` })
            .setTimestamp()
        let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        let embedMessage = await modMailChannel.send({ embeds: [embed] }).catch(er => ErrorLogger.log(er, bot))
        await embedMessage.react('🔑')
        //setTimeout(() => module.exports.watchMessage(embedMessage, db), 1000)
        if (message.attachments.first()) modMailChannel.send(message.attachments.first().proxyURL)
    },
    async init(guild, bot, db) {
        guild.channels.cache.get(bot.settings[guild.id].channels.modmail).messages.fetch({ limit: 100 })
    },
    // async watchMessage(message, db) {
    //     watchedModMails.push(message.id)
    //     let m = message
    //     let guild = m.guild
    //     let bot = message.client
    //     let settings = bot.settings[guild.id]
    //     let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
    //     let embed = m.embeds[0]
    //     if (!embed) return;
    //     let modMailMessageID = embed.footer.text.split(/ +/g)[5]
    //     let raider = guild.members.cache.get(embed.footer.text.split(/ +/g)[2])
    //     if (!raider) return
    //     let dms = await raider.user.createDM()

    //     function checkInServer() {
    //         const result = guild.members.cache.get(dms.recipient.id);
    //         if (!result)
    //             message.channel.send(`User ${dms.recipient} is no longer in the server.`);
    //         return result;
    //     }
    //     let modMailMessage = await dms.messages.fetch(modMailMessageID)
    //     let keyCollector = new Discord.ReactionCollector(m, keyFilter)
    //     keyCollector.on('collect', async function (r, u) {
    //         let reactor = guild.members.cache.get(u.id)
    //         let choiceCollector = new Discord.ReactionCollector(m, choiceFilter)
    //         let collected = false;
    //         choiceCollector.on('collect', async function (r, u) {
    //             collected = true;
    //             choiceCollector.stop()
    //             if (reactor.id !== u.id) return;
    //             if (!checkInServer()) {
    //                 await m.reactions.removeAll();
    //                 await m.react('🚫');
    //                 return;
    //             }
    //             switch (r.emoji.name) {
    //                 case '📧':
    //                     let originalMessage = embed.data.description;
    //                     originalMessage = originalMessage.substring(originalMessage.indexOf(':') + 3, originalMessage.length - 1)
    //                     let responseEmbed = new Discord.EmbedBuilder()
    //                         .setDescription(`__How would you like to respond to ${raider}'s [message](${m.url})__\n${originalMessage}`)
    //                     let responseEmbedMessage = await modMailChannel.send(responseEmbed)
    //                     let responseCollector = new Discord.MessageCollector(modMailChannel, m => m.author.id === reactor.id)
    //                     responseCollector.on('collect', async function (mes) {
    //                         let response = mes.content.trim()
    //                         if (response == '') return mes.channel.send(`Invalid response. Please provide text. If you attached an image, please copy the URL and send that`)
    //                         responseCollector.stop()
    //                         await mes.delete()
    //                         if (!checkInServer()) {
    //                             await m.reactions.removeAll();
    //                             await m.react('🚫');
    //                             return;
    //                         }
    //                         responseEmbed.setDescription(`__Are you sure you want to respond with the following?__\n${response}`)
    //                         await responseEmbedMessage.edit(responseEmbed)
    //                         await responseEmbedMessage.react('✅')
    //                         await responseEmbedMessage.react('❌')
    //                         let ConfirmReactionCollector = new Discord.ReactionCollector(responseEmbedMessage, ConfirmationFilter)
    //                         ConfirmReactionCollector.on('collect', async function (r, u) {
    //                             if (u.id !== reactor.id) return;
    //                             if (r.emoji.name === '✅') {
    //                                 ConfirmReactionCollector.stop()
    //                                 if (!checkInServer()) {
    //                                     responseEmbedMessage.delete();
    //                                     await m.reactions.removeAll();
    //                                     await m.react('🚫');
    //                                     return;
    //                                 }
    //                                 await dms.send(response)
    //                                 responseEmbedMessage.delete()
    //                                 embed.addFields([{name: `Response by ${reactor.nickname}:`, value: response}])
    //                                 m.edit(embed)
    //                                 await m.reactions.removeAll()
    //                                 await m.react('📫')
    //                                 keyCollector.stop()
    //                             } else if (r.emoji.name === '❌') {
    //                                 ConfirmReactionCollector.stop()
    //                                 await responseEmbedMessage.delete()
    //                                 await m.reactions.removeAll()
    //                                 await m.react('🔑')
    //                             } else return;
    //                         })
    //                     })
    //                     break;
    //                 case '👀':
    //                     let eyesEmbed = new Discord.EmbedBuilder()
    //                         .setDescription(`Your [message](${modMailMessage.url}) has been recieved and read`)
    //                     await m.reactions.removeAll()
    //                     if (checkInServer()) {
    //                         await dms.send(eyesEmbed)
    //                         await m.react('👀')
    //                     } else
    //                         await m.react('🚫');
    //                     break;
    //                 case '🗑️':
    //                     await m.reactions.removeAll()
    //                     await m.react('🗑️')
    //                     keyCollector.stop()
    //                     break;
    //                 case '❌':
    //                     await m.delete()
    //                     keyCollector.stop()
    //                     return;
    //                 case '🔨':
    //                     db.query(`INSERT INTO modmailblacklist (id) VALUES ('${raider.id}')`)
    //                     await m.reactions.removeAll()
    //                     await m.react('🔨')
    //                     keyCollector.stop()
    //                     break;
    //                 case '🔒':
    //                     await m.reactions.removeAll()
    //                     await m.react('🔑')
    //                     break;
    //             }
    //             if (m.guild.id == '343704644712923138' && r.emoji.id == '752368122551337061') {
    //                 await m.reactions.removeAll()
    //                 await m.react('752368122551337061')
    //                 let botReco = bot.guilds.cache.get('343704644712923138').channels.cache.get('746634644644167680')
    //                 if (botReco) {
    //                     let embed = new Discord.EmbedBuilder()
    //                     let oldEmbed = m.embeds[0]
    //                     embed.setColor('#ff0000')
    //                     embed.setDescription(oldEmbed.description)
    //                     let me = await botReco.send({ embeds: [embed] })
    //                     await me.react('👍')
    //                     await me.react('👎')
    //                 }
    //             }
    //         })
    //         await m.reactions.removeAll()
    //         if (!collected) await m.react('📧')
    //         if (!collected) await m.react('👀')
    //         if (!collected) await m.react('🗑️')
    //         if (!collected) await m.react('❌')
    //         if (!collected) await m.react('🔨')
    //         if (!collected) await m.react('752368122551337061')//temp, remove later
    //         if (!collected) await m.react('🔒')
    //     })
    // },
    async modmailLogic(message, db, u) {
        let m = message
        let guild = m.guild
        let bot = message.client
        let settings = bot.settings[guild.id]
        let modMailChannel = guild.channels.cache.get(settings.channels.modmail)
        let embed = m.embeds[0]
        if (!embed) return;
        let modMailMessageID = embed.footer.text.split(/ +/g)[5]
        let raider = guild.members.cache.get(embed.footer.text.split(/ +/g)[2])
        if (!raider) return
        let dms = await raider.user.createDM()

        function checkInServer() {
            const result = guild.members.cache.get(dms.recipient.id);
            if (!result)
                message.channel.send(`User ${dms.recipient} is no longer in the server.`);
            return result;
        }
        let modMailMessage = await dms.messages.fetch(modMailMessageID)

        let reactor = guild.members.cache.get(u.id)
        let choiceCollector = new Discord.ReactionCollector(m, { filter: choiceFilter })
        let collected = false;
        choiceCollector.on('collect', async function (r, u) {
            if (reactor.id !== u.id) return;
            collected = true;
            choiceCollector.stop()
            if (!checkInServer()) {
                await m.reactions.removeAll();
                await m.react('🚫');
                return;
            }
            switch (r.emoji.name) {
                case '📧':
                    let originalMessage = embed.data.description;
                    originalMessage = originalMessage.substring(originalMessage.indexOf(':') + 3, originalMessage.length - 1)
                    let responseEmbed = new Discord.EmbedBuilder()
                        .setDescription(`__How would you like to respond to ${raider}'s [message](${m.url})__\n${originalMessage}`)
                    let responseEmbedMessage = await modMailChannel.send({ embeds: [responseEmbed] })
                    let responseCollector = new Discord.MessageCollector(modMailChannel, { filter: m => m.author.id === reactor.id })
                    responseCollector.on('collect', async function (mes) {
                        let response = mes.content.trim()
                        if (response == '') return mes.channel.send(`Invalid response. Please provide text. If you attached an image, please copy the URL and send that`)
                        responseCollector.stop()
                        await mes.delete()
                        if (!checkInServer()) {
                            await m.reactions.removeAll();
                            await m.react('🚫');
                            return;
                        }
                        responseEmbed.setDescription(`__Are you sure you want to respond with the following?__\n${response}`)
                        await responseEmbedMessage.edit({ embeds: [responseEmbed] })
                        await responseEmbedMessage.react('✅')
                        await responseEmbedMessage.react('❌')
                        let ConfirmReactionCollector = new Discord.ReactionCollector(responseEmbedMessage, { filter: ConfirmationFilter })
                        ConfirmReactionCollector.on('collect', async function (r, u) {
                            if (u.id !== reactor.id) return;
                            if (r.emoji.name === '✅') {
                                ConfirmReactionCollector.stop()
                                if (!checkInServer()) {
                                    responseEmbedMessage.delete();
                                    await m.reactions.removeAll();
                                    await m.react('🚫');
                                    return;
                                }
                                await dms.send(response)
                                responseEmbedMessage.delete()
                                embed.addFields([{name: `Response by ${reactor.nickname}:`, value: response}])
                                m.edit({ embeds: [embed] })
                                await m.reactions.removeAll()
                                await m.react('📫')
                            } else if (r.emoji.name === '❌') {
                                ConfirmReactionCollector.stop()
                                await responseEmbedMessage.delete()
                                await m.reactions.removeAll()
                                await m.react('🔑')
                            } else return;
                        })
                    })
                    break;
                case '👀':
                    let eyesEmbed = new Discord.EmbedBuilder()
                        .setDescription(`Your [message](${modMailMessage.url}) has been recieved and read`)
                    await m.reactions.removeAll()
                    if (checkInServer()) {
                        await dms.send({ embeds: [eyesEmbed] })
                        await m.react('👀')
                    } else
                        await m.react('🚫');
                    break;
                case '🗑️':
                    await m.reactions.removeAll()
                    await m.react('🗑️')
                    break;
                case '❌':
                    await m.delete()
                    return;
                case '🔨':
                    db.query(`INSERT INTO modmailblacklist (id) VALUES ('${raider.id}')`)
                    await m.reactions.removeAll()
                    await m.react('🔨')
                    break;
                case '🔒':
                    await m.reactions.removeAll()
                    await m.react('🔑')
                    break;
            }
            if (m.guild.id == '343704644712923138' && r.emoji.id == '752368122551337061') {
                await m.reactions.removeAll()
                await m.react('752368122551337061')
                let botReco = bot.guilds.cache.get('343704644712923138').channels.cache.get('746634644644167680')
                if (botReco) {
                    let embed = new Discord.EmbedBuilder()
                    let oldEmbed = m.embeds[0]
                    embed.setColor('#ff0000')
                    embed.setDescription(oldEmbed.description)
                    let me = await botReco.send({ embeds: [embed] })
                    await me.react('👍')
                    await me.react('👎')
                }
            }
        })
        await m.reactions.removeAll()
        if (!collected) await m.react('📧')
        if (!collected) await m.react('👀')
        if (!collected) await m.react('🗑️')
        if (!collected) await m.react('❌')
        if (!collected) await m.react('🔨')
        if (!collected) await m.react('752368122551337061')//temp, remove later
        if (!collected) await m.react('🔒')
    },
    async sendInfo(message) {
        let embed = new Discord.EmbedBuilder()
            .setTitle(`Mod Mail`)
            .setColor(`#0000ff`)
            .setDescription(`**DM me (the bot) to send feedback directly to the mod team!**\n\nI am here to pass along any questions, comments, or concerns you may have about anything in the server directly to the mod team (Security+)\n\n*Any feedback on RL's is not visible by RL's*\n*Rules found in #rules still apply in modmail. Breaking them may result in being banned from the server or being blacklisted from sending further modmail*`)
        message.guild.channels.cache.get(message.client.settings[message.guild.id].channels.modmailinfo).send({ embeds: [embed] })
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
const choiceFilter = (r, u) => !u.bot && (r.emoji.name === '📧' || r.emoji.name === '👀' || r.emoji.name === '🗑️' || r.emoji.name === '❌' || r.emoji.name === '🔨' || r.emoji.name === '🔒' /*temp, remove later*/ || r.emoji.id === '752368122551337061')
const ConfirmationFilter = (r, u) => !u.bot && (r.emoji.name === '❌' || r.emoji.name === '✅')