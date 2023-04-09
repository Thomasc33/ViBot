const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
        name: 'expelled',
        alias: ['expel'],
        role: 'security',
        roleOverride: { '343704644712923138': 'security' },
        description: 'Remove or list expels',
        requiredArgs: 1,
        varargs: true,
        args: [
            slashArg(SlashArgType.Subcommand, 'list', {
                description: "List expels",
                options: [
                    slashArg(SlashArgType.String, 'id', {
                        required: false,
                        description: "The id/name of the user whose expels you want to view"
                    })
                ]
            }),
            slashArg(SlashArgType.Subcommand, 'remove', {
                description: "Removes expels",
                options: [
                    slashArg(SlashArgType.String, 'id', {
                        description: "The id/name of the user whose expels you want to remove"
                    })
                ]
            }),
            slashArg(SlashArgType.Subcommand, 'add', {
                description: "Adds expels",
                options: [
                    slashArg(SlashArgType.String, 'id', {
                        description: "The id/name of the user who you'd like to expel"
                    }),
                    slashArg(SlashArgType.String, 'reason', {
                        description: "The reason for adding the expel"
                    })
                ]
            })
        ],
        getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
        async execute(message, args, bot, db) {
            const action = message.options.getSubcommand();
            switch (action) {
                case 'list':
                    if (!message.options.getString('id'))
                        this.listAll(message, bot, db);
                    else
                        this.listUsers(message, bot, db);
                    break;
                case 'add':
                    this.addExpelled(message, bot, db);
                    break;
                case 'remove':
                    this.removeExpelled(message, bot, db);
                    break;
                default:
                    return message.replyUserError('Invalid arguments: `<add/remove/list> [names/ids]`');
            }
        },
        async listAll(message, bot, db) {
            db.query(`SELECT * FROM veriblacklist`, async(err, rows) => {
                if (err) ErrorLogger.log(err, bot, message.guild)
                let embed = new Discord.EmbedBuilder()
                    .setTitle(`Expelled / Veriblacklisted users`)
                    .setDescription('None!')
                for (let i in rows) {
                    fitStringIntoEmbed(embed, `${rows[i].id}`, message.channel, ', ')
                }
                message.reply({ embeds: [embed] })
            });
        },
        async listUsers(message, bot, db) {
            db.query(`SELECT * FROM veriblacklist WHERE id IN (${[message.options.getString('id'), ...message.options.getVarargs()].map(a => `'${a}'`).join(', ')})`, async(err, rows) => {
            if (err) ErrorLogger.log(err, bot, message.guild);
            let embed = new Discord.EmbedBuilder()
                .setTitle(`Expelled / Veriblacklisted users`)
                .setDescription('None!');

            for (const row of rows)
            {
                const guild = bot.guilds.cache.get(row.guildid);
                fitStringIntoEmbed(embed, `\`${row.id}\` by <@!${row.modid}> in **${guild ? guild.name : row.guildid}**: ${ row.reason || 'No reason provided.' }`, message.channel, '\n');
            }
            message.reply({ embeds: [embed] });
        })
    },
    async addExpelled(message, bot, db) {
        const id = message.options.getString('id');
        db.query(`INSERT INTO veriblacklist (id, modid, guildid, reason) VALUES (${db.escape(id)}, '${message.author.id}', '${message.guild.id}', ${db.escape([message.options.getString('reason'), ...message.options.getVarargs()].join(' ') || 'No reason provided.')})`, (err) => {
            if (err)
            {
                ErrorLogger.log(err, bot, message.guild);
                message.replyInternalError(`Error adding \`${id}\` to the blacklist: ${err.message}`);
            } else 
                message.replySuccess(`${id} has been blacklisted!`);
        });
    },
    async removeExpelled(message, bot, db) {
        [message.options.getString('id'), ...message.options.getVarargs()].forEach((arg) => {
            db.query(`SELECT * FROM veriblacklist WHERE id = '${arg}'`, (err, rows) => {
                if (rows.length == 0) message.replyUserError(`${arg} is not blacklisted`)
                else db.query(`DELETE FROM veriblacklist WHERE id = '${arg}'`)
            })
        })
        message.replySuccess('Done!')
    }
}

function fitStringIntoEmbed(embed, string, channel, join) {
    if (embed.data.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.data.description.length + `${join}${string}`.length >= 2048) {
        if (!embed.data.fields) {
            embed.addFields({ name: '-', value: string })
        } else if (embed.data.fields[embed.data.fields.length - 1].value.length + `${join}${string}`.length >= 1024) {
            if (JSON.stringify(embed.toJSON()).length + `${join}${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.addFields({ name: '-', value: string })
            }
        } else {
            if (JSON.stringify(embed.toJSON()).length + `${join}${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.data.fields = []
            } else {
                embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`${join}${string}`)
            }
        }
    } else {
        embed.setDescription(embed.data.description.concat(`${join}${string}`))
    }
}
