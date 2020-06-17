module.exports = {
    name: 'restart',
    description: 'Restarts the bot',
    role: 'Moderator',
    execute(message, args, bot) {
        process.exit()
    }
}