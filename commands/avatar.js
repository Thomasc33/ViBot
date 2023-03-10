const Discord = require('discord.js')

module.exports = {
    name: 'avatar',
    description: 'Posts avatar of user provided',
    args: '(user)',
    alias: ['ava'],
    role: 'eventrl',
    getSlashCommandData() {
        return new Discord.SlashCommandBuilder()
            .setName('avatar')
            .setDescription('Posts avatar of user provided')
            .addUserOption(option => option.setName('user').setDescription('User to add alt to').setRequired(true))
    },
    execute(message, args) {
        let member = null
        if (args.length == 0) member = message.member
        if (!member) member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')
        let embed = new Discord.EmbedBuilder()
            .setColor('#fefefe')
            .setDescription(`__**Avatar of**__ <@${member.id}> ${member ? '\`' + (member.nickname || member.user.tag) + '\`' : ''}`)
            .setImage(member.user.avatarURL({ dynamic: true, size: 4096 }))
        message.channel.send({ embeds: [embed] })
    },
    async slashCommandExecute(interaction) {
        let member = interaction.options.getMember('user')
        let embed = new Discord.EmbedBuilder()
            .setColor('#fefefe')
            .setDescription(`__**Avatar of**__ <@${member.id}> ${member ? '\`' + (member.nickname || member.user.tag) + '\`' : ''}`)
            .setImage(member.user.avatarURL({ dynamic: true, size: 4096 }))
        interaction.reply({ embeds: [embed] })
    }
}