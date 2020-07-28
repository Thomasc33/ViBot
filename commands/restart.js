module.exports = {
    name: 'restart',
    description: 'Restarts the bot',
    role: 'moderator',
    execute(message, args, bot) {
        process.exit()
    }
}