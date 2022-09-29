const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const moment = require('moment');
module.exports = {
    name: 'suspends',
    description: 'Shows all suspends that the bot is currently tracking',
    role: 'warden',
    args: '<user>',
    alias: ['suspensions'],
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (args.length > 0) {
            let member = message.mentions.members.first()
            if (!member) member = message.guild.members.cache.get(args[0])
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
            if (!member) return message.channel.send('User not found');

            let search = '';
            if (message.member.roles.highest.position < message.guild.roles.cache.get(settings.roles.security).position)
                search = ` AND guildid = '${message.guild.id}' AND (suspended = 1 OR perma = 1) ORDER BY uTime DESC LIMIT 0, 1`;
            db.query(`SELECT * FROM suspensions WHERE id = '${member.id}'${search}`, async (err, rows) => {
                if (!rows || rows.length == 0) return message.channel.send('User has no suspends logged under me')
                if (err) ErrorLogger.log(err, bot)
                let embed = new Discord.EmbedBuilder()
                    .setDescription('None!')
                let i = 0;
                for (let suspension of rows) {
                    i++;
                    let string = `__Suspension ${i} case for ${member}__\`${member.nickname}\` in ${bot.guilds.cache.get(suspension.guildid).name}\nReason: \`${suspension.reason.trim()}\`\nSuspended by: <@!${suspension.modid}> ${suspension.suspended ? 'Ends' : 'Ended'} ${moment().to(new Date(parseInt(suspension.uTime)))}\n`;
                    fitStringIntoEmbed(embed, string, message.channel)
                }
                message.channel.send({ embeds: [embed] })
            })

        } else if (message.member.roles.has(settings.roles.developer)) {
            let embed = new Discord.EmbedBuilder()
                .setColor(message.guild.roles.cache.get(settings.roles.tempsuspended).hexColor)
                .setTitle('Current Logged Suspensions')
                .setDescription('None!')
            db.query(`SELECT * FROM suspensions WHERE suspended = true`, (err, rows) => {
                for (let i in rows) {
                    let sus = rows[i]
                    let guild = bot.guilds.cache.get(sus.guildid)
                    if (!guild) continue
                    let member = guild.members.cache.get(sus.id)
                    let desc = (`__Suspension case for ${member}__\`${member.nickname}\`\nReason: \`${sus.reason.trim()}\`\nSuspended by: <@!${sus.modid}>\n`)
                    fitStringIntoEmbed(embed, desc, message.channel)
                }
                message.channel.send({ embeds: [embed] })
            })
        }
    }
}

function fitStringIntoEmbed(embed, string, channel) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `\n${string}`.length >= 2048) {
        if (embed.data.fields.length == 0) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
            if (embed.data.length + `\n${string}`.length + 1 >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (embed.data.length + `\n${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`\n${string}`))
    }
}