module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'Developer',
    async execute(message, args, bot, db) {
        return;
        let guild = await bot.guilds.cache.find(g => g.name == args[0])
        let string = ''
        guild.emojis.cache.each(e => {
            try {
                string += (`\\${e}`).toString()
            } catch (er) { }
        })
        message.channel.send(string)
    }
}