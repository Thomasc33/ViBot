const ErrorLogger = require('../lib/logError')
const adminUsers = ['277636691227836419', '258286481167220738', '120540036855889921', '178840516882989056']
module.exports = {
    name: 'setstatus',
    description: 'Sets the bots custom status',
    requiredArgs: 1,
    role: 'developer',
    execute(message, args, bot) {
        if (!adminUsers.includes(message.member.id)) return
        let status = ''
        for (let i in args) status = status.concat(` ${args[i]}`)
        if (status == '') return;
        status = status.slice()
        if (status.length > 128) { message.channel.send("Max length is 128"); return; }
        bot.user.setActivity(status).catch(er => ErrorLogger.log(er, bot));
        message.channel.send("Success")
    },
    dmExecution(message, args, bot, db, guild) {
        this.execute(message, args, bot)
    }
}