const ErrorLogger = require('../logError')
module.exports = {
    name: 'setstatus',
    description: 'Sets the bots custom status',
    role: 'Moderator',
    execute(message, args, bot) {
        let status
        for (let i in args) status = status.concat(` ${args[i]}`)
        if (status = null) return;
        if (status.length > 128) { message.channel.send("Max length is 128"); return; }
        bot.user.setActivity(status).catch(er => ErrorLogger.log(er, bot));
        message.channel.send("Success")
    }
}