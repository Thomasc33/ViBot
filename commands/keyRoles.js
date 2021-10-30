const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const dbInfo = require('../data/database.json')
const botSettings = require('../settings.json')
const data = require('../data/keyRoles.json')
const guildSettings = require('../guildSettings.json');
require(`../lib/extensions`)

module.exports = {
    name: 'keyroles',
    description: 'Makes sure everyone that should have a key popper role does',
    role: 'security',
    args: 'None | <check> <user/all>',
    getNotes(guildid, member) {
        const moderator = member.guild.roles.cache.get(guildSettings[guildid].roles.moderator);
        return moderator && member.can(moderator) ? `Additional ${moderator} Arguments: \`<check reset>\`. Reset all key popper roles for the server and apply roles. This may take some time so be careful.` : ``;
    },
    execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        if (args.length == 0) {
            const popInfo = data[message.guild.id];
            console.log(popInfo);
            let keyCountEmbed = new Discord.MessageEmbed().setAuthor(`The ${message.guild.name} server has the following key roles configured:\n`).setDescription("").setColor('#ff0000')
            if (!popInfo || !popInfo.length) keyCountEmbed.description += `No key roles have been setup in this Discord server.`;
            else {
                let found = 0;
                for (const keyInfo of popInfo) {
                    if (!settings.roles[keyInfo.role]) continue;
                    keyCountEmbed.description += `<@&${settings.roles[keyInfo.role]}>: ${keyInfo.amount} ${keyInfo.types.map(t => t[1]).join(", ")}${keyInfo.types.length > 1?" Combined" : ""}\n`
                    found++
                }
                if (!found)
                    keyCountEmbed.description += `No key roles have been setup in this Discord server.`;
            }
            message.channel.send({ embeds: [keyCountEmbed] })
        } else {
            if (args[0].toLowerCase() == 'check') {
                if (args[1].toLowerCase() == 'all') {
                    this.checkAll(message.guild, bot, db)
                    message.react('✅')
                } else if (args[1].toLowerCase() == 'reset' && message.member.can(settings.roles.moderator)) {
                    this.rolesReset(message.guild, bot, db);
                    message.react('✅')
                } else {
                    let member = message.mentions.members.first()
                    if (!member) member = message.guild.members.cache.get(args[1])
                    if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
                    if (!member) return message.channel.send('User not found')
                    this.checkUser(member, bot, db)
                    message.react('✅')
                }
            } else {
                message.channel.send(`Check syntax and try again`)
            }
        }
    },
    async checkAll(guild, bot, db) {
        let settings = bot.settings[guild.id]
        let popInfo = data[guild.id]
        if (!settings || !popInfo) return;
        //map {{ types: [["arow", "A"], ["brow", "B"]], amount: 15}, { types: [["crow", "C"]], amount: 20 }} to "arow, brow, crow"
        const rows = popInfo.map(ki => ki.types.map(t => t[0]).join(", ")).join(", ");
        //map to "(apops + bpops >= 15) OR (cpops >= 20)"
        const wheres = popInfo.map(ki => `(${ki.types.map(t => t[0]).join(" + ")} >= ${ki.amount})`).join(" OR ");
        db.query(`SELECT id, ${rows} FROM users WHERE ${wheres}`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            for (let i in rows)
                checkRow(guild, bot, rows[i]);
        })
    },
    async rolesReset(guild, bot, db) {
        let settings = bot.settings[guild.id]
        let popInfo = data[guild.id]
        if (!settings || !popInfo) return

        const changes = {};
        //map {{ types: [["arow", "A"], ["brow", "B"]], amount: 15}, { types: [["crow", "C"]], amount: 20 }} to "arow, brow, crow"
        const rows = popInfo.map(ki => ki.types.map(t => t[0]).join(", ")).join(", ");
        //map to "(apops + bpops >= 15) OR (cpops >= 20)"
        const wheres = popInfo.map(ki => `(${ki.types.map(t => t[0]).join(" + ")} >= ${ki.amount})`).join(" OR ");
        db.query(`SELECT id, ${rows} FROM users WHERE ${wheres}`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            const dbmembers = {};
            rows.forEach(r => dbmembers[r.id] = r);
            guild.members.fetch().then(members => {
                for (const [id, member] of members) {
                    const toRemove = [],
                        toAdd = [];
                    if (!dbmembers[id])
                        dbmembers[id] = {};
                    for (const keyInfo of popInfo) {
                        if (!settings.roles[keyInfo.role]) continue;
                        let count = 0;
                        for (const [keyType, keyName] of keyInfo.types)
                            count += dbmembers[id][keyType] || 0;
                        if (count >= keyInfo.amount && !member.roles.cache.has(settings.roles[keyInfo.role]))
                            toAdd.push(settings.roles[keyInfo.role]);
                        else if (count < keyInfo.amount && member.roles.cache.has(settings.roles[keyInfo.role]))
                            toRemove.push(settings.roles[keyInfo.role]);
                    }
                    changes[id] = { add: [], remove: [] }
                    if (toRemove.length) {
                        member.roles.remove(toRemove);
                        changes[id].remove = toRemove;
                    }
                    if (toAdd.length) {
                        member.roles.add(toAdd);
                        changes[id].add = toAdd;
                    }
                    if (changes[id].add.length == 0 && changes[member.id].remove.length == 0)
                        delete changes[member.id];
                }

                console.log(changes);
            });
        })
    },
    async checkUser(member, bot, db) {
        const popInfo = data[member.guild.id];
        const settings = bot.settings[member.guild.id];
        if (!settings || !popInfo) return
        const rows = popInfo.map(ki => ki.types.map(t => t[0]).join(", ")).join(", ");
        db.query(`SELECT id, ${rows} FROM users WHERE id = '${member.id}'`, (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (!rows || !rows[0]) return db.query(`INSERT INTO users (id) VALUES ('${member.id}')`)
            checkRow(member.guild, bot, rows[0], member);
        })
    }
}

function checkRow(guild, bot, row, member) {
    return new Promise(async(res) => {
        const settings = bot.settings[guild.id];
        const popInfo = data[guild.id];
        member = member || await guild.members.fetch(row.id).catch(e => {});
        if (!settings || !popInfo || !member) return;
        const rolesToAdd = [];
        for (const keyInfo of popInfo) {
            if (!settings.roles[keyInfo.role]) continue;
            let count = 0;
            for (const [keyType, keyName] of keyInfo.types)
                count += row[keyType] || 0;
            if (count >= keyInfo.amount) {
                if (!member.roles.cache.has(settings.roles[keyInfo.role]))
                    rolesToAdd.push(settings.roles[keyInfo.role]);
            }
        }
        member.roles.add(rolesToAdd);
        res(rolesToAdd);
    })
}