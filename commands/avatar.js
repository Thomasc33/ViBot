const Discord = require('discord.js')
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashChoices, slashCommandJSON } = require('../utils.js')

module.exports = {
    name: 'avatar',
    slashCommandName: 'avatar',
    description: 'Posts avatar of user provided',
    args: '(user)',
    alias: ['ava'],
    role: 'eventrl',
    args: [
        slashArg(SlashArgType.User, 'user', {
            required: false,
            description: 'User to view avatar of'
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild) },
    execute(message, args) {
        let member = null
        if (args.length == 0) member = message.member
        if (!member) member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.reply('User not found')
        let embed = new Discord.EmbedBuilder()
            .setColor('#fefefe')
            .setDescription(`__**Avatar of**__ <@${member.id}> ${member ? '\`' + (member.nickname || member.user.tag) + '\`' : ''}`)
            .setImage(member.user.avatarURL({ dynamic: true, size: 4096 }))
        message.reply({ embeds: [embed] })
    }
}
