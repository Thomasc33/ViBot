const Discord = require('discord.js');

module.exports = {
    name: 'warn',
    role: 'eventrl',
    description: 'Warns a user for a given reason',
    alias: ['swarn'],
    args: '<user> <reason>',
    requiredArgs: 1,
    getNotes(guildid, member) {
        return 'Using swarn will silently warn, not sending the user a message.'
    },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        const silent = message.content[1].toLowerCase() == 's';
        if (args.length < 2) return;
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('Member not found. Please try again')

        //check if person being warned is staff
        if (bot.settings[message.guild.id].backend.onlyUpperStaffWarnStaff) {
            let lowest_staff_role = bot.settings[message.guild.id].roles["lol"];
            if (lowest_staff_role) {
                if (member.roles.highest.comparePositionTo(lowest_staff_role) >= 0) {
                    //the warn should only happen if message.member is like an admin or something
                    let warningRoles = settings.lists.warningRoles.length ? settings.lists.warningRoles : ['moderator', 'headrl', 'headeventrl', 'officer', 'developer']
                    let warningIds = warningRoles.map(m => settings.roles[m])
                    if (!message.member.roles.cache.filter(role => warningIds.includes(role.id)).size) return message.channel.send("Could not warn that user as they are staff and your highest role isn't high enough. Ask for a promotion and then try again.");
                }
            }
        }
        let reason = ''
        for (let i = 1; i < args.length; i++) reason = reason.concat(` ${args[i]}`)
        if (reason == '') return message.channel.send('Please provide a reason')
        let errored = false
        try {
            await db.promise().query(`INSERT INTO warns (id, modid, reason, time, guildid, silent) VALUES ('${member.user.id}', '${message.author.id}', ${db.escape(reason)}, '${Date.now()}', '${member.guild.id}', ${silent ? 1 : 0})`);
            let warnEmbed = new Discord.EmbedBuilder()
                .setColor('#ff0000')
                .setTitle(`Warning Issued on the Server: ${message.guild.name}`)
                .setDescription(`__Moderator:__ <@!${message.author.id}> (${message.member.nickname})\n__Reason:__ ${reason}`)
            if (!silent)
                member.send({ embeds: [warnEmbed] })
        } catch (err) {
            message.channel.send(`There was an error: ${err}`);
            errored = true
        }
        if (!errored) setTimeout(() => {
            db.query(`SELECT * FROM warns WHERE id = '${member.user.id}'`, (err, rowsForAllWarnings) => {
                db.query(`SELECT * FROM warns WHERE id = '${member.user.id}' and (guildid = '${message.guild.id}' OR guildid is null)`, (err, rowsForWarningsCurrentServer) => {
                    message.channel.send(`${member.nickname}${silent ? ' silently' : ''} warned successfully. This is their \`${rowsForWarningsCurrentServer.length}\` warning for this server. And has a total of \`${rowsForAllWarnings.length}\` warnings`)
                })
            })
        }, 500)
    }
}
