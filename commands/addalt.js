const Discord = require('discord.js')
const ErrorLogger = require('../lib/logError')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'addalt',
    description: 'Adds the username of an alt to a user and logs it',
    slashCommandName: 'addalt',
    alias: ['aa'],
    args: '<id/mention> <alt name> <image>',
    requiredArgs: 2,
    role: 'security',
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: 'User to add alt to',
        }),
        slashArg(SlashArgType.String, 'altname', {
            description: 'Name of the alt'
        }),
        slashArg(SlashArgType.Attachment, 'image', {
            description: 'Image proof of alt',
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id]
        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args.shift());
        else { args.shift() }
        if (!member) return message.replyUserError('User not found in the server')
        const altName = args.shift();
        let dupeName = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(altName.toLowerCase()));
        if (dupeName) return message.replyUserError(`${dupeName} already has the name ${altName}`)
        let image = message.attachments.first() ? message.attachments.first().proxyURL : null
        if (!image) image = args[2]
        if (!image) return message.channel.send(`Please provide an image`)
        if (!validURL(image)) return message.channel.send(`Error attaching the image. Please try again`)
        if (`${member.nickname} | ${altName}`.length > 32) return message.channel.send(`User exceeds the allowable nickname length of 32 characters with the addition of \`${altName}\`. Please remove an alt before proceeding.`)

        member.setNickname(`${member.nickname} | ${altName}`, `Old Name: ${member.nickname}\nNew Name: ${member.nickname} | ${altName}\nChange by: ${message.member}`);
        message.react('✅')

        let embed = new Discord.EmbedBuilder()
            .setTitle('Alt Added')
            .setDescription(member.toString())
            .addFields([
                { name: 'Main', value: member.nickname, inline: true },
                { name: 'New Alt', value: altName, inline: true },
                { name: 'Added By', value: `<@!${message.author.id}>` }
            ])
            .setTimestamp(Date.now())
            .setImage(image)
        await message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });

        db.query(`SELECT * FROM veriblacklist WHERE id = '${altName}'`, async (err, rows) => {
            if (!rows || !rows.length)
                return;

            const expelEmbed = new Discord.EmbedBuilder()
                .setTitle('Expel Removal')
                .setDescription(`The following expels will be removed from the database tied to ${altName}. Are you sure you want to do this?`)
                .setColor('#E0B0FF');

            for (const row of rows) {
                expelEmbed.addFields([{ name: `${row.id}`, value: `Expelled by <@${row.modid}> in ${bot.guilds.cache.get(row.guildid).name || row.guildid}:\`\`\`${row.reason}\`\`\`` }]);
            }

            await message.channel.send({ embeds: [expelEmbed] }).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(message.author.id)) {
                    expelEmbed.setTitle('Expels Successfully Removed')
                    expelEmbed.setDescription(`The following expels have been removed from the database tied to ${altName}.`);
                    expelEmbed.setColor('#33FF33')
                    db.query(`DELETE FROM veriblacklist WHERE id = '${altName}'`);
                } else {
                    expelEmbed.setTitle('Expels Not Removed')
                    expelEmbed.setDescription(`The expels for ${altName} have not been removed.`);
                    expelEmbed.setColor('#FF3300')
                    expelEmbed.spliceFields(0, expelEmbed.data.fields.length);
                }
                confirmMessage.edit({ embeds: [expelEmbed], components: [] });
            })
        })
    },
    async slashCommandExecute(interaction, bot, db) {
        const settings = bot.settings[interaction.guild.id]
        var member = interaction.options.getMember('user')
        const altName = interaction.options.getString('altname');
        let dupeName = interaction.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(altName.toLowerCase()));
        if (dupeName) return interaction.replyUserError(`${dupeName} already has the name ${altName}`)
        let image = interaction.options.getAttachment('image').proxyURL

        member.setNickname(`${member.nickname} | ${altName}`, `Old Name: ${member.nickname}\nNew Name: ${member.nickname} | ${altName}\nChange by: ${interaction.member}`);

        let embed = new Discord.EmbedBuilder()
            .setTitle('Alt Added')
            .setDescription(member.toString())
            .addFields([
                { name: 'Main', value: member.nickname, inline: true },
                { name: 'New Alt', value: altName, inline: true },
                { name: 'Added By', value: `<@!${interaction.member.id}>` }
            ])
            .setTimestamp(Date.now())
        if (validURL(image)) embed.setImage(image)
        else if (reason) embed.addFields([{ name: 'Reason', value: reason }])
        await interaction.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] })

        // Remove from blacklist
        db.query(`SELECT * FROM veriblacklist WHERE id = '${altName}'`, async (err, rows) => {
            if (!rows || !rows.length) return interaction.reply({ embeds: [embed] })

            const expelEmbed = new Discord.EmbedBuilder()
                .setTitle('Expel Removal')
                .setDescription(`The following expels will be removed from the database tied to ${altName}. Are you sure you want to do this?`)
                .setColor('#E0B0FF');

            for (const row of rows) {
                expelEmbed.addFields([{ name: `${row.id}`, value: `Expelled by <@${row.modid}> in ${bot.guilds.cache.get(row.guildid).name || row.guildid}:\`\`\`${row.reason}\`\`\`` }]);
            }

            await interaction.reply({ embeds: [expelEmbed], fetchReply : true}).then(async confirmMessage => {
                if (await confirmMessage.confirmButton(interaction.member.id)) {
                    expelEmbed.setTitle('Expels Successfully Removed')
                    expelEmbed.setDescription(`The following expels have been removed from the database tied to ${altName}.`);
                    expelEmbed.setColor('#33FF33')
                    db.query(`DELETE FROM veriblacklist WHERE id = '${altName}'`);
                } else {
                    expelEmbed.setTitle('Expels Not Removed')
                    expelEmbed.setDescription(`The expels for ${altName} have not been removed.`);
                    expelEmbed.setColor('#FF3300')
                    expelEmbed.spliceFields(0, expelEmbed.data.fields.length);
                }
                await interaction.editReply({ embeds: [expelEmbed], components: [] });
            });
        });
    },
}

function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}
