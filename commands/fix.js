const ErrorLogger = require('../logError')
const Discord = require('discord.js')
module.exports = {
    name: 'fix',
    args: '<unlogged/dupes>',
    description: 'Fixes logging issues with bot',
    role: 'Moderator',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (args[0].toLowerCase() == 'unlogged') {
            let mes = await message.channel.send('Processing. This may take a minute')
            db.query('SELECT * FROM users', (err, rows) => {
                if (err) ErrorLogger.log(err, bot)
                let members = message.guild.members.cache.array();
                var embed = new Discord.MessageEmbed()
                    .setColor('#015c21')
                    .setTitle('Fixed')
                    .addField('No nickname, not in DB, has Verified Raider', 'None')
                    .addField('Has nickname, has Verified Raider, not in db', 'None')
                for (let i in members) {
                    let m = members[i]
                    if (!m.roles.cache.has(message.guild.roles.cache.find(r => r.name === settings.raider).id)) continue;
                    let found = false
                    for (let i in rows) {
                        if (rows[i].id == m.id) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        if (m.nickname == undefined) {
                            m.roles.remove(message.guild.roles.cache.find(r => r.name === settings.raider).id)
                            if (embed.fields[0].value == 'None') {
                                embed.fields[0].value = m
                            } else {
                                if (embed.fields[0].value.length + `\n${m}` > 1024) {
                                    message.channel.send(embed)
                                    embed.fields[1].value = ''
                                    embed.fields[0].value = ''
                                }
                                embed.fields[0].value += `\n${m}`
                            }
                        } else {
                            db.query(`INSERT INTO users (id) VALUES ('${m.id}')`)
                            if (embed.fields[1].value == 'None') {
                                embed.fields[1].value = m
                            } else {
                                if (embed.fields[1].length + `\n${m}` > 1024) {
                                    message.channel.send(embed)
                                    embed.fields[1].value = ''
                                    embed.fields[0].value = ''
                                }
                                embed.fields[1].value += `\n${m}`;

                            }
                        }
                    }
                }
                mes.delete()
                message.channel.send(embed)
            })
        } else if (args[0].toLowerCase() == 'dupes') {
            let memberArray = message.guild.members.cache.array()
            for (let i in memberArray) {
                let m = memberArray[i]
                db.query(`SELECT * FROM users WHERE id = '${m.id}'`, (err, rows) => {
                    if (rows == undefined) return;
                    if (rows.length > 1) {
                        db.query(`DELETE FROM users WHERE id = '${m.id}'`)
                        db.query(`INSERT INTO users VALUES ('${rows[0].id}', '${rows[0].ign}', ${rows[0].veriblacklisted}, ${rows[0].modmailblacklisted}, '${rows[0].muteLength}', '${rows[0].suspendLength}', '${rows[0].raiderRuns}', '${rows[0].eventRuns}', '${rows[0].shattersPop}', '${rows[0].eventPops}', '${rows[0].successRuns}', '${rows[0].failedRuns}', '${rows[0].assistedRuns}', '${rows[0].currentweek}', '${rows[0].currentweekfailed}', '${rows[0].currentweekassists}')`)
                    }
                })
            }
            message.channel.send('Done')
        }
    }
}