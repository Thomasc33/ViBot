const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const keypops = require('../data/keypop.json')
const keyRoles = require('./keyRoles')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'pop',
    description: 'Logs key pops',
    args: '<keytype> <user> (count)',
    getNotes(guildid, u) {
        return keypops[guildid] ? Object.keys(keypops[guildid]).toString() : `not setup for guild ${guildid}`
    },
    requiredArgs: 2,
    role: 'eventrl',
    args: [
        slashArg(SlashArgType.String, 'keytype', {
            description: "The type of key to pop"
        }),
        slashArg(SlashArgType.User, 'user', {
            description: "The key popper"
        }),
        slashArg(SlashArgType.Number, 'count', {
            required: false,
            description: "The number of keys to add (default 1)"
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        //Initialize
        let settings = bot.settings[message.guild.id]
        var count = 1
        let moddedKey = false
        if (args.length < 1) return;
        if (args.length > 2) count = parseInt(args[2])
        if (count == NaN || !count) count = 1
        var user = message.mentions.members.first()
        if (!user) user = message.guild.members.cache.get(args[1])
        if (!user) user = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
        if (!user) return message.reply('User not found')

        //Validate Command Arguments
        if (!keypops[message.guild.id]) return message.reply('Key information missing for this guild')
        let keyInfo = findKey(message.guild.id, args[0].toLowerCase())
        if (!keyInfo) return message.reply(`\`${args[0]}\` not recognized`)

        //Create Discord Embed Confirmation
        let collector = new Discord.MessageCollector(message.channel, { filter: m => m.author.id === message.author.id, time: 20000 });
        let confirmEmbed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setDescription(`Are you sure you want to log \`\`${count}\`\` **${keyInfo.name}** pops for ${user.nickname}?\n\nPlease select which key.`)
        const buttons = new Discord.ActionRowBuilder()
                                .addComponents(
                                    new Discord.ButtonBuilder()
                                        .setCustomId('Regular Key')
                                        .setLabel('Regular Key')
                                        .setStyle(Discord.ButtonStyle.Primary),
                                    new Discord.ButtonBuilder()
                                        .setCustomId('Modded Key')
                                        .setLabel('Modded Key')
                                        .setStyle(Discord.ButtonStyle.Primary),
                                    new Discord.ButtonBuilder()
                                            .setCustomId('Cancelled')
                                            .setLabel('❌ Cancel')
                                            .setStyle(Discord.ButtonStyle.Danger)
                                );
        await message.reply({ embeds: [confirmEmbed], components: [ buttons ], ephemeral: true }).then(async (confirmMessage) => {
            const buttonCollector = confirmMessage.createMessageComponentCollector()
            const choice = await new Promise((resolve, reject) => {
                const author_id = message.author.id
                let resolved;
                buttonCollector.on('collect', async interaction => {
                    if (!(author_id ? interaction.user.id == author_id : true)) return;
                    resolved = true;
                    buttonCollector.stop();
                    resolve(interaction.customId);
                });
                buttonCollector.on('end', () => {
                    const err = 'Timed out.';
                    err.stackTrace = new Error().stack;
                    if (!resolved) reject(err);
                });
            })

            if (!choice || choice == 'Cancelled')
                return confirmMessage.delete()
            else if (choice == 'Regular Key') {

            }else if (choice == 'Modded Key') {
                moddedKey = true
            }
            
            //Execute Database Query
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
                db.query(`UPDATE users SET ${keyInfo.schema} = ${keyInfo.schema } + ${count} WHERE id = '${user.id}'`, (err, rows) => {
                    keyRoles.checkUser(user, bot, db);
                });
                if (moddedKey) db.query(`UPDATE users SET moddedPops = moddedPops + ${count} WHERE id = '${user.id}'`, (err, rows) => {
                    keyRoles.checkUser(user, bot, db);
                });
                let embed = new Discord.EmbedBuilder()
                    .setColor('#0000ff')
                    .setTitle(`Key logged!`)
                    .setDescription(`${user} now has \`\`${parseInt(rows[0][keyInfo.schema]) + parseInt(count)}\`\` ${keyInfo.name} pops`)
                message.channel.send({ embeds: [embed] })
            })
            
            //Add Points to Database
            if (settings.backend.points && keyInfo.points) {
                let points = settings.points[keyInfo.points] * count
                if (user.roles.cache.hasAny(...settings.lists.perkRoles.map(role => settings.roles[role]))) points = points * settings.points.nitromultiplier
                if (moddedKey) points = points * settings.points.keymultiplier
                db.query(`UPDATE users SET points = points + ${points} WHERE id = '${user.id}'`)
            }

            //Delete Confirmation Message
            return confirmMessage.delete()
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
