const { execute } = require("./lock");

module.exports = {
    name: 'echo',
    role: '(Admin)',
    description: 'posts the message given',
    execute(message, args, bot) {
        message.channel.send(message.content.substring(6, message.content.length))
        message.delete()
    }
}