const ErrorLogger = require('../lib/logError')
module.exports = {
    name: 'setstatus',
    description: 'Sets the bots custom status',
    requiredArgs: 1,
    role: 'developer',
    async execute(message, args, bot) {
        if (!bot.adminUsers.includes(message.member.id)) return
        let activityType = undefined
        if (['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'CUSTOM', 'COMPETING'].includes(args[0])) { activityType = args[0]; args.shift(); }
        let status = args.join(' ')
        if (status.length > 128) { message.channel.send("Max length is 128"); return; }
        if (status.length == 0) { message.channel.send('Minimum length is 1'); return; }
        await bot.user.setActivity(status, activityType ? activityType : "PLAYING")
    },
    dmExecution(message, args, bot, db, guild) {
        this.execute(message, args, bot)
    }
}