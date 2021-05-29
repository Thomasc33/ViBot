const promoTypes = {
    "343704644712923138": [
        {
            key: 'e',
            toAdd: 'eventrl',
            toRemove: 'lol'
        },
        {
            key: 'l',
            toAdd: 'lol',
            toRemove: 'eventrl'
        }
    ]
}

module.exports = {
    name: 'promote',
    role: 'headeventrl',
    description: 'Sets a user to either (e)o, or (l)ol',
    args: '<e/l> <user>',
    requiredArgs: 2,
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        //arg 1
        let promoType = args[0].charAt(0).toLowerCase();
        if (!promoType) return message.channel.send('No promo type found')

        //arg 2
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[1])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[1].toLowerCase()));
        if (!member) return message.channel.send('User not found')

        if (!promoTypes[message.guild.id]) return message.channel.send('Promos not setup for this guild')
        for (let i of promoTypes[message.guild.id]) {
            if (i.key == promoType) {
                await member.roles.add(settings.roles[i.toAdd])
                await member.roles.remove(settings.roles[i.toRemove]).catch(er => { })
                await message.react('✅')
            }
        }
    }
}