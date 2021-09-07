module.exports = {
    name: 'test',
    description: 'Holds testing code',
    guildSpecific: true,
    role: 'developer',
    async execute(message, args, bot, db) {
        let channel = message.guild.channels.cache.get('519253731867492362')

        db.query('SELECT * FROM users WHERE successruns != 0')
    }
}
