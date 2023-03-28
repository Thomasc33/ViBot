const Discord = require('discord.js')
const { manualVerifyLog } = require('../commands/verification.js')
module.exports = {
    name: 'manualverify',
    description: 'Manually verifies a user',
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
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
        await message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
        let confirmEmbed = new Discord.EmbedBuilder().setDescription(`${member} has been given ${raiderRole}`)
        await message.channel.send({ embeds: [confirmEmbed] })
        await member.user.send(`You have been verified on \`${message.guild.name}\`. Please head over to rules, faq, and raiding-rules channels to familiarize yourself with the server. Happy raiding`)

        db.query(`SELECT * FROM veriblacklist WHERE id = '${member.id}' OR id = '${nick}'`, async (err, rows) => {
            if (!rows || !rows.length)
                return;

            const expelEmbed = new Discord.EmbedBuilder()
                .setTitle('Automatic Expel Removal')
                .setDescription(`The following expels will be removed from the database tied to ${member}. Are you sure you want to do this?`)
                .setColor('#E0B0FF');

            for (const row of rows) {
                expelEmbed.addFields([{name: `${row.id}`, value: `Expelled by <@${row.modid}> in ${bot.guilds.cache.get(row.guildid).name || row.guildid}:\`\`\`${row.reason}\`\`\``}]);
            }

            await message.channel.send({ embeds: [expelEmbed] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(message.author.id)) {
                    expelEmbed.setTitle('Expels Successfully Removed')
                    expelEmbed.setDescription(`The follow expels have been removed from the database tied to ${member}.`);
                    expelEmbed.setColor('#33FF33')
                    db.query(`DELETE FROM veriblacklist WHERE id = '${member.id}' OR id = '${nick}'`);
                } else {
                    expelEmbed.setTitle('Expels Not Removed')
                    expelEmbed.setDescription(`The expels for ${member} have not been removed.`);
                    expelEmbed.setColor('#FF3300')
                    expelEmbed.spliceFields(0, expelEmbed.data.fields.length);
                }
                confirmMessage.edit({ embeds: [expelEmbed], components: [] });
            })
        })
        manualVerifyLog(message, message.author.id, bot, db)
    }
}