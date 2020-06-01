module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'Developer',
    execute(message, args, bot, db) {
        let member = message.member
        message.channel.send(member.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|')[0])
    }
}