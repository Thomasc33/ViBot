const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const keypops = require('../data/keypop.json')
const keyRoles = require('./keyRoles')

module.exports = {
    name: 'pop',
    description: 'Logs key pops',
    args: '<keytype> <user> (count)',
    getNotes(guildid, u) {
        return keypops[guildid] ? Object.keys(keypops[guildid]).toString() : `not setup for guild ${guildid}`
    },
    requiredArgs: 2,
    role: 'eventrl',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let nitro = (settings.perkRoles.nitro || settings.perkRoles.supporter || settings.perkRoles.tip)
        var count = 1
        let moddedKey = false
        if (args.length < 1) return;
        if (args.length > 2) count = parseInt(args[2])
        if (count == NaN || !count) count = 1
        var user = message.mentions.members.first()
        if (!user) user = message.guild.members.cache.get(args[1])
        if (!user) user = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
        if (!user) return message.channel.send('User not found')

        if (!keypops[message.guild.id]) return message.channel.send('Key information missing for this guild')
        let keyInfo = findKey(message.guild.id, args[0].toLowerCase())
        if (!keyInfo) return message.channel.send(`\`${args[0]}\` not recognized`)

        let collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id, time: 20000 });
        let confirmEmbed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`Are you sure you want to log \`\`${count}\`\` **${keyInfo.name}** pops for ${user.nickname}?\n\nRespond with __**Y**__es for a **Normal Key.**${keyInfo.modded ? '\nRespond with __**M**__od for a **Modified key.**' : ''}\nRespond with __**N**__o to **Cancel.**`)
        let confirmMessage = await message.channel.send({ embeds: [confirmEmbed] })
        collector.on('collect', async m => {
            if (m.content.charAt(0).toLowerCase() == 'y' || m.content.charAt(0).toLowerCase() == 'm') {
                collector.stop()
                if (m.content.charAt(0).toLowerCase() == 'm') moddedKey = true
                if (keyInfo.modded == false) moddedKey = false
                db.query(`SELECT * FROM users WHERE id = '${user.id}'`, async(err, rows) => {
                    if (err) ErrorLogger.log(err, bot)
                    if (rows.length == 0) {
                        const success = await new Promise((res) => {
                            db.query(`INSERT INTO users (id) VALUES ('${user.id}')`, (err, rows) => {
                                if (err || !rows || rows.length == 0) {
                                    message.channel.send({
                                        embeds: [
                                            new Discord.EmbedBuilder().setDescription(`Unable to add <@!${user.id}> to the database.`).addFields([{name: `Error`, value: `${err || "Unknown reason"}`}])
                                        ]
                                    });
                                    res(false);
                                } else res(true);
                            });
                        })
                        if (!success) return;
                    }
                    db.query(`UPDATE users SET ${keyInfo.schema} = ${keyInfo.schema} + ${count} WHERE id = '${user.id}'`, (err, rows) => {
                        keyRoles.checkUser(user, bot, db);
                    });
                    if (moddedKey) db.query(`UPDATE users SET moddedPops = moddedPops + ${count} WHERE id = '${user.id}'`, (err, rows) => {
                        keyRoles.checkUser(user, bot, db);
                    });
                    let embed = new Discord.EmbedBuilder()
                        .setColor('#0000ff')
                        .setTitle(`Key has been logged.`)
                        .setDescription(`${user} now has \`\`${parseInt(rows[0][keyInfo.schema]) + parseInt(count)}\`\` Pops`)
                    message.channel.send({ embeds: [embed] })
                })
                if (settings.backend.points && keyInfo.points) {
                    let points = settings.points[keyInfo.points] * count
                    if (user.roles.cache.has(nitro)) points = points * settings.points.nitromultiplier
                    if (moddedKey) points = points * settings.points.keymultiplier
                    db.query(`UPDATE users SET points = points + ${points} WHERE id = '${user.id}'`)
                }
                await confirmMessage.delete()
                await m.delete()
                message.react('✅')
            } else if (m.content.charAt(0).toLowerCase() == 'n') {
                collector.stop()
                await confirmMessage.delete()
                await m.delete()
                let em = new Discord.EmbedBuilder().setColor('DARK_RED').setDescription('Key Log Cancelled.')
                return message.channel.send({ embeds: [em] })
            } else {
                let em = new Discord.EmbedBuilder().setColor('DARK_RED').setDescription('Response not recognized. Try again (Y/N)')
                let emm = await message.channel.send({ embeds: [em] })
                m.delete()
                setTimeout(() => { emm.delete() }, 5000)
            }
        })
    }
}

function findKey(guildid, key) {
    let info = keypops[guildid]
    if (Object.keys(info).includes(key)) return info[key]
    for (let i in info)
        if (info[i].alias.includes(key)) return info[i]
    return null
}