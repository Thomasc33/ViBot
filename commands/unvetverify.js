const Discord = require('discord.js')
const { createReactionRow } = require('../redis.js')

module.exports = {
    name: 'unvetverify',
    description: 'Removes veteran raider role',
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    args: '<user>',
    async execute(message, args, bot, db) {
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')

        //check for staff
        if (member.roles.highest.position >= message.guild.roles.cache.get(bot.settings[message.guild.id].roles.eventrl).position) return message.channel.send('You can not unvetverify EO+')

        let settings = bot.settings[message.guild.id]

        // get vet roles that arent null and that the raider has assigned to them already
        const vetRoles = Object.entries(settings.roles)
            .filter(([key, value]) => key.includes('vetraider') && value && member.roles.cache.has(value))
            .map(([key, value]) => value)

        if (vetRoles.length == 0) return
        else if (vetRoles.length == 1) {
            // remove the only vet role they have
            module.exports.removeRole(member, message, vetRoles[0])
        } else {
            // provide buttons to select which vet role to remove
            let choiceEmbed = new Discord.EmbedBuilder()
                .setDescription(`Please select the veteran role to remove from ${member}`);

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
            module.exports.removeRole(member, message, vetRaiderRole)
        }
       
        return confirmMessage.delete()
    },
    async removeRole(member, message, vetRaiderRole) {
        member.roles.remove(vetRaiderRole)
            .then(message.react('✅'))
            .catch(er => {
                message.channel.send(`Error: \`${er}\``)
            });
    }
}