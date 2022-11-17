const Discord = require('discord.js')

module.exports = {
    name: 'removealt',
    description: 'Removes an alt from a user',
    args: '<user> (reason)',
    requiredArgs: 1,
    role: 'security',
    alias: ['ra'],
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send(`\`${args[0]}\` not found`)

        let names = member.nickname.replace(/[^a-z|]/gi, '').split('|')

        if (names.length <= 1) return message.channel.send(`${member} does not have any alts`)

        let embed = new Discord.EmbedBuilder()
            .setTitle('Select an alt to remove')
            .setColor('#ff0000')
            .setDescription('None!')
        for (let i = 1; i < names.length; i++) {
            if (embed.data.description == 'None!') embed.data.description = `${names[i]}`
            else embed.data.description += `\n${names[i]}`
        }
        await message.channel.send({ embeds: [embed] }).then(async confirmMessage => {
            authorName = names.shift();
            const choice = await confirmMessage.confirmList(names, message.author.id)
            if (!choice || choice == 'Cancelled') {
                await message.react('✅');
                return confirmMessage.delete();
            }
            if (choice) {
                await message.react('✅')
                let newname = ''
                let prefix = member.nickname.charAt(0)
                if (prefix.replace(/[a-z0-9]/gi, '') != '') newname = prefix
                for (let i in names) {
                    if (choice.toLowerCase() != names[i].toLowerCase()) {
                        if (i == 0) newname += `${authorName} | ${names[i]}`
                        else newname += ` | ${names[i]}`
                        continue;
                    }
                    if (i == 0) newname += `${authorName}`
                }
                await member.setNickname(newname, `Old Name: ${member.nickname}\nNew Name: ${newname}\nChange by: ${message.member}`);
                db.query(`INSERT INTO veriblacklist (id, modid, guildid, reason) VALUES ('${choice}', '${message.author.id}', '${message.guild.id}', 'Alt account removed from user.')`)
                let embed = new Discord.EmbedBuilder()
                    .setTitle('Alt Removed')
                    .setColor('#fefefe')
                    .setDescription(member.toString())
                    .addFields([{ name: 'Main', value: authorName, inline: true }])
                    .addFields([{ name: 'Alt Removed', value: choice, inline: true }])
                    .addFields([{ name: 'Removed By', value: `<@!${message.author.id}> `, inline: false }])
                    .setTimestamp(Date.now());
                let reason = ''
                for (let i = 1; i < args.length; i++) reason += args[i] + " "
                if (reason != '')
                    if (reason.length > 1024) {
                        embed.addFields([{ name: 'Reason 1', value: reason.substring(0, 1024) }])
                        embed.addFields([{ name: 'Reason Cont', value: reason.substring(1024, reason.length) }])
                    } else embed.addFields([{ name: 'Reason', value: reason }])
                await message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
            }
            confirmMessage.delete();
        })
    }
}