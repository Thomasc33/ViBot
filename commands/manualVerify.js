const Discord = require('discord.js')
const { manualVerifyLog } = require('../commands/verification.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'manualverify',
    description: 'Manually verifies a user',
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    alias: ['mv'],
    varargs: true,
    requiredArgs: 3,
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: 'The discord user ID or @mention you want to verify'
        }),
        slashArg(SlashArgType.String, 'ign', {
            description: 'The in game name you want to verify'
        }),
        slashArg(SlashArgType.String, 'reason', {
            description: 'Reason for the verification'
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        // Add Default roles
        const settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        const sbvRole = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const raiderRole = message.guild.roles.cache.get(settings.roles.raider)
        const image = message.attachments.first() ? message.attachments.first().proxyURL : null

        // Member Logic Check
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) return message.replyUserError('User not found')
        if ((suspendedRole && member.roles.cache.has(suspendedRole.id)) || member.roles.cache.has(sbvRole.id)) return message.replyUserError('User is suspended')
        if (member.roles.cache.has(raiderRole.id)) return message.replyUserError('User is already verified')

        // Reason Logic
        const reason = args.slice(2).join(' ')
        if (!reason) return message.replyUserError('Please enter a valid reason.')

        // Add roles
        if (member.roles.cache.has(settings.roles.eventraider)) await member.roles.remove(settings.roles.eventraider)
        await member.roles.add(raiderRole)
        if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) await member.roles.remove(settings.roles.unverified)
        if (settings.backend.giveeventroleonverification) await member.roles.add(settings.roles.eventraider)
        const tag = member.user.username
        let nick = ''
        if (tag == args[1]) {
            nick = args[1].toLowerCase()
            if (tag == nick) {
                nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
            }
        } else nick = args[1]

        await member.setNickname(nick)

        // Create Embed
        const embed = new Discord.EmbedBuilder()
            .setTitle('Manual Verify')
            .setDescription(member.toString())
            .addFields([{ name: 'User', value: member.displayName, inline: true }])
            .addFields([{ name: 'Verified By', value: `<@!${message.author.id}>`, inline: true }])
            .addFields([{ name: 'Reason', value: reason }])
            .setTimestamp(Date.now())
            .setImage(image)

        await message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] })
        const confirmEmbed = new Discord.EmbedBuilder()
            .setDescription(`${member} has been given ${raiderRole}`)
        await message.reply({ embeds: [confirmEmbed] })
        await member.user.send(`You have been verified on \`${message.guild.name}\`. Please head over to rules, faq, and raiding-rules channels to familiarize yourself with the server. Happy raiding`)

        db.query(`SELECT * FROM veriblacklist WHERE id = '${member.id}' OR id = '${nick}'`, async (err, rows) => {
            if (!rows || !rows.length) {return}

            const expelEmbed = new Discord.EmbedBuilder()
                .setTitle('Automatic Expel Removal')
                .setDescription(`The following expels will be removed from the database tied to ${member}. Are you sure you want to do this?`)
                .setColor('#E0B0FF')

            for (const row of rows) {
                expelEmbed.addFields([{ name: `${row.id}`, value: `Expelled by <@${row.modid}> in ${bot.guilds.cache.get(row.guildid).name || row.guildid}:\`\`\`${row.reason}\`\`\`` }])
            }

            await message.channel.send({ embeds: [expelEmbed] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(message.author.id)) {
                    expelEmbed.setTitle('Expels Successfully Removed')
                    expelEmbed.setDescription(`The follow expels have been removed from the database tied to ${member}.`)
                    expelEmbed.setColor('#33FF33')
                    db.query(`DELETE FROM veriblacklist WHERE id = '${member.id}' OR id = '${nick}'`)
                } else {
                    expelEmbed.setTitle('Expels Not Removed')
                    expelEmbed.setDescription(`The expels for ${member} have not been removed.`)
                    expelEmbed.setColor('#FF3300')
                    expelEmbed.spliceFields(0, expelEmbed.data.fields.length)
                }
                confirmMessage.edit({ embeds: [expelEmbed], components: [] })
            })
        })
        manualVerifyLog(message, message.author.id, bot, db)
    }
}
