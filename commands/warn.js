const Discord = require('discord.js')

module.exports = {
    name: 'warn',
    role: 'almostrl',
    description: 'Warns a user for a given reason',
    args: '<user> <reason>',
    requiredArgs: 1,
    async execute(message, args, bot, db) {
        if (args.length < 2) return;
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('Member not found. Please try again')
        let reason = ''
        for (let i = 1; i < args.length; i++) reason = reason.concat(` ${args[i]}`)
        if (reason == '') return message.channel.send('Please provide a reason')
        db.query(`INSERT INTO warns VALUES ('${member.user.id}', '${message.author.id}', '${reason}')`, (err, rows) => {
            let warnEmbed = new Discord.MessageEmbed()
                .setColor('#ff0000')
                .setTitle(`Warning Issued on the Server: ${message.guild.name}`)
                .setDescription(`__Moderator:__ <@!${message.author.id}> (${message.member.nickname})\n__Reason:__ ${reason}`)
            member.send(warnEmbed)
            db.query(`SELECT * FROM warns WHERE id = '${member.user.id}'`, (err, rows) => {
                message.channel.send(`${member.nickname} warned successfully. This is their \`${parseInt(rows.length) + 1}\` warning`)
            })
        })
    }
}