module.exports = {
    name: 'clean',
    description: 'Cleans the voice channel you are in or the one specified',
    requiredArgs: 0,
    args: '(channelID)',
    role: 'eventrl',
    async execute(message, args, bot) {
        const botSettings = bot.settings[message.guild.id]
        let vc = null
        if (args.length > 0) vc = await message.guild.channels.cache.get(args[0])
        if (!vc) vc = await message.guild.channels.cache.get(message.member.voice.channelId)
        if (!vc) return await message.reply('The channel to clean was not found.')

        const lounge = message.guild.channels.cache.get(botSettings.voice.lounge) || message.guild.channels.cache.get(botSettings.voice.afk)
        if (!lounge) return await message.reply('The lounge channel is not defined in the settings.')

        let cleaned = 0
        const minimumStaffRole = message.guild.roles.cache.get(botSettings.roles.minimumStaffRole)
        if (!minimumStaffRole) return await message.reply('The minimum staff role is not defined in the settings.')
        await Promise.all(vc.members.map(async m => {
            if (m.roles.highest.position < minimumStaffRole.position) {
                await m.voice.setChannel(lounge).catch(er => {})
                cleaned++
            }
        }))
        await message.reply(`${cleaned == 0 ? 'The channel is already clean.' : `The channel was successfully cleaned and \`${cleaned}\` members were moved.`}`)
    }
}
