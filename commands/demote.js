module.exports = {
    name: 'demote',
    role: 'headeventrl',
    description: 'Removes eo or leader on leave',
    guildSpecific: true,
    args: '<user>',
    requiredArgs: 2,
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]

        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send('User not found')
        await member.roles.remove(settings.roles.lol)
            .then(member.roles.remove(settings.roles.eventrl))
            .catch(er => { })
        await message.react('✅')
    }
}