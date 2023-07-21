const Discord = require('discord.js')
const { manualVetVerifyLog } = require('../commands/vetVerification.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')
const { createReactionRow } = require('../redis.js')

module.exports = {
    name: 'manualvetverify',
    description: 'Adds Veteran Raider Role to user',
    requiredArgs: 1,
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    alias: ['mvv'],
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: "The discord user ID or @mention you want to vet verify"
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        const vetBanRole = message.guild.roles.cache.get(settings.roles.vetban)

        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0]);
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.replyUserError("User not found")
        if (member.roles.cache.has(vetBanRole.id)) return message.replyUserError("User is vet banned")

        // get all vet roles that arent null
        const vetRoles = Object.entries(settings.roles)
            .filter(([key, value]) => key.includes('vetraider') && value)
            .map(([key, value]) => value)

        // if there isnt a vet role assigned, do nothing
        if (vetRoles.length == 0) return
        else if (vetRoles.length == 1) {
            // get the only vet role and assign it to the raider
            let vetRaiderRole = message.guild.roles.cache.get(vetRoles[0]);
            module.exports.addRole(bot, db, member, message, vetRaiderRole)
        } else {
            // shows buttons for all vet roles that can be assigned
            let choiceEmbed = new Discord.EmbedBuilder()
                .setDescription(`Please select the veteran role to give to ${member}`);

            const buttons = new Discord.ActionRowBuilder()

            for (let vetRole of vetRoles) {
                let role = message.guild.roles.cache.get(vetRole)
                
                buttons.addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId(role.id)
                        .setLabel(role.name)
                        .setStyle(Discord.ButtonStyle.Primary),
                    );
            }
            
            buttons.addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('Cancelled')
                    .setLabel('❌ Cancel')
                    .setStyle(Discord.ButtonStyle.Danger)
            );

            const reply = await message.reply({ embeds: [choiceEmbed], components: [ buttons ], ephemeral: true })
            createReactionRow(reply, module.exports.name, 'handleButtons', buttons, message.author, { memberId : member.id, messageId: message.id })
        }        
    },
    async handleButtons(bot, confirmMessage, db, choice, state) {
        if (!choice || choice == 'Cancelled') {
            return confirmMessage.delete()
        } else {
            let member = confirmMessage.interaction.guild.members.cache.get(state.memberId)
            let vetRaiderRole = confirmMessage.interaction.guild.roles.cache.get(choice)
            let message = confirmMessage.interaction.channel.messages.cache.get(state.messageId)
            module.exports.addRole(bot, db, member, message, vetRaiderRole)
        }
       
        return confirmMessage.delete()
    },
    async addRole(bot, db, member, message, vetRaiderRole) {
        member.roles.add(vetRaiderRole)

        let settings = bot.settings[message.guild.id]

        if (settings.backend.useUnverifiedRole && member.roles.cache.has(settings.roles.unverified)) member.roles.remove(settings.roles.unverified)
        let embed = new Discord.EmbedBuilder()
            .setTitle('Manual Veteran Verify')
            .setDescription(member.toString())
            .addFields([{name: 'User', value: member.displayName, inline: true}])
            .addFields([{name: 'Verified By', value: `<@!${message.author.id}>`, inline: true}])
            .addFields([{name: 'Role', value: vetRaiderRole.toString(), inline: false}])
            .setTimestamp(Date.now());
        message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
        let confirmEmbed = new Discord.EmbedBuilder().setDescription(`${member} has been given ${vetRaiderRole}`)
        message.reply({ embeds: [confirmEmbed] })
        manualVetVerifyLog(message, message.author.id, bot, db)
    }
}
