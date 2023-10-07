module.exports = {
    name: 'echo',
    role: 'moderator',
    description: 'posts the message given',
    execute(message) {
        message.channel.send(message.content.substring(6, message.content.length))
        message.delete()
    }
}
