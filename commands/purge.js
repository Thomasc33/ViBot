module.exports = {
    name: 'purge',
    description: 'Removes x messages from channel',
    role: 'Head Raid Leader',
    args: '<x>',
    async execute(message, args, bot) {
        if (!args[0] || args[0].replace(/[^0-9]+/g, '') == '') { message.channel.send('Please provide a number'); return; }
        if (parseInt(args[0]) > 100) { message.channel.send('Max is 100 messages'); return; }
        message.channel.bulkDelete(args[0])
    }
}