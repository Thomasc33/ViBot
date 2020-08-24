const fs = module.require('fs')
const Discord = require('discord.js')
const ErrorLogger = require('../logError')
const permaSuspend = require('./permaSuspend')

module.exports = {
    name: 'unsuspend',
    description: 'Manually unsuspends user',
    args: '<ign> (reason)',
    requiredArgs: 1,
    role: 'rl',
    execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var raider = args.shift();
        var reason = '';
        for (i = 0; i < args.length; i++) reason = reason.concat(args[i]) + ' ';

        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(raider)
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(raider.toLowerCase()));
        if (!member) member = message.guild.members.cache.get(u.replace(/[<>@!]/gi, ''))
        if (!member) return message.channel.send('I could not find ' + raider)
        if (reason == '') reason = 'None'
        if (!member) return message.channel.send("User not found, please try again");
        if (member.roles.cache.has(settings.roles.permasuspended)) return unPerma()
        if (!member.roles.cache.has(settings.roles.tempsuspended)) return message.channel.send("User is not suspended")

        db.query(`SELECT * FROM suspensions WHERE id = '${member.id}' AND suspended = true`, async (err, rows) => {
            if (err) ErrorLogger.log(err, bot)
            if (rows && rows.length == 0) {
                message.channel.send(`This user was not suspended by ${bot.user}. Would you still like to unsuspend them (removes suspended and gives raider role back)? Y/N`)
                let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
                collector.on('collect', m => {
                    try {
                        if (m.content.toLowerCase().charAt(0) == 'y') {
                            const suspendedRole = message.guild.roles.cache.get(settings.roles.tempsuspended);
                            const raiderRole = message.guild.roles.cache.get(settings.roles.raider);
                            member.roles.remove(suspendedRole)
                                .then(member.roles.add(raiderRole));
                            message.channel.send("User unsuspended successfully");
                        }
                    } catch (er) {
                        ErrorLogger.log(er, bot)
                    }
                });
            } else {
                const guildId = rows[0].guildid;
                const proofLogID = rows[0].logmessage;
                const rolesString = rows[0].roles;
                let roles = []
                const guild = bot.guilds.cache.get(guildId);
                const member = guild.members.cache.get(rows[0].id);
                rolesString.split(' ').forEach(r => { if (r != '') roles.push(r) })
                try {
                    await member.edit({
                        roles: roles
                    })
                    try {
                        let embed = bot.guilds.cache.get(guildId).channels.cache.get(settings.channels.suspendlog).messages.cache.get(proofLogID).embeds.shift();
                        embed.setColor('#00ff00')
                            .setDescription(embed.description.concat(`\nUnsuspended manually by <@!${message.author.id}>`))
                            .setFooter('Unsuspended at')
                            .setTimestamp(Date.now())
                            .addField('Reason for unsuspension', reason)
                        let messages = await bot.guilds.cache.get(guildId).channels.cache.get(settings.channels.suspendlog).messages.fetch({ limit: 100 })
                        messages.filter(m => m.id == proofLogID && m.author.id == bot.user.id).first().edit(embed)
                    }
                    catch (er) { bot.guilds.cache.get(guildId).channels.cache.get(settings.channels.suspendlog).send(`${member} has been unsuspended by ${message.member}`) }
                    db.query(`UPDATE suspensions SET suspended = 0 WHERE id = '${member.id}'`)
                    message.channel.send(`${member} has been unsuspended`)
                } catch (er) {
                    ErrorLogger.log(er, bot)
                }
            }
        })
        function unPerma() {
            if (member.roles.cache.highest.position < message.guild.roles.cache.get(settings.roles.security).position || message.author.id !== '277636691227836419') return
            db.query(`SELECT * FROM suspensions WHERE perma = true AND suspended = true AND id = '${member.id}'`, async (err, rows) => {
                if (rows.length == 0) {
                    let confirm = await message.channel.send(`I do not have any records of ${member} being perma suspended. Would you like to remove suspended, and add raider back?`)
                    confirm.react('✅')
                        .then(confirm.react('❌'))
                    let reactionCollector = new Discord.ReactionCollector(confirm, (r, u) => u.id = message.author.id && (r.emoji.name == '❌' || r.emoji.name == '✅'), { time: 60000 })
                    reactionCollector.on('end', (c, r) => { confirm.delete() })
                    reactionCollector.on('collect', (r, u) => {
                        reactionCollector.stop()
                        if (r.emoji.name == '✅') {
                            member.edit({ roles: [settings.roles.raider] })
                                .then(message.channel.send(`${member} has been unsuspended`))
                                .then(message.guild.channels.cache.get(settings.channels.suspendlog).send(`${member} unsuspended`))
                        }
                    })
                } else {
                    let rolesString = rows[0].roles;
                    let roles = []
                    rolesString.split(' ').forEach(r => { if (r != '') roles.push(r) })
                    message.guild.channels.cache.get(settings.channels.suspendlog).send(`${member} unsuspended`)
                    member.edit({ roles: roles })
                    db.query(`UPDATE suspensions SET suspended = false WHERE id = '${member.id}'`)
                    message.channel.send(`${member} has been unsuspended`)
                }
            })
        }
    }
}