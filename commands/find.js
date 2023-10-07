const Discord = require('discord.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'find',
    description: 'Finds user from a nickname.',
    role: 'eventrl',
    varargs: true,
    args: [
        slashArg(SlashArgType.String, 'nickname', {
            description: 'The nickname you want to search'
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        if (args.length == 0) return
        const suspendedButVerifed = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const suspendedRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        let notFoundString = ''
        let expelled = [...args]
        const embeds = []
        // combines users into an array
        for (const u of args) {
            let member = message.guild.members.cache.get(u)
            if (!member) member = message.guild.members.cache.filter(user => user.nickname !== null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(u.toLowerCase()))
            if (member) {
                expelled.push(member.user.id)
                expelled.push(...(member.nickname || '').replace(/[^a-z|]/gi, '').split('|'))

                const nicks = member.nickname ? member.nickname.replace(/[^a-z|]/gi, '').split('|').map(n => `[**${n}**](https://www.realmeye.com/player/${n.replace(/ /g, '')})`).join(' • ') : null

                const embed = new Discord.EmbedBuilder()
                    .setColor('#00ff00')
                    .setDescription(`Search \`${u}\` matched \`${member.nickname || member.user.tag}\`: <@!${member.id}>${nicks ? '\n**IGNS** • ' + nicks : ''}`)
                    .addFields(
                        { name: 'Highest Role', value: `<@&${member.roles.highest.id}>`, inline: true },
                        { name: 'Suspended', value: '❌', inline: true },
                        { name: 'Voice Channel', value: 'Not Connected', inline: true })
                if (member.roles.cache.has(suspendedButVerifed.id)) {
                    embed.data.fields[1].value = `:white_check_mark: \n<@&${suspendedButVerifed.id}>`
                    embed.setColor('#ff0000')
                }
                if (suspendedRole && member.roles.cache.has(suspendedRole.id)) {
                    embed.data.fields[1].value = `:white_check_mark: \n<@&${suspendedRole.id}>`
                    embed.setColor('#ff0000')
                }
                if (member.voice.channel !== null) {
                    embed.data.fields[2].value = member.voice.channel.name
                }
                embeds.push(embed)
            } else {
                if (notFoundString == '') notFoundString = `${u}`
                else notFoundString = notFoundString.concat(`, ${u}`)
            }
        }
        if (notFoundString != '') {
            const embed = new Discord.EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('Users not found:')
                .setDescription(notFoundString)
            embeds.push(embed)
        }

        expelled = await checkBlackList([...new Set(expelled.map(e => e.toLowerCase()))], db)
        if (expelled.length > 0) {
            let expelledString = ''
            for (const i in expelled) {
                if (expelledString == '') expelledString = expelled[i]
                else expelledString += `, ${expelled[i]}`
            }
            const expelledEmbed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('The following users are expelled')
                .setDescription(expelledString)
            embeds.push(expelledEmbed)
        }
        message.reply({ embeds })
    }
}

async function checkBlackList(args, db) {
    const expelled = []
    const promises = []
    for (const i of args) {
        promises.push(new Promise(res => {
            db.query('SELECT * FROM veriblacklist WHERE id = ?', [i], (err, rows) => {
                if (rows && rows.length != 0) expelled.push(i)
                res()
            })
        }))
    }
    await Promise.all(promises)
    return expelled
}
