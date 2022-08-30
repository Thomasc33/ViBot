const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')

module.exports = {
        name: 'expelled',
        alias: ['expel'],
        role: 'security',
        roleOverride: { '343704644712923138': 'officer' },
        args: '<list/remove> [names/ids] | <add> <name/id> [reason]',
        requiredArgs: 1,
        async execute(message, args, bot, db) {
            const action = args.shift()[0].toLowerCase();
            switch (action) {
                case 'l':
                    if (!args.length)
                        this.listAll(message, args, bot, db);
                    else
                        this.listUsers(message, args, bot, db);
                    break;
                case 'a':
                    this.addExpelled(message, args, bot, db);
                    break;
                case 'r':
                    this.removeExpelled(message, args, bot, db);
                    break;
                default:
                    return message.channel.send('Invalid arguments: `<add/remove/list> [names/ids]`');
            }
        },
        async listAll(message, args, bot, db) {
            db.query(`SELECT * FROM veriblacklist`, async(err, rows) => {
                if (err) ErrorLogger.log(err, bot)
                let embed = new Discord.MessageEmbed()
                    .setTitle(`Expelled / Veriblacklisted users`)
                    .setDescription('None!')
                for (let i in rows) {
                    fitStringIntoEmbed(embed, `${rows[i].id}`, message.channel, ', ')
                }
                message.channel.send({ embeds: [embed] })
            });
        },
        async listUsers(message, args, bot, db) {
            db.query(`SELECT * FROM veriblacklist WHERE id IN (${args.map(a => `'${a}'`).join(', ')})`, async(err, rows) => {
            if (err) ErrorLogger.log(err, bot);
            let embed = new Discord.MessageEmbed()
                .setTitle(`Expelled / Veriblacklisted users`)
                .setDescription('None!');

            for (const row of rows)
            {
                const guild = bot.guilds.cache.get(row.guildid);
                fitStringIntoEmbed(embed, `\`${row.id}\` by <@!${row.modid}> in **${guild ? guild.name : row.guildid}**: ${ row.reason || 'No reason provided.' }`, message.channel, '\n');
            }
            message.channel.send({ embeds: [embed] });
        })
    },
    async addExpelled(message, args, bot, db) {
        if (!args.length) return message.channel.send(`Please specify a user`)
        const id = args.shift();
        db.query(`INSERT INTO veriblacklist (id, modid, guildid, reason) VALUES (${db.escape(id)}, '${message.author.id}', '${message.guild.id}', ${db.escape(args.join(' ') || 'No reason provided.')})`, (err) => {
            if (err)
            {
                ErrorLogger.log(err, bot);
                message.channel.send(`Error adding \`${id}\` to the blacklist: ${err.message}`);
            } else 
                message.react('✅');
        });
    },
    async removeExpelled(message, args, bot, db) {
        if (!args.length) return message.channel.send(`Please specify a user`)
        for (let i in args) {
            db.query(`SELECT * FROM veriblacklist WHERE id = '${args[i]}'`, (err, rows) => {
                if (rows.length == 0) message.channel.send(`${args[i]} is not blacklisted`)
                else db.query(`DELETE FROM veriblacklist WHERE id = '${args[i]}'`)
            })
        }
        message.react('✅')
    }
}

function fitStringIntoEmbed(embed, string, channel, join) {
    if (embed.description == 'None!') {
        embed.setDescription(string)
    } else if (embed.description.length + `${join}${string}`.length >= 2048) {
        if (embed.fields.length == 0) {
            embed.addField('-', string)
        } else if (embed.fields[embed.fields.length - 1].value.length + `${join}${string}`.length >= 1024) {
            if (embed.length + `${join}${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.addField('-', string)
            }
        } else {
            if (embed.length + `${join}${string}`.length >= 6000) {
                channel.send({ embeds: [embed] })
                embed.setDescription('None!')
                embed.fields = []
            } else {
                embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`${join}${string}`)
            }
        }
    } else {
        embed.setDescription(embed.description.concat(`${join}${string}`))
    }
}