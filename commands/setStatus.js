const ErrorLogger = require('../logError')
module.exports = {
    name: 'setstatus',
    description: 'Sets the bots custom status',
    requiredArgs: 1,
    role: 'moderator',
    execute(message, args, bot) {
        var status = ''
        for (let i in args) status = status.concat(` ${args[i]}`)
        if (status == '') return;
        status = status.slice()
        if (status.length > 128) { message.channel.send("Max length is 128"); return; }
        bot.user.setActivity(status).catch(er => ErrorLogger.log(er, bot));
        message.channel.send("Success")
    }
}