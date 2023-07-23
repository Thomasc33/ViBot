const Discord = require('discord.js')
const { manualVetVerifyLog } = require('../commands/vetVerification.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

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

        // get all vet roles that arent null and that the raider doesn't have already
        const vetRoles = Object.entries(settings.roles)
            .filter(([key, value]) => {
                let split = key.split('vetraider')
                return key != "" && value && split[0] == "" && (split[1] ? !isNaN(split[1]) : true) && !member.roles.cache.has(value)
            })
            .map(([key, value]) => message.guild.roles.cache.get(value))

        // check if there are vet roles to assign
        if (vetRoles.length == 0) {
            return message.reply(`Raider has all available veteran roles. If this is not the case, please contact a Moderator/Admin to set up veteran roles.`)
        } else if (vetRoles.length == 1) {
            // get the only vet role and assign it to the raider
            let vetRaiderRole = vetRoles[0]
            return module.exports.addRole(bot, db, member, message, vetRaiderRole)
        } 

        // shows all vet roles that can be assigned if there are multiple
        let choiceEmbed = new Discord.EmbedBuilder()
            .setDescription(`Please select the veteran role to give to ${member}`);
        
        await message.reply({ embeds: [choiceEmbed], ephemeral: true }).then(async confirmMessage => {
            let vetRoleNames = []
            // get a list of role names to add as buttons
            vetRoles.forEach(vetRole => vetRoleNames.push(vetRole.name))
            const choice = await confirmMessage.confirmList(vetRoleNames, message.author.id)
            if (choice && choice != 'Cancelled') {
                // retrieve the role with the name that was selected
                let vetRaiderRole = vetRoles.find(vetRole => vetRole.name == choice)
                if (!vetRaiderRole) return message.reply('Failed to find veteran role with name ' + choice)
                module.exports.addRole(bot, db, member, message, vetRaiderRole)
            }
            return confirmMessage.delete()
        })
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
