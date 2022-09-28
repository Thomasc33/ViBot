const Discord = require('discord.js')
module.exports = {
    name: 'manualverify',
    description: 'Manually verifies a user',
    role: 'security',
    roleOverride: { '343704644712923138': 'officer' },
    alias: ['mv'],
    requiredArgs: 2,
    args: '<id/mention> <ign>',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        const sbvRole = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const raiderRole = message.guild.roles.cache.get(settings.roles.raider)
        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) return message.channel.send("User not found")
        if (member.roles.cache.has(suspendedRole.id) || member.roles.cache.has(sbvRole.id)) return message.channel.send("User is suspended")
        if (member.roles.cache.has(raiderRole.id)) return message.channel.send('User is already verified')
        if (member.roles.cache.has(settings.roles.eventraider)) await member.roles.remove(settings.roles.eventraider)
        await member.roles.add(raiderRole)
        if (settings.backend.giveeventroleonverification) await member.roles.add(settings.roles.eventraider)
        let tag = member.user.tag.substring(0, member.user.tag.length - 5)
        let nick = ''
        if (tag == args[1]) {
            nick = args[1].toLowerCase()
            if (tag == nick) {
                nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
            }
        } else nick = args[1]
        await member.setNickname(nick)
        let embed = new Discord.EmbedBuilder()
            .setTitle('Manual Verify')
            .setDescription(member.toString())
            .addFields([{name: 'User', value: member.displayName, inline: true}])
            .addFields([{name: 'Verified By', value: `<@!${message.author.id}>`, inline: true}])
            .setTimestamp(Date.now());
        message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
        let confirmEmbed = new Discord.EmbedBuilder().setDescription(`${member} has been given ${raiderRole}`)
        message.channel.send({ embeds: [confirmEmbed] })

        member.user.send(`You have been verified on \`${message.guild.name}\`. Please head over to rules, faq, and raiding-rules channels to familiarize yourself with the server. Happy raiding`)

        db.query(`SELECT * FROM veriblacklist WHERE id = '${member.id}' OR id = '${nick}'`, async (err, rows) => {
            if (!rows || !rows.length)
                return;

            const expelEmbed = new Discord.EmbedBuilder()
                .setTitle('Automatic Expel Removal')
                .setDescription(`The follow expels have been removed from the database tied to ${member}. If these should stick, please react with ❌ in the next 10 seconds.`)
                .setColor('#E0B0FF');

            for (const row of rows) {
                expelEmbed.addFields([{name: `${row.id}`, value: `Expelled by <@${row.modid}> in ${bot.guilds.cache.get(row.guildid).name || row.guildid}:\`\`\`${row.reason}\`\`\``}]);
            }

            const expelMessage = await message.channel.send({ embeds: [expelEmbed] });
            expelMessage.react('❌');
            expelMessage.collector = expelMessage.createReactionCollector({ filter: (r, u) => u.id == message.author.id && r.emoji.name == '❌', time: 10000 });
            expelMessage.collector.on('collect', (r, u) => {
                expelMessage.collector.stop();
            })
            expelMessage.collector.on('end', (collected, reason) => {
                if (collected.size == 0) {
                    expelEmbed.setDescription(`The follow expels have been removed from the database tied to ${member}.`);
                    db.query(`DELETE FROM veriblacklist WHERE id = '${member.id}' OR id = '${nick}'`);
                    expelMessage.reactions.removeAll();
                    expelMessage.react('✅');
                } else {
                    expelEmbed.setDescription(`The following expels for ${member} have not been removed.`);
                }
                expelMessage.edit({ embeds: [expelEmbed] });
            })
        })
    }
}