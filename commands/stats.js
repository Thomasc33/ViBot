const Discord = require('discord.js');
const botSettings = require('../settings.json');
const ErrorLogger = require('../lib/logError');
const keyRoles = require('../data/keyRoles.json');
const statsTemplate = require('../data/stats.json');
const { getDB, guildSchema } = require('../dbSetup.js');
const { iterServers } = require('../jobs/util.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js');

module.exports = {
    name: 'stats',
    description: 'Gives users stats',
    args: '(user)',
    role: 'raider',
    noGuildChoice: true,
    userCommand: true,
    //dms: true,
    args: [
        slashArg(SlashArgType.User, 'user', {
            required: false,
            description: "The user whose stats you'd like to view"
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        var member;
        if (args.length == 0) member = message.member
        if (message.channel.type == Discord.ChannelType.DM) member = message.author
        if (!member) member = message.guild.findMember(args.join(''))
        if (!member) return message.reply('Could not find a member.')
        const storedEmojis = bot.storedEmojis

        const embed = new Discord.EmbedBuilder()
            .setColor('#015c21')
            .setDescription(`__**Stats for**__ ${member} ${member ? '\`' + (member.nickname || member.tag) + '\`' : ''}\n\nHold on... Processing`)
        var statsMessage = await message.reply({ embeds: [embed] })
        for (template in statsTemplate) {
            template = statsTemplate[template]
            const db = getDB(template.id)
            let rows = {}
            const schema = guildSchema(template.id)
            if (db) {
                var [userRows,] = await db.promise().query('SELECT * FROM users WHERE id = ?', [member.id])
                if (userRows.length == 0) { await db.promise().query(`INSERT INTO users (id) VALUES (${member.id})`); [userRows,] = await db.promise().query('SELECT * FROM users WHERE id = ?', [member.id]) }
                rows[schema] = userRows
            }
            if (!rows.hasOwnProperty(schema)) { continue; }
            const databaseRow = rows[schema][0]
            embed.addFields({ name: `${storedEmojis[template.emoji].text} ${template.name} ${storedEmojis[template.emoji].text}`, value: `** **`, inline: false })
            template.values.map(value => {
                embed.addFields({
                    name: `${storedEmojis[value.emoji].text} __${value.name}__ ${storedEmojis[value.emoji].text}`,
                    value: `${value.values.map(row => `${storedEmojis[row.emoji].text} \`${row.multiply ? Math.floor(databaseRow[row.row] * row.multiply) : databaseRow[row.row]}\`${row.name ? ` ${row.name}` : ``}`).join('\n')}`,
                    inline: true
                })
            })
        }
        embed.setDescription(`__**Stats for**__ ${member} ${member ? '\`' + (member.nickname || member.tag) + '\`' : ''}`)
        await statsMessage.edit({ embeds: [embed] })
    }
}