const Discord = require('discord.js')
const { settings } = require('../lib/settings');

async function removeRole(member, message, vetRaiderRole) {
    await member.roles.remove(vetRaiderRole)
        .then(message.react('✅'))
        .catch(er => {
            message.channel.send(`Error: \`${er}\``)
        });

    let embed = new Discord.EmbedBuilder()
        .setTitle('Manual Veteran Unverify')
        .setDescription(member.toString())
        .addFields([{name: 'User', value: member.displayName, inline: true}])
        .addFields([{name: 'Unverified By', value: `<@!${message.author.id}>`, inline: true}])
        .addFields([{name: 'Role', value: vetRaiderRole.toString(), inline: false}])
        .setTimestamp(Date.now());
    message.guild.channels.cache.get(settings[member.guild.id].channels.modlogs).send({ embeds: [embed] });
}

module.exports = {
    name: 'unvetverify',
    description: 'Removes veteran raider role',
    role: 'security',
    roleOverride: { '343704644712923138': 'security' },
    args: '<user>',
    async execute(message, args, bot) {
        const member = message.guild.findMember(args[0]);
        if (!member) return message.channel.send(`User ${args[0]} not found`)

        //check for staff
        if (member.roles.highest.position >= message.guild.roles.cache.get(settings[message.guild.id].roles.eventrl).position) return message.channel.send('You can not unvetverify EO+')

        // get vet roles that arent null and that the raider has assigned to them already
        const vetRoles = Object.entries(settings[message.guild.id].roles)
            .filter(([key, value]) => {
                let split = key.split('vetraider')
                return key != "" && value && split[0] == "" && (split[1] ? !isNaN(split[1]) : true) && member.roles.cache.has(value)
            })
            .map(([key, value]) => message.guild.roles.cache.get(value))

        // check if there are vet roles that can be removed
        if (vetRoles.length == 0) {
            return message.reply(`Raider doesn't have any veteran roles. If this is not the case, please contact a Moderator/Admin to set up veteran roles.`)
        } else if (vetRoles.length == 1) {
            // remove the only vet role they have
            let vetRaiderRole = vetRoles[0]
            return removeRole(member, message, vetRaiderRole)
        }

        // shows all vet roles that can be removed if there are multiple
        let choiceEmbed = new Discord.EmbedBuilder()
            .setDescription(`Please select the veteran role to remove from ${member}`);

        await message.reply({ embeds: [choiceEmbed], ephemeral: true }).then(async confirmMessage => {
            let vetRoleNames = []
            // get a list of role names to add as buttons
            vetRoles.forEach(vetRole => vetRoleNames.push(vetRole.name))
            const choice = await confirmMessage.confirmList(vetRoleNames, message.author.id)
            if (!choice || choice == 'Cancelled') {
                message.react('✅')
                return confirmMessage.delete()
            }
          
            // retrieve the role with the name that was selected
            let vetRaiderRole = vetRoles.find(vetRole => vetRole.name == choice)
            if (!vetRaiderRole) return message.reply('Failed to find veteran role with name ' + choice)
            removeRole(member, message, vetRaiderRole)  
            return confirmMessage.delete()
        })
    }
}